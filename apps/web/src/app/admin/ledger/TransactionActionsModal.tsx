"use client";

import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import {
  reverseTransaction,
  markChequeCleared,
  markChequeBounced,
  applyPenalty,
  applyWaiver,
  resolveAnomaly,
} from "@/app/actions/ledger";
import toast from "react-hot-toast";
import { playPaymentSoundbox } from "@/lib/soundbox";

export type TransactionActionType =
  | "reverse"
  | "clear_cheque"
  | "bounce_cheque"
  | "apply_penalty"
  | "apply_waiver"
  | "resolve_anomaly";

export function TransactionActionsModal({
  adminId,
  schoolId,
  transaction,
  actionType,
  onClose,
  onSuccess,
}: {
  adminId: string;
  schoolId: string;
  transaction: any;
  actionType: TransactionActionType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [waiverAmount, setWaiverAmount] = useState("");
  const [resolution, setResolution] = useState<"posted" | "reversed">("posted");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (actionType === "reverse") {
        if (!reason.trim()) throw new Error("A reason is required to reverse a transaction.");
        await reverseTransaction(adminId, transaction.id, reason);
        toast.success("Transaction reversed.");
      } else if (actionType === "clear_cheque") {
        await markChequeCleared(transaction.id);
        playPaymentSoundbox(Number(transaction.amount), transaction.student?.name);
        toast.success("Cheque marked as cleared.");
      } else if (actionType === "bounce_cheque") {
        if (!reason.trim()) throw new Error("A reason is required to bounce a cheque.");
        await markChequeBounced(adminId, transaction.id, reason);
        toast.success("Cheque marked as bounced.");
      } else if (actionType === "apply_penalty") {
        const amt = parseFloat(penaltyAmount);
        if (!amt || amt <= 0) throw new Error("Enter a valid penalty amount.");
        if (!reason.trim()) throw new Error("A reason is required to apply a penalty.");
        await applyPenalty(adminId, transaction.id, { amount: amt, reason });
        toast.success("Penalty applied.");
      } else if (actionType === "apply_waiver") {
        const amt = parseFloat(waiverAmount);
        if (!amt || amt <= 0) throw new Error("Enter a valid waiver amount.");
        if (!reason.trim()) throw new Error("A reason is required to apply a waiver.");
        await applyWaiver(adminId, schoolId, transaction.feeAssignmentId, {
          transactionId: transaction.id,
          amount: amt,
          reason,
        });
        toast.success("Waiver applied.");
      } else if (actionType === "resolve_anomaly") {
        await resolveAnomaly(adminId, transaction.id, resolution, reason);
        toast.success(`Anomaly resolved as ${resolution}.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to complete action.");
    } finally {
      setLoading(false);
    }
  };

  const titleMap: Record<TransactionActionType, string> = {
    reverse: "Reverse Transaction",
    clear_cheque: "Clear Cheque",
    bounce_cheque: "Bounce Cheque",
    apply_penalty: "Apply Penalty",
    apply_waiver: "Apply Waiver",
    resolve_anomaly: "Resolve Anomaly",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <GlassCard className="w-full max-w-md bg-bg-base space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">{titleMap[actionType]}</h2>
        <p className="text-xs text-text-secondary">
          Transaction #{transaction.id.slice(0, 8)} • ₹{Number(transaction.amount).toFixed(2)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {actionType === "resolve_anomaly" && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Resolution Outcome</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "posted" | "reversed")}
                className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
              >
                <option value="posted">Approve & Mark Posted</option>
                <option value="reversed">Reject & Reverse</option>
              </select>
            </div>
          )}

          {actionType === "apply_penalty" && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Penalty Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(e.target.value)}
                className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
              />
            </div>
          )}

          {actionType === "apply_waiver" && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Waiver Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={waiverAmount}
                onChange={(e) => setWaiverAmount(e.target.value)}
                className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
              />
            </div>
          )}

          {actionType !== "clear_cheque" && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Reason / Explanation <span className="text-risk-high">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Logged for audit compliance..."
                className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary focus:outline-none"
              />
            </div>
          )}

          {error && (
            <div className="text-risk-high text-sm p-2 bg-risk-high/10 rounded border border-risk-high/30">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <QuickActionButton type="button" label="Cancel" onClick={onClose} />
            <QuickActionButton
              type="submit"
              label={loading ? "Processing…" : "Confirm"}
              disabled={loading}
              className="bg-accent-primary border-none"
            />
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
