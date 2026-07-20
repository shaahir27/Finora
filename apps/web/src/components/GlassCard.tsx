import { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  weight?: "hero" | "standard" | "list-row";
  className?: string;
};

export function GlassCard({ children, weight = "standard", className = "" }: GlassCardProps) {
  const baseClass = 
    weight === "hero" ? "glass-hero" :
    weight === "list-row" ? "glass-list-row" :
    "glass-card";

  const paddingClass = weight === "list-row" ? "p-4" : "p-6";
  const roundedClass = weight === "list-row" ? "rounded-lg" : "rounded-xl";

  return (
    <div className={`${baseClass} ${paddingClass} ${roundedClass} ${className}`}>
      {children}
    </div>
  );
}
