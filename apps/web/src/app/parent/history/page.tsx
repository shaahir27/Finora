"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/GlassCard";
import { getMyPaymentHistory, getMyChildrenDues } from "@/app/actions/parents";
import { generateReceipt, generate80CTaxCertificateAction } from "@/app/actions/receipts";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import toast from "react-hot-toast";
import { Download, Users, FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default function ParentHistoryPage() {
  const t = useTranslations("History");
  const { data: session } = useSession();
  const [selectedStudentName, setSelectedStudentName] = useState<string>("ALL");
  const [receiptFormat, setReceiptFormat] = useState<"a4" | "thermal">("a4");

  const parentUserId = session?.user?.id || "demo-parent-id";

  const dataState = useDataState({
    queryKey: ["parentHistory", parentUserId],
    queryFn: async () => {
      const historyData = await getMyPaymentHistory();
      return {
        students: historyData.students || [],
        transactions: historyData.transactions || [],
      };
    },
    enabled: true,
  });

  const handleDownload = async (txId: string) => {
    try {
      const res = await generateReceipt(txId, receiptFormat);
      window.open(res.pdfUrl, "_blank");
      toast.success(`Generated ${receiptFormat.toUpperCase()} Receipt PDF`);
    } catch (e: any) {
      toast.error(`Error generating receipt: ${e.message}`);
    }
  };

  const handleDownload80C = async (studentId?: string) => {
    try {
      const targetId = studentId || (dataState.state === "synced" ? dataState.data.students[0]?.id : undefined);
      if (!targetId) throw new Error("No linked student found.");
      const res = await generate80CTaxCertificateAction(targetId, "2025-26");
      toast.success(`Section 80C Certificate (FY ${res.financialYear}): ₹${res.totalTuitionFeePaid.toLocaleString("en-IN")} Pure Tuition Fee Claimable`);
    } catch (e: any) {
      toast.error(`Tax Certificate Error: ${e.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-[#059669]/10 text-[#059669] border border-[#059669]/20 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Posted
          </span>
        );
      case "flagged":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-red-500/10 text-red-600 border border-red-500/20 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Flagged
          </span>
        );
      case "reversed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            Reversed
          </span>
        );
      case "cheque_pending":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Cheque Pending
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-slate-500/10 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            {t("title")}
          </h1>
          <p className="text-text-secondary text-sm mt-0.5 font-medium">
            Verified transaction ledger and official digital receipt downloads.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => handleDownload80C()}
            className="px-3 py-1.5 rounded-xl bg-[#0F5A47] hover:bg-[#093C2F] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Section 80C Tax Cert (FY 2025-26)</span>
          </button>

          {/* Receipt Format Preference */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#0F5A47]/20 text-xs shadow-sm">
            <span className="font-bold text-text-secondary">Format:</span>
            <select
              value={receiptFormat}
              onChange={(e) => setReceiptFormat(e.target.value as any)}
              className="bg-transparent font-bold text-[#0F5A47] focus:outline-none"
            >
              <option value="a4">Standard A4 PDF</option>
              <option value="thermal">Thermal POS Receipt</option>
            </select>
          </div>
        </div>
      </div>

      <FiveStateRenderer state={dataState}>
        {({ students, transactions }) => {
          const displayedTransactions =
            selectedStudentName === "ALL"
              ? transactions
              : transactions.filter((t: any) => t.studentName === selectedStudentName);

          return (
            <div className="space-y-6">
              {/* Child Switcher Toggle Bar */}
              {students.length > 0 && (
                <div className="p-1.5 bg-[#EBE7DF] rounded-2xl flex overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap gap-1.5 border border-[#0F5A47]/15">
                  <button
                    onClick={() => setSelectedStudentName("ALL")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedStudentName === "ALL"
                        ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                        : "text-text-secondary hover:text-text-primary hover:bg-white/50"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    All Children ({transactions.length} Payments)
                  </button>
                  {students.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentName(s.name)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedStudentName === s.name
                          ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/50"
                      }`}
                    >
                      <span>👦</span>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Transactions Ledger Container */}
              <GlassCard className="p-0 overflow-hidden border-[#0F5A47]/15">
                {displayedTransactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="w-8 h-8 text-text-secondary mx-auto mb-2 opacity-60" />
                    <p className="text-sm font-bold text-text-primary">No payment history found.</p>
                    <p className="text-xs text-text-secondary mt-1">Payments recorded via UPI, Cash, or Cheque will appear here.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile View (< 640px): Touch-Friendly Stack Cards */}
                    <div className="block sm:hidden divide-y divide-border-glass bg-white/60">
                      {displayedTransactions.map((tx: any) => (
                        <div key={tx.id} className="p-4 space-y-3 hover:bg-[#0F5A47]/5 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-extrabold text-text-primary">{tx.feeType}</p>
                              <p className="text-[11px] font-semibold text-text-secondary mt-0.5">
                                {tx.studentName} • {new Date(tx.postedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-extrabold text-[#0F172A]">₹{Number(tx.amount).toLocaleString("en-IN")}</p>
                              <span className="inline-block uppercase font-bold text-[#0F5A47] tracking-wider text-[9px] mt-0.5">
                                {tx.channel}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>{getStatusBadge(tx.status)}</div>
                            {tx.status === "posted" && (
                              <button
                                onClick={() => handleDownload(tx.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F5A47] font-bold text-xs hover:bg-[#0F5A47]/10 active:scale-95 transition-all shadow-xs min-h-[36px]"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Receipt PDF
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop View (≥ 640px): Structured Data Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[11px] uppercase font-bold text-text-secondary bg-[#EBE7DF]/60 border-b border-border-glass">
                          <tr>
                            <th className="px-6 py-3.5">Date</th>
                            <th className="px-6 py-3.5">Student</th>
                            <th className="px-6 py-3.5">Fee Item</th>
                            <th className="px-6 py-3.5">Channel</th>
                            <th className="px-6 py-3.5 text-right">Amount</th>
                            <th className="px-6 py-3.5 text-center">Status</th>
                            <th className="px-6 py-3.5 text-right">Official Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-glass bg-white/60">
                          {displayedTransactions.map((tx: any) => (
                            <tr key={tx.id} className="hover:bg-[#0F5A47]/5 transition-colors">
                              <td className="px-6 py-4 font-semibold text-text-primary whitespace-nowrap">
                                {new Date(tx.postedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-6 py-4 font-bold text-text-primary">
                                {tx.studentName}
                              </td>
                              <td className="px-6 py-4 font-medium text-text-primary">
                                {tx.feeType}
                              </td>
                              <td className="px-6 py-4 uppercase font-bold text-[#0F5A47] tracking-wider text-[10px]">
                                {tx.channel}
                              </td>
                              <td className="px-6 py-4 text-right font-extrabold text-base text-[#0F172A]">
                                ₹{Number(tx.amount).toLocaleString("en-IN")}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {getStatusBadge(tx.status)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {tx.status === "posted" && (
                                  <button
                                    onClick={() => handleDownload(tx.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F5A47] font-bold text-xs hover:bg-[#0F5A47]/10 transition-all shadow-sm"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Receipt PDF
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </GlassCard>
            </div>
          );
        }}
      </FiveStateRenderer>
    </div>
  );
}
