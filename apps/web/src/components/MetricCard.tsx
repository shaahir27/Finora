import { GlassCard } from "./GlassCard";

interface MetricCardProps {
  label: string;
  value: string | number;
  deltaText?: string;
  isPositiveDelta?: boolean;
}

export function MetricCard({ label, value, deltaText, isPositiveDelta }: MetricCardProps) {
  return (
    <GlassCard weight="hero" className="flex flex-col gap-2">
      <div className="text-sm font-medium text-text-secondary uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold text-text-primary">{value}</div>
      {deltaText && (
        <div className={`text-sm font-medium ${isPositiveDelta ? "text-status-posted" : "text-status-flagged"}`}>
          {deltaText}
        </div>
      )}
    </GlassCard>
  );
}
