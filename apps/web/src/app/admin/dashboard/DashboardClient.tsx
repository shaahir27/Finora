"use client";

import { useEffect, useState } from "react";
import { getLedgerSnapshot } from "@/app/actions/ledger";
import { generateReconciliationReport, exportTallyXmlReport } from "@/app/actions/reports";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { MetricCard } from "@/components/MetricCard";
import { ChannelBarChart } from "@/components/ChannelBarChart";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FileText, X, Download, BarChart2, ShieldCheck, DollarSign } from "lucide-react";
import { answerDashboardQueryAction } from "@/app/actions/ai";
import { DemoScenarioSwitcher, ScenarioKey } from "@/components/DemoScenarioSwitcher";

export function DashboardClient({ schoolId }: { schoolId: string }) {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("standard");
  const [realtimeLive, setRealtimeLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const router = useRouter();

  // Reports Drawer State
  const [isReportsDrawerOpen, setIsReportsDrawerOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
  );
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split("T")[0]!);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<{ url: string; count: number } | null>(null);

  const handleGenerateReport = async (format: "csv" | "pdf" | "tally") => {
    try {
      setReportLoading(true);
      if (format === "tally") {
        const res = await exportTallyXmlReport(schoolId, reportStartDate, reportEndDate);
        setReportResult(res);
        toast.success(`Exported Tally Prime XML with ${res.count} vouchers`);
      } else {
        const res = await generateReconciliationReport(schoolId, reportStartDate, reportEndDate, format);
        setReportResult(res);
        toast.success(`Generated ${format.toUpperCase()} report with ${res.count} records`);
      }
    } catch (err: any) {
      toast.error(err.message || "Report generation failed");
    } finally {
      setReportLoading(false);
    }
  };

  // Subscribe to realtime updates on the transactions table
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `school_id=eq.${schoolId}` },
        () => {
          setLastUpdate(Date.now());
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeLive(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setRealtimeLive(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId]);

  const state = useDataState({
    queryKey: ['ledgerSnapshot', schoolId, lastUpdate],
    queryFn: () => getLedgerSnapshot(schoolId, { limit: 10 }),
    isRealtimeLive: realtimeLive,
  });

  const handleExport = () => {
    if (state.state === "synced" || state.state === "stale" || state.state === "conflict") {
      const generatedAt = new Date().toISOString();
      const today = generatedAt.split("T")[0];
      const d = state.data;

      // ── Metadata block (industry standard: # prefixed comment rows) ──
      const metaRows = [
        `# Report: Finora Executive Dashboard Summary`,
        `# School ID: ${schoolId}`,
        `# Generated: ${generatedAt}`,
        `# Currency: INR`,
        `# Encoding: UTF-8`,
      ];

      // ── Summary metrics (snake_case headers) ──
      const summaryHeader = ["metric_name", "value_inr", "currency_code", "report_date"];
      const summaryRows = [
        ["total_collected_today", String(Number(d.totalCollected).toFixed(2)), "INR", today],
        ["outstanding_dues_total", String(Number(d.outstandingDuesTotal).toFixed(2)), "INR", today],
        ["flagged_transactions_count", String(d.reconciliationStats?.flaggedCount ?? 0), "COUNT", today],
        ["total_transactions_count", String(d.transactions?.length ?? 0), "COUNT", today],
      ].map((r) => r.join(","));

      // ── Separator + Transaction ledger (if available) ──
      const txHeader = ["transaction_date", "student_name", "fee_type", "payment_channel", "base_amount_inr", "currency_code", "reconciliation_status"];
      const txRows = (d.transactions ?? []).map((t: any) => [
        new Date(t.postedAt).toISOString().split("T")[0],
        `"${(t.studentName ?? t.student?.name ?? "").replace(/"/g, '""')}"`,
        `"${(t.feeType ?? "Tuition Fee").replace(/"/g, '""')}"`,
        (t.channel ?? "").toUpperCase(),
        Number(t.amount).toFixed(2),
        "INR",
        t.reconciliationStatus ?? "",
      ].join(","));

      const csvContent = [
        ...metaRows,
        "",
        "# === SUMMARY METRICS ===",
        summaryHeader.join(","),
        ...summaryRows,
        "",
        "# === TRANSACTION LEDGER ===",
        txHeader.join(","),
        ...txRows,
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Finora_Dashboard_${schoolId}_${today}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Dashboard data exported as industry-standard CSV");
    } else {
      toast.error("Data not loaded yet");
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Executive Dashboard</h1>
          <p className="text-text-secondary text-sm">Real-time financial cockpit & intelligent insights.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsReportsDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F5A47]/10 hover:bg-[#0F5A47]/20 text-[#0F5A47] border border-[#0F5A47]/20 font-medium text-sm transition-all"
          >
            <FileText className="w-4 h-4" />
            Generate Reports
          </button>
          <QuickActionButton label="Record Payment" onClick={() => router.push("/admin/students")} />
          <QuickActionButton label="Quick Export" onClick={handleExport} />
        </div>
      </div>

      {/* Main Metrics & Data */}
      <FiveStateRenderer state={state}>
        {(data) => {
          let totalColl = data.totalCollected;
          let outDues = data.outstandingDuesTotal;
          let matchRate = data.reconciliationStats.matchPercentage;
          let flaggedCount = data.reconciliationStats.flaggedCount;

          if (activeScenario === "end_of_month") {
            totalColl = 450000;
            outDues = 85000;
            matchRate = 98.4;
            flaggedCount = 3;
          } else if (activeScenario === "high_risk") {
            totalColl = 45000;
            outDues = 320000;
            matchRate = 92.0;
            flaggedCount = 14;
          } else if (activeScenario === "tally_peak") {
            totalColl = 295000;
            outDues = 110000;
            matchRate = 100.0;
            flaggedCount = 0;
          }

          return (
            <div className="space-y-6">
              {/* Judge Scenario Switcher Bar */}
              <DemoScenarioSwitcher
                activeScenario={activeScenario}
                onSelectScenario={(sc) => setActiveScenario(sc)}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard 
                  label="Total Collected Today" 
                  value={`₹${totalColl.toLocaleString('en-IN')}`} 
                  deltaText={`Scenario: ${activeScenario.toUpperCase().replace('_', ' ')}`}
                  isPositiveDelta={true}
                />
                <MetricCard 
                  label="Outstanding Dues" 
                  value={`₹${outDues.toLocaleString('en-IN')}`} 
                  deltaText={outDues > 150000 ? "High Dues Alert" : "Normal Operating Band"}
                  isPositiveDelta={outDues <= 150000}
                />
                <MetricCard 
                  label="Reconciliation Match Rate" 
                  value={`${matchRate}%`} 
                  deltaText={`${flaggedCount} flagged items`}
                  isPositiveDelta={flaggedCount === 0}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ChannelBarChart data={data.revenueByChannel} />
                </div>
                <div>
                  <GlassCard className="h-full flex flex-col justify-between p-6">
                    <div>
                      <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Recent Transactions Snapshot</h3>
                      <p className="text-text-secondary text-sm mb-4">
                        {data.transactions.length} recent entries loaded in real-time.
                      </p>
                      <div className="space-y-2">
                        {data.transactions.slice(0, 4).map((tx: any) => (
                          <div key={tx.id} className="flex justify-between items-center text-xs p-2 bg-white/60 rounded-lg border border-border-glass">
                            <span className="font-medium truncate max-w-[130px]">{tx.student?.name || 'Student'}</span>
                            <span className="font-bold text-[#0F5A47]">₹{tx.amount}</span>
                            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#0F5A47]/10 text-[#0F5A47] font-semibold">{tx.channel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => router.push("/admin/ledger")}
                      className="mt-4 text-xs font-semibold text-[#0F5A47] hover:underline flex items-center justify-center gap-1"
                    >
                      Open Master Ledger &rarr;
                    </button>
                  </GlassCard>
                </div>
              </div>
            </div>
          );
        }}
      </FiveStateRenderer>

      {/* Embedded Reports Drawer Overlay */}
      {isReportsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-xl bg-[#F4F1EA] h-full shadow-2xl overflow-y-auto flex flex-col border-l border-border-glass mobile-bottom-sheet">
            <div className="p-6 border-b border-border-glass bg-white/80 backdrop-blur flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-lg">Financial Reports Generator</h3>
                  <p className="text-xs text-text-secondary">Export reconciliation ledgers & Tally Prime XML</p>
                </div>
              </div>
              <button
                onClick={() => setIsReportsDrawerOpen(false)}
                className="p-2 rounded-xl hover:bg-black/5 text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              <div className="space-y-4 bg-white/60 p-4 rounded-2xl border border-border-glass">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Date Range Filter</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full bg-white border border-border-glass rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">End Date</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full bg-white border border-border-glass rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Export Format</h4>

                <button
                  onClick={() => handleGenerateReport("tally")}
                  disabled={reportLoading}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white hover:opacity-95 transition-all shadow-md flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">
                      XML
                    </div>
                    <div>
                      <h5 className="font-bold text-sm">Tally Prime XML Vouchers</h5>
                      <p className="text-xs text-white/80 font-medium">Direct XML vouchers for Tally accounting sync</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-white/80" />
                </button>

                <button
                  onClick={() => handleGenerateReport("pdf")}
                  disabled={reportLoading}
                  className="w-full p-4 rounded-2xl bg-white border border-border-glass hover:bg-black/5 transition-all flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm">
                      PDF
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-[#0F172A]">Audit Reconciliation PDF</h5>
                      <p className="text-xs text-text-secondary font-medium">Full formatted ledger statement</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-text-secondary" />
                </button>

                <button
                  onClick={() => handleGenerateReport("csv")}
                  disabled={reportLoading}
                  className="w-full p-4 rounded-2xl bg-white border border-border-glass hover:bg-black/5 transition-all flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                      CSV
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-[#0F172A]">Raw Journal Entries CSV</h5>
                      <p className="text-xs text-text-secondary font-medium">Excel compatible transaction logs</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {reportResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                  <span className="text-xs font-bold text-emerald-700 block">Report Ready!</span>
                  <p className="text-xs text-text-secondary font-medium">
                    Processed {reportResult.count} transactions for selected date range.
                  </p>
                  <a
                    href={reportResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#0D7A5F] font-semibold underline flex items-center gap-1"
                  >
                    Download Generated File &rarr;
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
