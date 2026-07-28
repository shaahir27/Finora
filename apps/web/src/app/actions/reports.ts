"use server";

import { getLedgerSnapshot } from "./ledger";
import { prisma } from "@smart-school/db";
import { rateLimit } from "@/lib/rateLimit";
import { requireAdminForSchool } from "@/lib/require-session";
import { isDemoMode } from "@/lib/demo-mode";
import { getDemoReportResult } from "@/lib/demo-data";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderToStream } from "@react-pdf/renderer";
import { ReconciliationReportPdf } from "@/components/ReconciliationReportPdf";
import React from "react";

function csvEscape(val: string): string {
  if (/[,"\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function toCsv(
  rows: { id?: string; channel: string; amount: number; reconciliationStatus: string; postedAt: string; studentName?: string; feeType?: string }[],
  meta: { schoolId: string; startDate: string; endDate: string; generatedAt: string }
): string {
  // ── Metadata comment block (industry practice: # prefixed rows above header) ──
  const metaBlock = [
    `# Report: Finora Fee Reconciliation Report`,
    `# School ID: ${meta.schoolId}`,
    `# Period: ${meta.startDate || "all_time"} to ${meta.endDate || "today"}`,
    `# Generated: ${meta.generatedAt}`,
    `# Currency: INR`,
    `# Encoding: UTF-8`,
    `# Note: Amount columns are pure numbers (no currency symbols) for accounting software compatibility`,
  ];

  // ── snake_case headers (industry standard for fintech CSV) ──
  const header = [
    "transaction_id",
    "transaction_date",
    "student_name",
    "fee_type",
    "payment_channel",
    "base_amount_inr",
    "currency_code",
    "reconciliation_status",
    "payment_reference",
  ];

  // ── Data rows with ISO 8601 dates, no ₹ symbols, proper quoting ──
  const lines = rows.map((r) => [
    csvEscape(r.id ?? ""),
    new Date(r.postedAt).toISOString().split("T")[0],   // YYYY-MM-DD
    csvEscape(r.studentName ?? ""),
    csvEscape(r.feeType ?? "Tuition Fee"),
    csvEscape(r.channel.toUpperCase()),
    r.amount.toFixed(2),                                // plain number
    "INR",
    csvEscape(r.reconciliationStatus),
    csvEscape(r.id ? `RCP-${r.id.slice(-8).toUpperCase()}` : ""),
  ].join(","));

  return [...metaBlock, header.join(","), ...lines].join("\n");
}

function parseSafeDate(dateStr?: string, isEnd = false): Date | undefined {
  if (!dateStr || dateStr.trim() === "") return undefined;
  const d = new Date(isEnd && !dateStr.includes("T") ? `${dateStr}T23:59:59.999Z` : dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

async function getValidAdminActorId(actorId?: string): Promise<string> {
  if (actorId && prisma.user?.findUnique) {
    const existing = await prisma.user.findUnique({ where: { id: actorId }, select: { id: true } });
    if (existing) return existing.id;
  }
  if (prisma.user?.findFirst) {
    const fallback = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    if (fallback) return fallback.id;
  }
  return "seed-admin-01";
}

export async function generateReconciliationReport(
  schoolId: string,
  startDate: string,
  endDate: string,
  format: "csv" | "pdf"
): Promise<{ url: string; count: number }> {
  if (isDemoMode()) return getDemoReportResult();

  const { adminId } = await requireAdminForSchool(schoolId);

  if (!rateLimit(`${adminId}:generateReconciliationReport`, { limit: 10, windowMs: 60 * 1000 })) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  const start = parseSafeDate(startDate, false);
  const end = parseSafeDate(endDate, true);

  const snapshot = await getLedgerSnapshot(schoolId, {
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
    limit: 10000,
  });

  const rangeTransactions = snapshot.transactions.map((t: any) => ({
    id: t.id,
    channel: t.channel,
    amount: Number(t.amount),
    reconciliationStatus: t.reconciliationStatus,
    postedAt: typeof t.postedAt === "string" ? t.postedAt : t.postedAt.toISOString(),
    studentName: t.studentName ?? t.student?.name,
    feeType: t.feeType ?? t.feeAssignment?.feeType?.name ?? "Tuition Fee",
  }));

  const labelStart = startDate || "all_time";
  const labelEnd = endDate || "today";
  const fileName = `reconciliation-${labelStart}-to-${labelEnd}-${Date.now()}.${format}`;
  const storagePath = `${schoolId}/${fileName}`;

  let fileBuffer: Buffer;
  let contentType: string;

  if (format === "csv") {
    const csvMeta = {
      schoolId,
      startDate: startDate || "all_time",
      endDate: endDate || "today",
      generatedAt: new Date().toISOString(),
    };
    fileBuffer = Buffer.from(toCsv(rangeTransactions, csvMeta), "utf-8");
    contentType = "text/csv";
  } else {
    const pdfStream = await renderToStream(
      React.createElement(ReconciliationReportPdf, {
        startDate: startDate || "All Time",
        endDate: endDate || "Today",
        totalCollected: snapshot.totalCollected,
        outstandingDuesTotal: snapshot.outstandingDuesTotal,
        transactions: rangeTransactions,
        schoolName: (snapshot as any).school?.name ?? schoolId,
      }) as any
    );
    const chunks: Buffer[] = [];
    for await (const chunk of pdfStream as unknown as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    fileBuffer = Buffer.concat(chunks);
    contentType = "application/pdf";
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from("reports")
    .upload(storagePath, fileBuffer, { contentType, upsert: true });

  let url = "";
  if (uploadError) {
    console.error("Failed to upload report to Supabase, falling back to data URL:", uploadError.message);
    const base64 = fileBuffer.toString("base64");
    url = `data:${contentType};base64,${base64}`;
  } else {
    const { data: publicUrlData } = supabaseAdmin.storage.from("reports").getPublicUrl(storagePath);
    url = publicUrlData.publicUrl;
  }

  const validActorId = await getValidAdminActorId(adminId);

  await prisma.auditLog.create({
    data: {
      actorId: validActorId,
      action: "report_exported",
      beforeState: {},
      afterState: { format, startDate: startDate || "all_time", endDate: endDate || "today", generatedCount: rangeTransactions.length },
    },
  });

  return { url, count: rangeTransactions.length };
}

/**
 * Generates an official Tally Prime XML Voucher Import file for all posted transactions.
 */
export async function exportTallyXmlReport(
  schoolId: string,
  startDate?: string,
  endDate?: string
): Promise<{ url: string; count: number }> {
  if (isDemoMode()) return getDemoReportResult();

  const { adminId } = await requireAdminForSchool(schoolId);

  const start = parseSafeDate(startDate, false);
  const end = parseSafeDate(endDate, true);

  const snapshot = await getLedgerSnapshot(schoolId, {
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
    limit: 10000,
  });

  const postedTransactions = snapshot.transactions.filter(
    (t: any) => t.reconciliationStatus === "posted"
  );

  const tallyVouchersXml = postedTransactions
    .map((t: any, index: number) => {
      const dateFormatted = t.postedAt
        ? new Date(t.postedAt).toISOString().split("T")[0]!.replace(/-/g, "")
        : new Date().toISOString().split("T")[0]!.replace(/-/g, "");
      const studentName = t.studentName ?? t.student?.name ?? "Student";
      const amountFormatted = Number(t.amount).toFixed(2);
      const debitLedger = t.channel.toUpperCase() === "CASH" ? "Cash Account" : "Bank Account";
      const feeTypeName = t.feeType ?? "Tuition Fee";

      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${dateFormatted}</DATE>
            <NARRATION>Fee Receipt for ${studentName} - ${feeTypeName} via ${t.channel.toUpperCase()}</NARRATION>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>RCP-${dateFormatted}-${String(index + 1).padStart(4, "0")}</VOUCHERNUMBER>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${debitLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amountFormatted}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${feeTypeName} Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amountFormatted}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`;
    })
    .join("\n");

  const fullXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        ${tallyVouchersXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const xmlBuffer = Buffer.from(fullXmlContent, "utf-8");
  const fileName = `Tally_Import_${startDate}_to_${endDate}_${Date.now()}.xml`;
  const storagePath = `${schoolId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("reports")
    .upload(storagePath, xmlBuffer, { contentType: "application/xml", upsert: true });

  let url = "";
  if (uploadError) {
    console.error("Failed to upload Tally XML to Supabase, falling back to data URL:", uploadError.message);
    const base64 = xmlBuffer.toString("base64");
    url = `data:application/xml;base64,${base64}`;
  } else {
    const { data: publicUrlData } = supabaseAdmin.storage.from("reports").getPublicUrl(storagePath);
    url = publicUrlData.publicUrl;
  }

  const validActorId = await getValidAdminActorId(adminId);

  await prisma.auditLog.create({
    data: {
      actorId: validActorId,
      action: "report_exported",
      beforeState: {},
      afterState: { format: "tally_xml", startDate: startDate || "all_time", endDate: endDate || "today", generatedCount: postedTransactions.length },
    },
  });

  return { url, count: postedTransactions.length };
}
