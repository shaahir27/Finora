"use client";

import { useState } from "react";
import { recordPayment } from "@/app/actions/ledger";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";

interface FeeAssignmentOption {
  id: string;
  feeTypeName: string;
  remainingBalance: number;
}

export function RecordPaymentModal({
  schoolId,
  adminId,
  assignments,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  adminId: string;
  assignments: FeeAssignmentOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [feeAssignmentId, setFeeAssignmentId] = useState(assignments[0]?.id ?? "");
  const [channel, setChannel] = useState<"cash" | "upi" | "cheque">("cash");
  const [amount, setAmount] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selected = assignments.find((a) => a.id === feeAssignmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (!feeAssignmentId) throw new Error("Select a fee assignment.");
      const numericAmount = parseFloat(amount);
      if (!numericAmount || numericAmount <= 0) throw new Error("Enter a valid amount.");
      if ((channel === "upi" || channel === "cheque") && !refNumber.trim()) {
        throw new Error(`A reference number is required for ${channel} payments.`);
      }

      await recordPayment(adminId, schoolId, {
        feeAssignmentId,
        channel,
        amount: numericAmount,
        ...(refNumber.trim() ? { refNumber: refNumber.trim() } : {}),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <GlassCard className="w-full max-w-md bg-bg-base">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Record Payment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Fee Assignment</label>
            <select
              value={feeAssignmentId}
              onChange={(e) => setFeeAssignmentId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.feeTypeName} — ₹{a.remainingBalance.toFixed(2)} remaining
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
              className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Amount {selected ? `(max ₹${selected.remainingBalance.toFixed(2)})` : ""}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
            />
          </div>

          {(channel === "upi" || channel === "cheque") && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {channel === "upi" ? "UPI Reference / UTR" : "Cheque Number"}
              </label>
              <input
                type="text"
                required
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="w-full px-3 py-2 bg-surface-glass border border-border-glass rounded text-text-primary"
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
              label={submitting ? "Recording…" : "Record Payment"}
              disabled={submitting}
              className="bg-accent-primary border-none"
            />
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
