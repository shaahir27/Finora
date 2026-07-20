import { ButtonHTMLAttributes } from "react";

interface QuickActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function QuickActionButton({ label, className = "", ...props }: QuickActionButtonProps) {
  return (
    <button
      {...props}
      className={`px-4 py-2 text-sm font-medium rounded-md border border-border-glass bg-surface-glass text-text-primary hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-base disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {label}
    </button>
  );
}
