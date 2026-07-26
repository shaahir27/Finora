"use client";

import { GlassCard } from "@/components/GlassCard";
import { playTactileSound } from "@/lib/playTactileSound";
import { X, Printer, CheckCircle2, Download } from "lucide-react";

interface PosReceiptModalProps {
  transaction: {
    id: string;
    postedAt: string;
    studentName?: string;
    channel: string;
    amount: number;
    refNumber?: string;
    feeType?: string;
    schoolName?: string;
  };
  onClose: () => void;
}

export function PosReceiptModal({ transaction, onClose }: PosReceiptModalProps) {
  const dateFormatted = new Date(transaction.postedAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const refId = transaction.refNumber || `TXN-${transaction.id.slice(-8).toUpperCase()}`;
  const receiptId = `RCP-${new Date(transaction.postedAt).getFullYear()}-${transaction.id.slice(-6).toUpperCase()}`;
  const channelLabel = (transaction.channel || "").toUpperCase().replace(/_/g, " ");
  const schoolName = transaction.schoolName || "DEMO INTERNATIONAL SCHOOL";
  const feeType = transaction.feeType || "Tuition Fee Installment";

  const handlePrint = () => {
    playTactileSound("export");
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* ── Outer Shell ── */}
      <GlassCard className="w-full max-w-md bg-[#F0EDE6] p-5 border-border-glass shadow-2xl space-y-4 font-sans print:shadow-none print:p-0 print:bg-white">

        {/* ── Modal Header ── */}
        <div className="flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0F5A47] flex items-center justify-center shadow-md">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#0F172A]">POS Thermal Receipt</h2>
              <p className="text-[10px] text-slate-500">80mm format • Ready to print</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* ── Thermal Receipt Paper ── */}
        <div
          className="bg-white rounded-2xl overflow-hidden shadow-inner border border-black/10"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Header stripe */}
          <div className="bg-[#0F172A] px-5 py-3 text-center">
            <p className="text-[11px] font-bold text-white tracking-widest uppercase">
              {schoolName}
            </p>
            <p className="text-[9px] text-white/60 mt-0.5">
              Affiliated to CBSE • School Code: 84920
            </p>
          </div>

          {/* Green accent */}
          <div className="h-1 bg-[#0F5A47]" />

          {/* Content */}
          <div className="px-5 py-4 space-y-3 text-slate-800">
            {/* ── Title ── */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <p className="text-[10px] font-bold text-[#0F5A47] tracking-widest uppercase">
                Fee Payment Receipt
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Official Tax Invoice</p>
            </div>

            {/* ── Transaction Meta ── */}
            <div className="space-y-1.5 text-[11px]">
              {[
                ["Receipt No.", receiptId],
                ["Ref. ID", refId],
                ["Date/Time", dateFormatted],
                ["Student", transaction.studentName || "—"],
                ["Mode", channelLabel],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-slate-500 shrink-0">{label}</span>
                  <span className="font-bold text-right truncate">{value}</span>
                </div>
              ))}
            </div>

            {/* ── Itemized ── */}
            <div className="border-y border-dashed border-slate-300 py-3 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-700">{feeType}</span>
                <span className="font-bold">₹{Number(transaction.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>GST — Exempt (SAC 9992)</span>
                <span>₹0.00</span>
              </div>
            </div>

            {/* ── Total ── */}
            <div className="bg-[#0F5A47] rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-bold text-white/70 uppercase tracking-wider">Total Paid</p>
                <p className="text-[9px] text-white/50 mt-0.5">Inclusive of all taxes</p>
              </div>
              <p className="text-lg font-extrabold text-white">
                ₹{Number(transaction.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* ── Status Badge ── */}
            <div className="flex items-center justify-center gap-1.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider">
                Posted to Ledger
              </span>
            </div>

            {/* ── Barcode ── */}
            <div className="border-t border-dashed border-slate-300 pt-3 text-center space-y-1.5">
              {/* Stylized barcode bars */}
              <div className="flex items-end justify-center gap-px h-8">
                {[3,1,2,1,4,1,2,3,1,2,1,3,2,1,4,1,2,1,3,1,2,4,1,2,1,3,2].map((h, i) => (
                  <div
                    key={i}
                    className="bg-[#0F172A]"
                    style={{
                      width: i % 4 === 0 ? "3px" : i % 3 === 0 ? "2px" : "1.5px",
                      height: `${(h / 4) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <p className="text-[8px] text-slate-400 font-mono tracking-widest">{receiptId}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                Verified by Finora Ledger Engine
              </p>
            </div>

            {/* ── Legal Footer ── */}
            <p className="text-[8px] text-slate-400 text-center leading-relaxed border-t border-dashed border-slate-300 pt-3">
              This is a computer-generated receipt.{" "}
              No physical signature is required.{"\n"}
              For billing queries, contact the school fee office.
            </p>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-black/5 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] shadow-md transition-all flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
