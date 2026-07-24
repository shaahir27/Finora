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

  // Get the same snapshot used by the dashboard to ensure figure parity
  const snapshot = await getLedgerSnapshot(schoolId, { limit: 10000 }); // Unbounded for report in demo

  // Filter snapshot to the requested date range
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const rangeTransactions = snapshot.transactions.filter(
    (t) => t.postedAt >= start && t.postedAt <= end
  );

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
