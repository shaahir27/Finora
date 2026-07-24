"use client";

/**
 * Admin — Receipts
 * Displays a list of posted transactions that don't have receipts yet, 
 * and allows generating them. Also shows generated receipts.
 */

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { generateReceipt } from "@/app/actions/receipts";

// We'll fetch transactions directly for demo purposes (usually would be a server action like getReceiptsQueue)
import { getLedgerSnapshot } from "@/app/actions/ledger";

const SCHOOL_ID = process.env.NEXT_PUBLIC_DEMO_SCHOOL_ID ?? "demo-school";

export default function AdminReceiptsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const data = await getLedgerSnapshot(SCHOOL_ID);
      // Filter to just posted ones
      setTransactions(data.transactions.filter((t: any) => t.reconciliationStatus === "posted"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleGenerate = async (txId: string, format: "a4" | "thermal") => {
    try {
      const res = await generateReceipt(txId, format);
      window.open(res.pdfUrl, "_blank");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Receipts</h1>
        <p className="text-text-secondary mt-1">Generate and download GST-compliant PDF receipts.</p>
      </div>

      <GlassCard className="p-6">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin border-accent-primary/40" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border-glass text-text-secondary">
                  <th className="pb-3 font-medium pl-4">Transaction ID</th>
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Channel</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border-glass/50 hover:bg-white/5 transition-colors">
                    <td className="py-4 pl-4 font-mono text-xs text-text-secondary">
                      {tx.id.split("-")[0]}...
                    </td>
                    <td className="py-4 font-medium text-text-primary">{tx.studentName}</td>
                    <td className="py-4 text-text-secondary capitalize">{tx.channel}</td>
                    <td className="py-4 text-text-primary font-medium">₹{tx.amount}</td>
                    <td className="py-4 text-text-secondary">
                      {new Date(tx.postedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-right pr-4 space-x-2">
                      <button
                        onClick={() => handleGenerate(tx.id, "a4")}
                        className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-border-glass rounded-lg text-text-primary transition-colors"
                      >
                        A4
                      </button>
                      <button
                        onClick={() => handleGenerate(tx.id, "thermal")}
                        className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-border-glass rounded-lg text-text-primary transition-colors"
                      >
                        Thermal
                      </button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-secondary">
                      No posted transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
