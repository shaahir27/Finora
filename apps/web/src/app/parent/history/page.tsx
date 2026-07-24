"use client";

import { useEffect, useState, useMemo } from "react";
import { GlassCard } from "@/components/GlassCard";
import { getMyPaymentHistory, getMyChildrenDues } from "@/app/actions/parents";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

export default function ParentHistoryPage() {
  const t = useTranslations("History");
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [students, setStudents] = useState<{id: string, name: string}[]>([]);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const parentUserId = session?.user?.id;
    if (!parentUserId) {
      setLoading(false);
      return;
    }

    Promise.all([
      getMyChildrenDues(parentUserId),
      getMyPaymentHistory(parentUserId)
    ])
    .then(([duesData, historyData]) => {
      const map = new Map<string, string>();
      duesData.forEach(d => map.set(d.studentId, d.studentName));
      const studs = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
      setStudents(studs);
      
      setTransactions(historyData.transactions);
      
      if (studs.length > 0) {
        const first = studs[0];
        if (first) setSelectedStudentName(first.name);
      } else if (historyData.transactions.length > 0) {
        const firstTx = historyData.transactions[0];
        if (firstTx) setSelectedStudentName(firstTx.studentName);
      }
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [status, session]);

  const displayedTransactions = useMemo(() => {
    if (!selectedStudentName) return [];
    return transactions.filter(t => t.studentName === selectedStudentName);
  }, [transactions, selectedStudentName]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "posted": return "bg-status-posted text-white";
      case "flagged": return "bg-status-flagged text-white";
      case "reversed": return "bg-status-reversed text-white";
      case "cheque_pending": return "bg-status-cheque-pending text-white";
      default: return "bg-white/10 text-text-primary";
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(76,175,130,0.4)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t("title")}</h1>
        <p className="text-text-secondary mt-1">{t("subtitle")}</p>
      </div>

      {students.length > 1 && (
        <div className="flex space-x-2 border-b border-border-glass pb-2">
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentName(s.name)}
              className={`px-4 py-2 rounded-t-md transition-colors ${selectedStudentName === s.name ? 'bg-white/10 text-text-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:bg-white/5'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <GlassCard className="overflow-hidden">
        {displayedTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-text-secondary">No payment history found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-text-secondary bg-white/5 border-b border-border-glass">
                <tr>
                  <th className="px-6 py-4 font-medium">{t("date")}</th>
                  <th className="px-6 py-4 font-medium">Fee Type</th>
                  <th className="px-6 py-4 font-medium">{t("channel")}</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                  <th className="px-6 py-4 font-medium text-center">{t("status")}</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-glass">
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-text-primary whitespace-nowrap">
                      {new Date(tx.postedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-text-primary">
                      {tx.feeType}
                    </td>
                    <td className="px-6 py-4 text-text-secondary uppercase text-xs tracking-wider">
                      {tx.channel}
                    </td>
                    <td className="px-6 py-4 text-text-primary text-right font-medium">
                      ₹{tx.amount}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {tx.status === "posted" && (
                        <button className="text-xs text-accent-primary-text hover:text-white transition-colors border border-accent-primary-text/30 px-3 py-1 rounded-md hover:bg-accent-primary-text/10">
                          {t("download_receipt")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
