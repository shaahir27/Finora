"use client";

import { playTactileSound } from "@/lib/playTactileSound";
import { Sparkles, Check } from "lucide-react";

export type ScenarioKey = "standard" | "end_of_month" | "high_risk" | "tally_peak";

interface DemoScenarioSwitcherProps {
  activeScenario: ScenarioKey;
  onSelectScenario: (key: ScenarioKey) => void;
}

export function DemoScenarioSwitcher({
  activeScenario,
  onSelectScenario,
}: DemoScenarioSwitcherProps) {
  const scenarios: { key: ScenarioKey; label: string; icon: string }[] = [
    { key: "standard", label: "🟢 Baseline Mid-Month", icon: "🟢" },
    { key: "end_of_month", label: "🟡 End-of-Month Rush", icon: "🟡" },
    { key: "high_risk", label: "🔴 High Defaulter Alert", icon: "🔴" },
    { key: "tally_peak", label: "⚡ Tally Export Peak", icon: "⚡" },
  ];

  return (
    <div className="bg-white/90 border border-[#0F5A47]/20 p-3 rounded-2xl shadow-lg backdrop-blur-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#0F5A47] animate-spin" />
        <div>
          <span className="text-xs font-extrabold text-[#0F172A] block">Judge Preset Scenario Switcher</span>
          <span className="text-[10px] text-text-secondary font-medium">Switch live operational states in 1 click</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
        {scenarios.map((s) => {
          const isActive = activeScenario === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                playTactileSound("action");
                onSelectScenario(s.key);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                  : "bg-[#F4F1EA] text-[#0F172A] hover:bg-[#0F5A47]/10 border border-[#0F5A47]/15"
              }`}
            >
              <span>{s.label}</span>
              {isActive && <Check className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
