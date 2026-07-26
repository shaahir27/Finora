"use client";

import { GlassCard } from "./GlassCard";
import { Smartphone, Banknote, FileCheck } from "lucide-react";

interface ChannelData {
  channel: string;
  amount: number;
}

interface ChannelBarChartProps {
  data: ChannelData[];
}

export function ChannelBarChart({ data }: ChannelBarChartProps) {
  const total = data.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case "upi":
        return <Smartphone className="w-4 h-4 text-[#0F5A47]" />;
      case "cash":
        return <Banknote className="w-4 h-4 text-[#059669]" />;
      case "cheque":
        return <FileCheck className="w-4 h-4 text-[#D97706]" />;
      default:
        return <Smartphone className="w-4 h-4 text-[#0F5A47]" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel.toLowerCase()) {
      case "upi":
        return "bg-[#0F5A47]";
      case "cash":
        return "bg-[#059669]";
      case "cheque":
        return "bg-[#D97706]";
      default:
        return "bg-[#0F5A47]";
    }
  };

  return (
    <GlassCard className="p-6 h-full flex flex-col justify-between border-[#0F5A47]/15">
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Revenue by Channel</h3>
            <p className="text-xs text-text-secondary mt-0.5">Real-time payment method distribution</p>
          </div>
          <span className="text-xs font-bold text-[#0F5A47] bg-[#0F5A47]/10 px-2.5 py-1 rounded-full border border-[#0F5A47]/20">
            Total ₹{total.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="space-y-4 mt-6">
          {data.map((item) => {
            const amount = Number(item.amount) || 0;
            const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
            const channelName = item.channel.toUpperCase();

            return (
              <div key={item.channel} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-2 text-text-primary capitalize">
                    {getChannelIcon(item.channel)}
                    {channelName}
                  </span>
                  <span className="text-text-primary font-bold">
                    ₹{amount.toLocaleString('en-IN')} <span className="text-text-secondary font-medium ml-1">({percentage}%)</span>
                  </span>
                </div>
                <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getChannelColor(item.channel)} transition-all duration-500 rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-border-glass flex justify-between text-[11px] text-text-secondary font-medium">
        <span>Channel Sync Status: Live</span>
        <span className="text-[#059669] font-bold">✓ Verified Ledger</span>
      </div>
    </GlassCard>
  );
}