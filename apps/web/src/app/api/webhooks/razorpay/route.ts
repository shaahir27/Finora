/**
 * apps/web/src/app/api/webhooks/razorpay/route.ts
 *
 * HTTP POST handler for incoming Razorpay webhook events.
 *
 * WHY THIS MUST BE AN API ROUTE (not a Server Action):
 * Razorpay's servers send a raw HTTP POST with a custom header
 * (X-Razorpay-Signature). Next.js Server Actions are only callable
 * from the browser via a special POST format — they cannot receive
 * arbitrary HTTP POSTs from external services. This route is the
 * correct entry point for all Razorpay async callbacks.
 *
 * Security contract (system_architecture.md — Razorpay):
 * 1. Read raw body BEFORE any JSON.parse (signature is over raw bytes).
 * 2. Verify HMAC-SHA256 against RAZORPAY_WEBHOOK_SECRET.
 * 3. Reject with 400 on signature failure — do NOT post any transaction.
 * 4. Only "payment.captured" events trigger a TRANSACTION insert.
 * 5. Idempotency is handled inside recordPayment (ref_number check).
 *
 * The feeAssignmentId is carried in the Razorpay order's `notes` field,
 * set at order creation time by initiateUpiSandboxPayment.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@smart-school/payments";
import { recordPayment } from "@/app/actions/ledger";

// School/admin context for webhook-originated payments.
// In production these would be resolved from the order's metadata.
// For the sandbox demo, a single school and system admin ID is used —
// matching the same pattern as handleRazorpayWebhook in api_specification.md.
const WEBHOOK_SCHOOL_ID = process.env.NEXT_PUBLIC_DEMO_SCHOOL_ID ?? "demo-school-id";
const WEBHOOK_ADMIN_ID = "razorpay-webhook-system";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body — MUST happen before any JSON.parse.
  //    Signature verification is over raw bytes, not the parsed object.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // 2. Verify signature — throws on failure, returns { success: false } for non-captured events.
  let verifyResult: Awaited<ReturnType<typeof verifyRazorpayWebhookSignature>>;
  try {
    verifyResult = await verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
  } catch (err) {
    // Signature mismatch — reject with 400. Per spec: "Rejects and logs on signature failure
    // without posting a transaction."
    console.error("[razorpay-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 3. Non-captured events (payment.failed, order.paid, etc.) — acknowledge with 200, no action.
  if (!verifyResult.success || !verifyResult.paymentData) {
    return NextResponse.json({ received: true, action: "ignored" }, { status: 200 });
  }

  // 4. Extract feeAssignmentId from the Razorpay order notes (set at order creation time).
  let feeAssignmentId: string | undefined;
  try {
    const payload = JSON.parse(rawBody);
    feeAssignmentId =
      payload?.payload?.order?.entity?.notes?.fee_assignment_id ??
      payload?.payload?.payment?.entity?.notes?.fee_assignment_id;
  } catch {
    // JSON.parse should never fail here since verifyRazorpayWebhookSignature already parsed it.
  }

  if (!feeAssignmentId) {
    console.error("[razorpay-webhook] Missing fee_assignment_id in order notes.");
    // Return 200 to prevent Razorpay from retrying (it's our data issue, not theirs).
    return NextResponse.json({ error: "Missing fee_assignment_id in notes" }, { status: 200 });
  }

  // 5. Post the payment through the canonical recordPayment path.
  //    Idempotency: recordPayment checks for existing ref_number before inserting.
  try {
    const result = await recordPayment(WEBHOOK_ADMIN_ID, WEBHOOK_SCHOOL_ID, {
      feeAssignmentId,
      channel: "upi",
      amount: verifyResult.paymentData.amountRupees,
      refNumber: verifyResult.paymentData.refNumber,
    });

    return NextResponse.json(
      {
        received: true,
        transactionId: result.transaction.id,
        isDuplicate: result.isDuplicate,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[razorpay-webhook] recordPayment failed:", err);
    // Return 500 so Razorpay retries — this is a server-side failure, not a data issue.
    return NextResponse.json({ error: "Payment recording failed" }, { status: 500 });
  }
}
