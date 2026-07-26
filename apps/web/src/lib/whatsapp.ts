/**
 * apps/web/src/lib/whatsapp.ts
 *
 * Utility helper for generating WhatsApp 1-Tap UPI Payment Links & Smart Sibling Bundled Reminders.
 * Zero external API keys or permissions required (uses open WhatsApp wa.me universal links).
 */

export interface WhatsAppPaymentLinkParams {
  phone: string;              // e.g. "+919876543210" or "9876543210"
  studentName: string;         // e.g. "Rahul Sharma"
  studentClass: string;        // e.g. "Class 5"
  amountRupees: number;        // e.g. 5000
  feeAssignmentId: string;     // Idempotency anchor
  schoolName?: string;         // e.g. "Finora Smart School"
  payUrl?: string;             // Custom payment link
}

export interface SiblingDuesBundleParams {
  parentPhone: string;
  parentName?: string;
  siblings: Array<{
    studentName: string;
    studentClass: string;
    dueAmount: number;
    feeAssignmentId: string;
  }>;
  schoolName?: string;
}

/**
 * Sanitizes phone numbers to standard international digits (e.g. 919876543210).
 */
function sanitizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Builds a 1-Tap WhatsApp Payment link for a single student.
 */
export function buildWhatsAppPaymentUrl(params: WhatsAppPaymentLinkParams): string {
  const cleanPhone = sanitizePhone(params.phone);
  const school = params.schoolName || "Finora Smart School";
  const amountStr = params.amountRupees.toLocaleString("en-IN");
  const checkoutUrl = params.payUrl || `https://finora.school/pay/${params.feeAssignmentId}`;

  const message = `*${school} — Fee Payment Reminder*\n\nDear Parent, fee of *₹${amountStr}* is due for *${params.studentName}* (${params.studentClass}).\n\n👉 *Tap to Pay via UPI/GPay*: ${checkoutUrl}\n\n_Instant receipt will be issued immediately upon payment._`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a Smart Sibling Bundled WhatsApp Payment link for parents with 2+ children.
 */
export function buildSiblingBundledWhatsAppUrl(params: SiblingDuesBundleParams): string {
  const cleanPhone = sanitizePhone(params.parentPhone);
  const school = params.schoolName || "Finora Smart School";
  
  let totalDues = 0;
  let breakdownText = "";

  params.siblings.forEach((sib, idx) => {
    totalDues += sib.dueAmount;
    breakdownText += `${idx + 1}. *${sib.studentName}* (${sib.studentClass}): ₹${sib.dueAmount.toLocaleString("en-IN")}\n`;
  });

  const totalStr = totalDues.toLocaleString("en-IN");
  const parentGreeting = params.parentName ? `Dear ${params.parentName}` : "Dear Parent";
  const primaryFeeId = params.siblings[0]?.feeAssignmentId || "bundle";
  const checkoutUrl = `https://finora.school/pay/bundle/${primaryFeeId}`;

  const message = `*${school} — Consolidated Sibling Dues*\n\n${parentGreeting}, here is the fee summary for your children:\n\n${breakdownText}\n*Total Dues*: *₹${totalStr}*\n\n👉 *Tap to Pay All via UPI/GPay*: ${checkoutUrl}\n\n_Instant receipts will be generated for both students._`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
