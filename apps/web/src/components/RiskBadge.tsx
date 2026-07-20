type RiskLevel = "high" | "medium" | "low";

interface RiskBadgeProps {
  level: RiskLevel;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const colorClass = 
    level === "high" ? "bg-risk-high text-text-primary" :
    level === "medium" ? "bg-risk-medium text-text-primary" :
    "bg-risk-low text-text-primary";
    
  return (
    <span className={`px-2 py-1 text-xs font-semibold uppercase rounded-full ${colorClass}`}>
      {level} RISK
    </span>
  );
}
