/**
 * apps/web/src/lib/upiQr.ts
 *
 * Generates NPCI-compliant dynamic UPI deep links and QR code helper URLs.
 * Every generated UPI URI contains the feeAssignmentId in its `tr` (transaction reference)
 * parameter so payments are 100% auto-reconciled on webhook arrival — 0 manual matching.
 */

export interface DynamicUpiParams {
  schoolVpa?: string;       // e.g. schoolname@icici (defaults to demo VPA)
  schoolName?: string;      // e.g. Demo International School
  feeAssignmentId: string;  // Idempotency & auto-reconciliation anchor
  amountRupees: number;     // e.g. 5000
  note?: string;            // e.g. Term 1 Tuition Fee
}

const DEFAULT_VPA = "demoschool@icici";
const DEFAULT_SCHOOL_NAME = "Finora Smart School";

/**
 * Builds an NPCI-standard UPI deep link string.
 * Format: upi://pay?pa=VPA&pn=NAME&tr=REF&am=AMOUNT&cu=INR
 */
export function buildDynamicUpiUri(params: DynamicUpiParams): string {
  const vpa = params.schoolVpa || DEFAULT_VPA;
  const name = encodeURIComponent(params.schoolName || DEFAULT_SCHOOL_NAME);
  const ref = encodeURIComponent(params.feeAssignmentId);
  const amount = params.amountRupees.toFixed(2);
  const note = encodeURIComponent(params.note || `Fee Payment ${params.feeAssignmentId}`);

  return `upi://pay?pa=${vpa}&pn=${name}&tr=${ref}&am=${amount}&cu=INR&tn=${note}`;
}

/**
 * Generates a public QR Code image URL via Google Chart API for dynamic display.
 */
export function getUpiQrImageUrl(params: DynamicUpiParams, size: number = 250): string {
  const upiUri = buildDynamicUpiUri(params);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUri)}`;
}
