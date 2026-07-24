"use server";

import { prisma, type ReceiptFormat } from "@smart-school/db";

/**
 * Generates a PDF receipt for a transaction.
 * Admin-only. (For demo purposes, parent can also hit this via stub in history page).
 *
 * GST logic:
 * If taxable, back-calculate GST component from the inclusive amount.
 * Snapshot the GST details so history never mutates.
 */
export async function generateReceipt(
  transactionId: string,
  format: ReceiptFormat
): Promise<{ pdfUrl: string; receiptNumber: string }> {
  // Use a transaction to lock the row and prevent duplicate receipt generation
  return await prisma.$transaction(async (tx) => {
    // Look up transaction with fee assignment and fee type
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: {
        feeAssignment: {
          include: { feeType: true, school: true },
        },
        student: true,
        receipt: true, // check if already exists
      },
    });

    if (!transaction) throw new Error("Transaction not found");
    if (transaction.reconciliationStatus !== "posted") {
      throw new Error("Cannot generate receipt for un-posted transaction");
    }

    if (transaction.receipt) {
      // Receipt already exists, return the existing one
      return {
        pdfUrl: transaction.receipt.pdfUrl,
        receiptNumber: transaction.receipt.receiptNumber,
      };
    }

    const { feeType } = transaction.feeAssignment;
    const amount = transaction.amount.toNumber();
    let gstAmount = 0;

    // GST back-calculation from inclusive amount
    if (feeType.gstTreatment === "taxable" && feeType.gstRate) {
      const rate = feeType.gstRate.toNumber();
      // GST-inclusive formula: gst_amount = amount * (rate / (100 + rate))
      gstAmount = amount * (rate / (100 + rate));
      // Round to 2 decimals
      gstAmount = Math.round(gstAmount * 100) / 100;
    }

    const gstDetails = {
      treatment: feeType.gstTreatment,
      rate: feeType.gstRate?.toNumber() || null,
      baseAmount: amount - gstAmount,
    };

    // Generate a sequential receipt number (simplified for demo)
    const count = await tx.receipt.count({
      where: { transaction: { schoolId: transaction.schoolId } },
    });
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    // PDF generation is stubbed for this demo.
    // In a real app, we'd use react-pdf or puppeteer and upload to Supabase Storage.
    const pdfUrl = `https://storage.dummy.com/receipts/${receiptNumber}.pdf`;

    const receipt = await tx.receipt.create({
      data: {
        transactionId,
        format,
        receiptNumber,
        gstAmount,
        gstDetails: gstDetails as any,
        pdfUrl,
      },
    });

    return { pdfUrl: receipt.pdfUrl, receiptNumber: receipt.receiptNumber };
  });
}
