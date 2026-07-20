"use server";

/**
 * apps/web/src/app/actions/payments.ts
 *
 * Server Action wrappers for Razorpay integration.
 *
 * Per system_architecture.md:
 * - All Razorpay calls happen server-side only (in Server Actions), never in client components.
 * - API keys never present in the client bundle.
 * - initiateUpiSandboxPayment, handleRazorpayWebhook, reconcileMissedUpiPayment
 *   are the three entry points specified in api_specification.md.
 */

import {
  initiateUpiSandboxPayment as _initiateUpiSandboxPayment,
  verifyRazorpayWebhookSignature,
  getMissedUpiPaymentData,
  type RazorpayOrder,
} from "@smart-school/payments";
import { recordPayment } from "./ledger";

/**
 * Creates a Razorpay sandbox order for a fee assignment's UPI payment.
 *
 * @param feeAssignmentId  The assignment to pay.
 * @param amountRupees     Amount in rupees (will be converted to paise internally).
 */
export async function initiateUpiSandboxPayment(
  feeAssignmentId: string,
  amountRupees: number
): Promise<RazorpayOrder> {
  const amountPaise = Math.round(amountRupees * 100);
  return _initiateUpiSandboxPayment(feeAssignmentId, amountPaise);
}

/**
 * Processes an incoming Razorpay webhook.
 * - Verifies HMAC-SHA256 signature via the payments package.
 * - On success, calls recordPayment (channel: upi) locally.
 * - On signature failure, throws — caller (API route) must log and return 400.
 * - Idempotency is guaranteed: same ref_number → returns existing TRANSACTION.
 *
 * NOTE: This action should be called from an API route handler (/api/webhooks/razorpay),
 * not from a UI form. The raw body string must be passed before any JSON.parse.
 */
export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string,
  adminId: string,
  schoolId: string,
  feeAssignmentId: string
): Promise<{ success: boolean; isDuplicate?: boolean }> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET env var is required.");
  }

  const { success, paymentData } = await verifyRazorpayWebhookSignature(
    rawBody,
    signature,
    webhookSecret
  );

  if (!success || !paymentData) {
    return { success: false };
  }

  // Record the payment locally in the ledger
  const result = await recordPayment(adminId, schoolId, {
    feeAssignmentId,
    channel: "upi",
    amount: paymentData.amountRupees,
    refNumber: paymentData.refNumber,
  });

  return { success: true, isDuplicate: result.isDuplicate };
}

/**
 * Manual admin recovery for missed webhooks.
 * Fetches the order from Razorpay via the payments package; if a captured payment exists,
 * posts it through the normal recordPayment path locally.
 *
 * Per api_specification.md: "Manual, explicitly-triggered admin action — NOT automatic polling."
 */
export async function reconcileMissedUpiPayment(
  razorpayOrderId: string,
  adminId: string,
  schoolId: string,
  feeAssignmentId: string
): Promise<{ found: boolean; posted: boolean; isDuplicate: boolean }> {
  const { found, paymentData } = await getMissedUpiPaymentData(razorpayOrderId);

  if (!found || !paymentData) {
    return { found: false, posted: false, isDuplicate: false };
  }

  // Record the payment locally in the ledger
  const result = await recordPayment(adminId, schoolId, {
    feeAssignmentId,
    channel: "upi",
    amount: paymentData.amountRupees,
    refNumber: paymentData.refNumber,
  });

  return {
    found: true,
    posted: !result.isDuplicate,
    isDuplicate: result.isDuplicate ?? false,
  };
}
