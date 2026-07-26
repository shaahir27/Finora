"use client";

import { GlassCard } from "@/components/GlassCard";
import { generateReceipt } from "@/app/actions/receipts";
import { getLedgerSnapshot } from "@/app/actions/ledger";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";

export default function AdminReceiptsPage() {
  const schoolId = DEMO_SCHOOL_ID;

  const state = useDataState({
    queryKey: ["receiptsQueue", schoolId],
    queryFn: async () => {
      const data = await getLedgerSnapshot(schoolId);
      return data.transactions.filter((t: any) => t.reconciliationStatus === "posted");
    },
  });

  const handleGenerate = async (txId: string, format: "a4" | "thermal") => {
    const win = window.open("about:blank", "_blank");
    try {
      const res = await generateReceipt(txId, format);
      if (win) {
        win.location.href = res.pdfUrl;
      } else {
        window.location.href = res.pdfUrl;
      }
    } catch (e: any) {
      if (win) win.close();
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Receipts</h1>
        <p className="text-text-secondary mt-1">Generate and download GST-compliant PDF receipts.</p>
      </div>

      <FiveStateRenderer state={state}>
        {(transactions) => (
          <GlassCard className="p-6">
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
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-border-glass/50 hover:bg-white/5 transition-colors">
                      <td className="py-4 pl-4 font-mono text-xs text-text-secondary">
                        {tx.id.split("-")[0]}...
                      </td>
                      <td className="py-4 font-medium text-text-primary">{tx.studentName ?? tx.student?.name}</td>
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
          </GlassCard>
        )}
      </FiveStateRenderer>
    </div>
  );
}
