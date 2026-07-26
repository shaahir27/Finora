import { GlassCard } from "./GlassCard";

interface MetricCardProps {
  label: string;
  value: string | number;
  deltaText?: string;
  isPositiveDelta?: boolean;
}

export function MetricCard({ label, value, deltaText, isPositiveDelta }: MetricCardProps) {
  return (
    <GlassCard weight="hero" className="flex flex-col gap-2 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
      <div className="text-xs font-extrabold text-text-secondary uppercase tracking-wider">{label}</div>
      <div className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">{value}</div>
      {deltaText && (
        <div className={`text-xs font-semibold ${isPositiveDelta ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {deltaText}
        </div>
      )}
    </GlassCard>
  );
}
