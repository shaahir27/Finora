"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";
import { getLedgerSnapshot } from "@/app/actions/ledger";

const SCHOOL_ID = process.env.NEXT_PUBLIC_DEMO_SCHOOL_ID ?? "demo-school";

export default function AdminLedgerPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const data = await getLedgerSnapshot(SCHOOL_ID);
      setTransactions(data.transactions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Ledger</h1>
        <p className="text-text-secondary mt-1">Full transaction history and financial records.</p>
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
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
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
                    <td className="py-4 text-text-primary font-medium">
                      {tx.type === "payment" ? "+" : "-"}₹{tx.amount}
                    </td>
                    <td className="py-4 text-text-secondary capitalize">{tx.type}</td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          tx.reconciliationStatus === "posted"
                            ? "bg-green-500/10 text-green-500"
                            : tx.reconciliationStatus === "failed"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-yellow-500/10 text-yellow-500"
                        }`}
                      >
                        {tx.reconciliationStatus}
                      </span>
                    </td>
                    <td className="py-4 text-text-secondary">
                      {new Date(tx.postedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-secondary">
                      No transactions found.
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
