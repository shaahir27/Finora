"use client";

import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { generateReconciliationReport } from "@/app/actions/reports";

const SCHOOL_ID = process.env.NEXT_PUBLIC_DEMO_SCHOOL_ID ?? "demo-school";

export default function AdminReportsPage() {
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]!);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (format: "csv" | "pdf") => {
    try {
      setLoading(true);
      setError(null);
      const res = await generateReconciliationReport(SCHOOL_ID, startDate, endDate, format);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Reports & Export</h1>
        <p className="text-text-secondary mt-1">Generate reconciliation reports for a specific date range.</p>
      </div>

      <GlassCard className="p-6 space-y-4">
        {error && (
          <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-border-glass rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white/5 border border-border-glass rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            onClick={() => handleGenerate("csv")}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-border-glass rounded-lg text-text-primary transition-colors disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleGenerate("pdf")}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 rounded-lg border border-accent-primary/20 bg-accent-primary/5 space-y-2">
            <h3 className="text-accent-primary font-medium">Report Generated Successfully</h3>
            <p className="text-text-secondary text-sm">
              Found {result.count} transactions in the selected date range.
            </p>
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-accent-primary text-sm font-medium underline"
            >
              Download Report
            </a>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
