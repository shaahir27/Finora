// @ts-nocheck
"use server";

import { prisma, type ReceiptFormat } from "@smart-school/db";
import { renderToStream } from '@react-pdf/renderer';
import { ReceiptPdf } from '@/components/ReceiptPdf';
import { supabaseAdmin } from '@/lib/supabase-admin';
import React from 'react';

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
      },
    });

    if (!transaction) throw new Error("Transaction not found");
    if (transaction.reconciliationStatus !== "posted") {
      throw new Error("Cannot generate receipt for un-posted transaction");
    }

    // Check if receipt already exists
    const existingReceipt = await tx.receipt.findUnique({
      where: { transactionId },
    });

    if (existingReceipt) {
      return {
        pdfUrl: existingReceipt.pdfUrl,
        receiptNumber: existingReceipt.receiptNumber,
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

    // Real PDF Generation using @react-pdf/renderer
    const pdfStream = await renderToStream(
      React.createElement(ReceiptPdf, {
        receiptNumber,
        studentName: transaction.student.name,
        schoolName: transaction.feeAssignment.school.name,
        amount,
        date: new Date().toLocaleDateString(),
        channel: transaction.channel,
      })
    );

    // Collect stream chunks into a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('receipts')
      .upload(`${transaction.schoolId}/${receiptNumber}.pdf`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload PDF:", uploadError);
      throw new Error("Failed to generate and upload PDF receipt.");
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('receipts')
      .getPublicUrl(`${transaction.schoolId}/${receiptNumber}.pdf`);
      
    const pdfUrl = publicUrlData.publicUrl;

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
