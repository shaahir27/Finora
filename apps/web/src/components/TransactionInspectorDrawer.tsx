"use client";

import { useEffect, useState } from "react";
import { getTransactionAuditHistory } from "@/app/actions/ledger";
import { X, FileText, Printer, ShieldCheck, Clock, User, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

interface TransactionInspectorDrawerProps {
  transactionId: string;
  onClose: () => void;
  onGenerateReceipt: (txId: string, format: "a4" | "thermal") => void;
  onOpenPosReceipt: (tx: any) => void;
}

export function TransactionInspectorDrawer({
  transactionId,
  onClose,
  onGenerateReceipt,
  onOpenPosReceipt,
}: TransactionInspectorDrawerProps) {
  const [data, setData] = useState<{ transaction: any; auditLogs: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getTransactionAuditHistory(transactionId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        toast.error("Failed to load transaction audit history");
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [transactionId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
        <div className="w-full max-w-md bg-[#F4F1EA] h-full p-6 shadow-2xl flex flex-col justify-center items-center">
          <div className="w-8 h-8 border-4 border-[#0F5A47] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-secondary font-bold mt-3">Loading Audit History...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { transaction, auditLogs } = data;
  const feeType = transaction.feeAssignment?.feeType;
  const amount = Number(transaction.amount);

  let gstAmount = 0;
  let baseAmount = amount;
  if (feeType?.gstTreatment === "taxable" && feeType?.gstRate) {
    const rate = Number(feeType.gstRate);
    gstAmount = Math.round(amount * (rate / (100 + rate)) * 100) / 100;
    baseAmount = amount - gstAmount;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs font-sans">
      <div className="w-full max-w-lg bg-[#F4F1EA] h-full shadow-2xl flex flex-col overflow-hidden border-l border-border-glass">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-white border-b border-border-glass flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0F5A47]" />
            <div>
              <h2 className="text-sm font-extrabold text-[#0F172A]">Transaction Audit Inspector</h2>
              <p className="text-[10px] font-mono text-text-secondary">#{transaction.refNumber || transaction.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 text-text-secondary hover:text-text-primary transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Status & Amount Card */}
          <div className="p-4 rounded-2xl bg-white border border-[#0F5A47]/20 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">
                Transaction Amount
              </span>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                  transaction.reconciliationStatus === "posted"
                    ? "bg-[#059669]/10 text-[#059669] border border-[#059669]/20"
                    : transaction.reconciliationStatus === "cheque_pending"
                    ? "bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20"
                    : transaction.reconciliationStatus === "flagged"
                    ? "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20"
                    : "bg-[#64748B]/10 text-[#64748B] border border-[#64748B]/20"
                }`}
              >
                {transaction.reconciliationStatus}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-extrabold text-[#0F5A47]">
                ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
              <span className="text-xs font-extrabold uppercase text-text-primary bg-black/5 px-2.5 py-1 rounded-lg">
                {transaction.channel} Mode
              </span>
            </div>

            <div className="text-xs text-text-secondary pt-1 border-t border-border-glass flex justify-between">
              <span>Posted: {new Date(transaction.postedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Student & Fee Details */}
          <div className="p-4 rounded-2xl bg-white border border-border-glass space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-[#475569] tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#0F5A47]" />
              Student & Allocation Context
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-text-secondary font-semibold block">Student Name</span>
                <span className="font-extrabold text-[#0F172A]">{transaction.student?.name || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary font-semibold block">Admission / Class</span>
                <span className="font-extrabold text-[#0F172A]">
                  {transaction.student?.admissionNumber || "N/A"} ({transaction.student?.class || "N/A"})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary font-semibold block">Fee Head</span>
                <span className="font-bold text-[#0F5A47]">{feeType?.name || "General Fee"}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary font-semibold block">Category</span>
                <span className="font-bold text-[#0F172A]">{feeType?.category || "General"}</span>
              </div>
            </div>
          </div>

          {/* Itemized GST Breakdown */}
          <div className="p-4 rounded-2xl bg-white border border-border-glass space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-[#475569] tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#0F5A47]" />
              Itemized Tax & Accounting Breakdown
            </h4>
            <div className="space-y-2 text-xs divide-y divide-black/5">
              <div className="flex justify-between py-1">
                <span className="text-text-secondary font-semibold">GST Treatment</span>
                <span className="font-extrabold uppercase text-[#0F172A]">{feeType?.gstTreatment || "exempt"}</span>
              </div>
              {feeType?.gstTreatment === "taxable" && (
                <>
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary font-semibold">GST Rate Applied</span>
                    <span className="font-extrabold text-[#0F172A]">{Number(feeType?.gstRate || 0)}%</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary font-semibold">Base Fee Amount</span>
                    <span className="font-bold text-[#0F172A]">₹{baseAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-[#0F5A47]">
                    <span className="font-extrabold">GST Component (Inclusive)</span>
                    <span className="font-extrabold">₹{gstAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chronological Audit Trail Timeline */}
          <div className="p-4 rounded-2xl bg-white border border-border-glass space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-[#475569] tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#0F5A47]" />
              Immutable Audit History ({auditLogs.length})
            </h4>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-text-secondary italic">No audit logs recorded for this entry.</p>
            ) : (
              <div className="space-y-3 pl-2 border-l-2 border-[#0F5A47]/20">
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative pl-4 space-y-1">
                    <div className="absolute -left-[17px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#0F5A47]" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#0F172A] uppercase">{log.action}</span>
                      <span className="text-[10px] text-text-secondary font-medium">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary font-medium">Actor: {log.actorEmail}</p>
                    {log.afterState?.reason && (
                      <p className="text-[11px] text-[#0F5A47] font-semibold bg-[#0F5A47]/5 p-1.5 rounded-lg border border-[#0F5A47]/10">
                        Reason: {log.afterState.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Quick Actions Footer */}
        <div className="p-4 bg-white border-t border-border-glass flex gap-3">
          <button
            onClick={() => onGenerateReceipt(transaction.id, "a4")}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white border border-border-glass text-xs font-bold text-text-primary hover:bg-black/5 flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <FileText className="w-4 h-4 text-[#0F5A47]" />
            A4 PDF
          </button>
          <button
            onClick={() => onOpenPosReceipt(transaction)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold shadow-md hover:opacity-95 flex items-center justify-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4" />
            Thermal POS
          </button>
        </div>
      </div>
    </div>
  );
}
