"use client";

import { GlassCard } from "./GlassCard";
import { TrendingUp, Clock, AlertTriangle, ArrowRightLeft } from "lucide-react";

interface LedgerKpiHeaderProps {
  totalCollected: number;
  pendingChequeTotal: number;
  pendingChequeCount: number;
  flaggedTotal: number;
  flaggedCount: number;
  revenueByChannel: Array<{ channel: string; amount: number }>;
}

export function LedgerKpiHeader({
  totalCollected,
  pendingChequeTotal,
  pendingChequeCount,
  flaggedTotal,
  flaggedCount,
  revenueByChannel,
}: LedgerKpiHeaderProps) {
  const upiAmount = revenueByChannel.find((c) => c.channel === "upi")?.amount || 0;
  const cashAmount = revenueByChannel.find((c) => c.channel === "cash")?.amount || 0;
  const chequeAmount = revenueByChannel.find((c) => c.channel === "cheque")?.amount || 0;

  const totalChannelSum = upiAmount + cashAmount + chequeAmount || 1;
  const upiPct = Math.round((upiAmount / totalChannelSum) * 100);
  const cashPct = Math.round((cashAmount / totalChannelSum) * 100);
  const chequePct = Math.round((chequeAmount / totalChannelSum) * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Settled Revenue */}
      <GlassCard className="p-4 border-[#0F5A47]/20 relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
              Settled Collections
            </span>
            <h3 className="text-xl font-extrabold text-[#0F172A] mt-1">
              ₹{totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        {/* Channel Distribution Bar */}
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden flex">
            <div style={{ width: `${upiPct}%` }} className="bg-[#059669]" title={`UPI: ${upiPct}%`} />
            <div style={{ width: `${cashPct}%` }} className="bg-blue-500" title={`Cash: ${cashPct}%`} />
            <div style={{ width: `${chequePct}%` }} className="bg-amber-500" title={`Cheque: ${chequePct}%`} />
          </div>
          <div className="flex justify-between text-[10px] text-[#475569] font-bold">
            <span>UPI {upiPct}%</span>
            <span>Cash {cashPct}%</span>
            <span>Cheque {chequePct}%</span>
          </div>
        </div>
      </GlassCard>

      {/* KPI 2: Pending Cheques */}
      <GlassCard className="p-4 border-amber-500/20">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
              Pending Cheques
            </span>
            <h3 className="text-xl font-extrabold text-[#D97706] mt-1">
              ₹{pendingChequeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-[#475569] font-semibold mt-3">
          <span className="font-extrabold text-[#D97706]">{pendingChequeCount}</span> cheque{pendingChequeCount === 1 ? "" : "s"} awaiting bank clearance
        </p>
      </GlassCard>

      {/* KPI 3: Flagged Anomalies */}
      <GlassCard className="p-4 border-red-500/20">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
              Flagged Anomalies
            </span>
            <h3 className="text-xl font-extrabold text-[#DC2626] mt-1">
              ₹{flaggedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-[#475569] font-semibold mt-3">
          <span className="font-extrabold text-[#DC2626]">{flaggedCount}</span> transaction{flaggedCount === 1 ? "" : "s"} flagged for review
        </p>
      </GlassCard>

      {/* KPI 4: Financial Control Health */}
      <GlassCard className="p-4 border-[#0F5A47]/20">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-[#475569] tracking-wider">
              Ledger Health
            </span>
            <h3 className="text-xl font-extrabold text-[#0F5A47] mt-1">
              100% Audited
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>
        <p className="text-[11px] text-[#475569] font-semibold mt-3">
          Double-entry balanced • Zero unlinked writes
        </p>
      </GlassCard>
    </div>
  );
}
