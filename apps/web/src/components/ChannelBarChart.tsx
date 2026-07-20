"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GlassCard } from "./GlassCard";

interface ChannelBarChartProps {
  data: { channel: string; amount: number }[];
}

export function ChannelBarChart({ data }: ChannelBarChartProps) {
  return (
    <GlassCard className="h-64 w-full flex flex-col">
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Revenue by Channel</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="channel" stroke="var(--color-text-secondary)" tick={{ fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} />
            <YAxis stroke="var(--color-text-secondary)" tick={{ fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
            <Tooltip
              cursor={{ fill: "var(--color-border-glass)" }}
              contentStyle={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border-glass)", borderRadius: "8px", color: "var(--color-text-primary)" }}
              itemStyle={{ color: "var(--color-accent-primary-text)" }}
              formatter={(value: number) => [`₹${value}`, "Amount"]}
            />
            <Bar dataKey="amount" fill="var(--color-accent-primary-text)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
