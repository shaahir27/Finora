"use client";

import { ButtonHTMLAttributes } from "react";
import toast from "react-hot-toast";

interface QuickActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function QuickActionButton({ label, className = "", ...props }: QuickActionButtonProps) {
  return (
    <button
      {...props}
      className={`px-3.5 py-2 text-xs font-bold rounded-xl border border-[#0F5A47]/20 bg-white text-[#0F5A47] hover:bg-[#0F5A47] hover:text-white shadow-xs active:scale-95 transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {label}
    </button>
  );
}
