/**
 * packages/payments/src/razorpay.ts
 *
 * Razorpay sandbox integration.
 *
 * Integration contract (system_architecture.md — Razorpay):
 * - initiateUpiSandboxPayment: creates a sandbox order.
 * - handleRazorpayWebhook: the ONLY consumer of Razorpay's async response.
 *   - Signature verification failure → reject and log; do NOT post a transaction.
 *   - Idempotency: check for existing ref_number before calling recordPayment.
 * - reconcileMissedUpiPayment: manual admin recovery for missed webhooks.
 *
 * All credentials come from env vars (never hardcoded, never in the client bundle).
 * Sandbox mode only — no live KYC/PCI integration. Hard constraint, not a temporary shortcut.
 */

import crypto from "crypto";

// ---------------------------------------------------------------------------
// Razorpay API primitives (lightweight — avoids the full SDK dependency
// complexity while keeping sandbox mode correct).
// ---------------------------------------------------------------------------

const RAZORPAY_BASE_URL = "https://api.razorpay.com/v1";

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars are required."
    );
  }
  return { keyId, keySecret };
}

function basicAuth(): string {
  const { keyId, keySecret } = getCredentials();
  return (
    "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64")
  );
}

async function razorpayFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${RAZORPAY_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
  receipt: string | null;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number; // paise
  status: string;
}

export interface WebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: RazorpayPayment;
    };
    order?: {
      entity: RazorpayOrder;
    };
  };
}

// ---------------------------------------------------------------------------
// initiateUpiSandboxPayment
// ---------------------------------------------------------------------------

/**
 * Creates a Razorpay sandbox order for UPI payment.
 *
 * @param feeAssignmentId  Used as the order receipt for traceability.
 * @param amountPaise      Amount in paise (integer). The caller converts from rupees.
 * @returns The created Razorpay order object.
 */
export async function initiateUpiSandboxPayment(
  feeAssignmentId: string,
  amountPaise: number
): Promise<RazorpayOrder> {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("amountPaise must be a positive integer.");
  }

  return razorpayFetch<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: feeAssignmentId,
      payment_capture: 1, // auto-capture in sandbox
      notes: {
        fee_assignment_id: feeAssignmentId,
        source: "smart_school_sandbox",
      },
    }),
  });
}

// ---------------------------------------------------------------------------
// handleRazorpayWebhook
// ---------------------------------------------------------------------------

/**
 * Verifies the webhook signature and, on success, calls recordPayment.
 *
 * CRITICAL RULES (system_architecture.md — Razorpay):
 * 1. Signature verification failure → throw (caller must log and return 400).
 * 2. Idempotency: Caller (e.g. recordPayment) handles the ref_number check internally.
 * 3. Only "payment.captured" events trigger a TRANSACTION insert.
 * 4. Never post a transaction for any other event type.
 *
 * @param rawBody       The raw request body string (before JSON.parse).
 * @param signature     The X-Razorpay-Signature header value.
 * @param webhookSecret The Razorpay webhook secret (RAZORPAY_WEBHOOK_SECRET env var).
 */
export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): Promise<{ success: boolean; paymentData?: { amountRupees: number; refNumber: string } }> {
  // 1. Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    )
  ) {
    // Signature mismatch — reject. Caller must log and return 400.
    throw new Error("Razorpay webhook signature verification failed.");
  }

  const payload = JSON.parse(rawBody) as WebhookPayload;

  // 2. Only handle payment.captured events
  if (payload.event !== "payment.captured") {
    // Other events (payment.failed, order.paid, etc.) are ignored — not an error.
    return { success: false };
  }

  const payment = payload.payload.payment?.entity;
  if (!payment) {
    throw new Error("Webhook payload missing payment entity.");
  }

  // Amount in paise → rupees (Decimal-safe).
  const amountRupees = payment.amount / 100;

  return { 
    success: true, 
    paymentData: { amountRupees, refNumber: payment.id } 
  };
}

// ---------------------------------------------------------------------------
// reconcileMissedUpiPayment
// ---------------------------------------------------------------------------

/**
 * Manual admin recovery for the "Razorpay shows paid, ledger doesn't" failure mode.
 *
 * Queries Razorpay directly for the order; if a captured payment exists,
 * returns the payment data. The caller must then post it through the
 * recordPayment path (preserves idempotency).
 *
 * This is the manual fallback per api_specification.md — NOT automatic polling.
 *
 * @param razorpayOrderId  The Razorpay order ID to check.
 */
export async function getMissedUpiPaymentData(
  razorpayOrderId: string
): Promise<{ found: boolean; paymentData?: { amountRupees: number; refNumber: string } }> {
  // 1. Fetch the order's payments from Razorpay
  const { items } = await razorpayFetch<{ items: RazorpayPayment[] }>(
    `/orders/${razorpayOrderId}/payments`
  );

  // 2. Find the first captured payment
  const capturedPayment = items.find((p) => p.status === "captured");
  if (!capturedPayment) {
    return { found: false };
  }

  // 3. Return the data so the caller can post through recordPayment
  const amountRupees = capturedPayment.amount / 100;
  
  return {
    found: true,
    paymentData: {
      amountRupees,
      refNumber: capturedPayment.id,
    },
  };
}
