/**
 * @smart-school/payments — public exports
 *
 * Razorpay sandbox integration for the Smart School FinTech Platform.
 * All exports are server-side only — never imported in client components.
 * Credentials are read from env vars at call time, never bundled.
 */
export {
  initiateUpiSandboxPayment,
  verifyRazorpayWebhookSignature,
  getMissedUpiPaymentData,
  type RazorpayOrder,
  type RazorpayPayment,
  type WebhookPayload,
} from "./razorpay";
