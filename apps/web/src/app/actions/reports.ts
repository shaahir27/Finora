"use server";

import { getLedgerSnapshot } from "./ledger";
import { prisma } from "@smart-school/db";
import { rateLimit } from "@/lib/rateLimit";

const MOCK_ADMIN_ID = "admin-123";

export async function generateReconciliationReport(
  schoolId: string,
  startDate: string,
  endDate: string,
  format: "csv" | "pdf"
): Promise<{ url: string; count: number }> {
  // Rate limit: same as AI endpoints
  if (!rateLimit(`${MOCK_ADMIN_ID}:generateReconciliationReport`, { limit: 10, windowMs: 60 * 1000 })) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Pass date range into getLedgerSnapshot so aggregate metrics (totalCollected,
  // outstandingDuesTotal) reflect the report period — not school-wide totals.
  // Fix: previously dates were not passed and the snapshot was filtered in-memory AFTER fetching,
  // meaning the header metrics always showed school-wide figures regardless of date range.
  const snapshot = await getLedgerSnapshot(schoolId, {
    startDate: start,
    endDate: end,
    limit: 10000, // unbounded for demo report export
  });

  const rangeTransactions = snapshot.transactions;

  // In a real app, we'd generate a CSV or PDF buffer here and upload to Supabase Storage.
  // For the demo, we'll stub the URL but we MUST generate the AUDIT_LOG row.
  const fileExt = format;
  const fileName = `reconciliation-${startDate}-to-${endDate}.${fileExt}`;
  const url = `https://storage.dummy.com/reports/${fileName}`;

  // Log to AUDIT_LOG per Session 1 requirement extended in Session 6
  await prisma.auditLog.create({
    data: {
      actorId: MOCK_ADMIN_ID,
      action: "report_exported",
      beforeState: {},
      afterState: { format, startDate, endDate, generatedCount: rangeTransactions.length },
    },
  });

  return { url, count: rangeTransactions.length };
}

