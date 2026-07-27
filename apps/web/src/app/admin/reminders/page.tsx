"use client";

/**
 * Reminders Queue — /admin/reminders
 * ui_ux_specification.md — ADMIN — Reminders Queue
 *
 * Displays the REMINDER_LOG queue. Admin reviews drafted text, marks as sent.
 * Stale reminders (dues already cleared) are visually flagged.
 *
 * Governing Principle 3: No reminder sends without an explicit human "mark sent" action.
 * This page is the UI surface for that human checkpoint.
 */

import { useState, useTransition, useCallback, useEffect } from "react";
import { getRemindersQueue, markReminderSent } from "@/app/actions/reminders";
import type { ReminderQueueItem } from "@/app/actions/reminders";
import { GlassCard } from "@/components/GlassCard";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";
import { buildWhatsAppPaymentUrl } from "@/lib/whatsapp";

// Hardcoded for demo — Session 6: derive from auth session
const SCHOOL_ID = DEMO_SCHOOL_ID;

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1:  { label: "Day 1",  color: "#FFC864" },
  7:  { label: "Day 7",  color: "#E09040" },
  14: { label: "Day 14", color: "#E06060" },
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  sms:      "📱",
  email:    "✉️",
};

type FilterStatus = "all" | "logged" | "simulated_sent";

export default function RemindersQueuePage() {
  const [reminders, setReminders] = useState<ReminderQueueItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const load = useCallback((status?: FilterStatus) => {
    setIsLoading(true);
    const s = status ?? filter;
    const statusParam = s === "all" ? undefined : s;
    getRemindersQueue(SCHOOL_ID, { ...(statusParam ? { status: statusParam as "logged" | "simulated_sent" } : {}), limit: 100 })
      .then(({ reminders: r }) => setReminders(r))
      .catch(() => setReminders([]))
      .finally(() => setIsLoading(false));
  }, [filter]);

  // Load on first render
  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (f: FilterStatus) => {
    setFilter(f);
    load(f);
  };

  const handleMarkSent = (id: string) => {
    if (!confirm("Are you sure you want to mark this reminder as sent?")) return;
    startTransition(async () => {
      try {
        const { status, dispatchError } = await markReminderSent(id);
        if (dispatchError) {
          alert(`Could not send reminder: ${dispatchError}`);
        } else {
          setSentIds((prev) => new Set([...prev, id]));
        }
        
        // Optimistically update the status in the list
        setReminders((prev) =>
          prev?.map((r) =>
            r.id === id ? { ...r, status: status, sentAt: new Date().toISOString(), dispatchError } : r
          ) ?? null
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to mark as sent");
      }
    });
  };

  const staleCount = reminders?.filter((r) => r.isStale && r.status === "logged").length ?? 0;
  const pendingCount = reminders?.filter((r) => r.status === "logged" && !r.isStale).length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Reminders Queue</h1>
          <p className="text-sm text-text-secondary mt-1">
            Review AI-drafted reminder texts and mark them as sent. Nothing sends automatically.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {staleCount > 0 && (
            <span
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "rgba(255,200,100,0.12)", color: "#FFC864", border: "1px solid rgba(255,200,100,0.25)" }}
            >
              ⚠ {staleCount} stale
            </span>
          )}
          {pendingCount > 0 && (
            <span
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "rgba(76,175,130,0.12)", color: "#4CAF82", border: "1px solid rgba(76,175,130,0.25)" }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {(["all", "logged", "simulated_sent"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={
              filter === f
                ? { background: "rgba(76,175,130,0.2)", color: "#4CAF82" }
                : { color: "var(--color-text-secondary)" }
            }
          >
            {f === "all" ? "All" : f === "logged" ? "Pending" : "Sent"}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {!isLoading && reminders !== null && reminders.length === 0 && (
        <GlassCard weight="standard">
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <span className="text-4xl">✓</span>
            <p className="text-text-primary font-medium">No reminders in this queue</p>
            <p className="text-sm text-text-secondary">Draft a reminder from the Defaulter Tracking view</p>
          </div>
        </GlassCard>
      )}

      {!isLoading && reminders !== null && reminders.length > 0 && (
        <div className="space-y-3">
          {reminders.map((r) => {
            const isExpanded = expandedId === r.id;
            const isSent = r.status === "simulated_sent" || sentIds.has(r.id);
            const tier = TIER_LABELS[r.tier] ?? { label: `Day ${r.tier}`, color: "#E06060" };

            return (
              <GlassCard key={r.id} weight="list-row" className="space-y-0">
                <div className="flex items-start gap-4">
                  {/* Stale / Sent indicator */}
                  <div className="flex-shrink-0 pt-0.5">
                    {r.isStale && !isSent ? (
                      <span title="Stale — dues already cleared" className="text-lg">⚠️</span>
                    ) : r.status === "failed" || r.dispatchError ? (
                      <span title="Failed to send" className="text-lg" style={{ color: "#E06060" }}>❌</span>
                    ) : isSent ? (
                      <span title="Sent" className="text-lg" style={{ color: "#4CAF82" }}>✓</span>
                    ) : (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(76,175,130,0.15)", color: "#4CAF82" }}>
                        {CHANNEL_ICONS[r.channel] ?? "📨"}
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{r.studentName}</span>
                      <span className="text-xs text-text-secondary">·</span>
                      <span className="text-xs text-text-secondary">{r.feeTypeName}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${tier.color}1A`, color: tier.color, border: `1px solid ${tier.color}40` }}
                      >
                        {tier.label}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-secondary)" }}
                      >
                        {CHANNEL_ICONS[r.channel]} {r.channel}
                      </span>
                      {r.isStale && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,200,100,0.1)", color: "#FFC864", border: "1px solid rgba(255,200,100,0.2)" }}>
                          Stale — dues cleared
                        </span>
                      )}
                      {isSent && !r.dispatchError && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(76,175,130,0.1)", color: "#4CAF82", border: "1px solid rgba(76,175,130,0.2)" }}>
                          Sent
                        </span>
                      )}
                      {r.dispatchError && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(224,96,96,0.1)", color: "#E06060", border: "1px solid rgba(224,96,96,0.2)" }}>
                          Error: {r.dispatchError}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-text-secondary">
                        ₹{r.remainingBalance.toLocaleString("en-IN")} due · {r.daysOverdue}d overdue
                      </span>
                    </div>
                    {isExpanded && (
                      <div
                        className="mt-3 text-sm text-text-primary p-3 rounded-lg whitespace-pre-wrap leading-relaxed"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {r.draftedText}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      id={`reminder-expand-${r.id}`}
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/10"
                      style={{ color: "var(--color-text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {isExpanded ? "Hide" : "Preview"}
                    </button>
                    {r.guardianPhone ? (
                      <a
                        href={buildWhatsAppPaymentUrl({
                          phone: r.guardianPhone,
                          studentName: r.studentName,
                          studentClass: r.studentClass || "Student",
                          amountRupees: r.remainingBalance,
                          feeAssignmentId: r.feeAssignmentId,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:bg-emerald-600 bg-emerald-700 text-white inline-flex items-center gap-1"
                      >
                        <span>💬 WhatsApp</span>
                      </a>
                    ) : (
                      <span
                        className="text-[10px] px-2 py-1 rounded bg-black/10 text-text-secondary font-semibold border border-white/10"
                        title="No parent phone number linked"
                      >
                        No Phone
                      </span>
                    )}
                    {!isSent && (
                      <button
                        id={`reminder-mark-sent-${r.id}`}
                        type="button"
                        onClick={() => handleMarkSent(r.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-90 disabled:opacity-40"
                        style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)", color: "#fff" }}
                      >
                        Mark as Sent
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {!isLoading && reminders === null && (
        <GlassCard weight="standard">
          <p className="text-sm text-text-secondary text-center py-8">Loading reminders…</p>
        </GlassCard>
      )}
    </div>
  );
}
