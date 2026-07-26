"use client";

/**
 * OCR Upload screen — /admin/ocr
 * ui_ux_specification.md — ADMIN — OCR Receipt Upload
 *
 * Flow: Upload image → processOcrUploadAction → staged preview (confirmed: false)
 *       → admin reviews/corrects extracted fields → confirmOcrEntryAction → TRANSACTION posted
 *
 * HARD CONSTRAINT: Nothing writes to the ledger until the admin explicitly confirms.
 * A staged (confirmed: false) row MUST NOT affect any dashboard number or balance.
 * This is enforced at the action layer, not just the UI.
 */

import { useState, useTransition, useId } from "react";
import { processOcrUploadAction, confirmOcrEntryAction } from "@/app/actions/ai";
import { GlassCard } from "@/components/GlassCard";
import type { OcrExtractionResult } from "@smart-school/ai";

// In production, image upload would go to Supabase Storage and return a URL.
// For Session 4, we accept an image URL directly (demo-compatible).
import { DEMO_SCHOOL_ID } from "@/lib/school-context";
const SCHOOL_ID = DEMO_SCHOOL_ID;
const ADMIN_ID = "demo-admin"; // Session 6: derive from auth session

type OcrStage =
  | { type: "idle" }
  | { type: "processing" }
  | { type: "staged"; stagingId: string; extraction: OcrExtractionResult }
  | { type: "confirming" }
  | { type: "confirmed"; transactionId: string }
  | { type: "error"; message: string };

export default function OcrUploadPage() {
  const [imageUrl, setImageUrl] = useState("");
  const [stage, setStage] = useState<OcrStage>({ type: "idle" });
  const [isPending, startTransition] = useTransition();

  // Editable fields for correction before confirmation
  const [feeAssignmentId, setFeeAssignmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<"cash" | "cheque">("cash");
  const [refNumber, setRefNumber] = useState("");

  const formId = useId();

  const handleProcess = () => {
    if (!imageUrl.trim()) return;
    setStage({ type: "processing" });
    startTransition(async () => {
      try {
        const result = await processOcrUploadAction(SCHOOL_ID, imageUrl.trim());
        setStage({ type: "staged", stagingId: result.stagingId, extraction: result.extraction });
        // Pre-populate editable fields with extracted values
        if (result.extraction.amount) setAmount(String(result.extraction.amount));
        if (result.extraction.refNumber) setRefNumber(result.extraction.refNumber);
      } catch (err) {
        setStage({
          type: "error",
          message: err instanceof Error ? err.message : "OCR processing failed",
        });
      }
    });
  };

  const handleConfirm = () => {
    if (stage.type !== "staged") return;
    if (!feeAssignmentId || !amount || Number(amount) <= 0) return;

    setStage({ type: "confirming" });
    startTransition(async () => {
      try {
        const result = await confirmOcrEntryAction(ADMIN_ID, SCHOOL_ID, stage.stagingId, {
          feeAssignmentId,
          amount: Number(amount),
          channel,
          ...(refNumber ? { refNumber } : {}),
        });
        setStage({ type: "confirmed", transactionId: result.transaction.id });
      } catch (err) {
        setStage({
          type: "error",
          message: err instanceof Error ? err.message : "Confirmation failed",
        });
      }
    });
  };

  const handleReset = () => {
    setStage({ type: "idle" });
    setImageUrl("");
    setFeeAssignmentId("");
    setAmount("");
    setRefNumber("");
    setChannel("cash");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">OCR Receipt Upload</h1>
        <p className="text-sm text-text-secondary mt-1">
          Upload a payment receipt image to extract payment details. Review carefully before confirming — nothing posts until you confirm.
        </p>
      </div>

      {/* Step 1 — Image URL input */}
      <GlassCard weight="standard" className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <StepBadge n={1} active={stage.type === "idle" || stage.type === "error"} />
          <h2 className="text-base font-semibold text-text-primary">Provide Receipt Image</h2>
        </div>
        <p className="text-xs text-text-secondary">
          Enter the image URL (e.g. from Supabase Storage after upload). In production this will be an image picker.
        </p>
        <div className="flex gap-3">
          <input
            id="ocr-image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://your-storage.supabase.co/receipt.jpg"
            disabled={stage.type !== "idle" && stage.type !== "error"}
            className="flex-1 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
          <button
            id="ocr-process-btn"
            type="button"
            onClick={handleProcess}
            disabled={!imageUrl.trim() || isPending || (stage.type !== "idle" && stage.type !== "error")}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)", color: "#fff" }}
          >
            {stage.type === "processing" ? "Processing…" : "Extract with Gemini"}
          </button>
        </div>
      </GlassCard>

      {/* Step 2 — Extracted fields (staged) */}
      {(stage.type === "staged" || stage.type === "confirming") && (
        <GlassCard weight="standard" className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <StepBadge n={2} active />
            <h2 className="text-base font-semibold text-text-primary">Review Extracted Fields</h2>
            <span
              className="ml-auto text-xs px-2 py-0.5 rounded-full"
              style={{
                background:
                  stage.type === "staged"
                    ? (stage.extraction.confidence === "high"
                      ? "rgba(76,175,130,0.15)"
                      : stage.extraction.confidence === "medium"
                      ? "rgba(255,200,100,0.15)"
                      : "rgba(200,100,100,0.15)")
                    : undefined,
                color:
                  stage.type === "staged"
                    ? (stage.extraction.confidence === "high"
                      ? "#4CAF82"
                      : stage.extraction.confidence === "medium"
                      ? "#FFC864"
                      : "#E06060")
                    : undefined,
              }}
            >
              {stage.type === "staged" ? `${stage.extraction.confidence} confidence` : ""}
            </span>
          </div>

          {stage.type === "staged" && stage.extraction.extractionNotes && (
            <div
              className="text-xs p-3 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-text-secondary">Gemini notes: </span>
              <span className="text-text-primary">{stage.extraction.extractionNotes}</span>
            </div>
          )}

          {/* Unstaged warning */}
          <div
            className="flex items-start gap-2 text-xs p-3 rounded-lg"
            style={{ background: "rgba(255,200,100,0.08)", border: "1px solid rgba(255,200,100,0.2)", color: "#FFC864" }}
          >
            <span>⚠</span>
            <span>
              This is a <strong>staged preview</strong> — no payment has been recorded yet.
              Correct any errors below, then click Confirm to post to the ledger.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fee Assignment ID *" required>
              <input
                id="ocr-fee-assignment-id"
                type="text"
                value={feeAssignmentId}
                onChange={(e) => setFeeAssignmentId(e.target.value)}
                placeholder="Paste the fee assignment ID"
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <Field label="Amount (₹) *" required>
              <input
                id="ocr-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="0.01"
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <Field label="Payment Channel *" required>
              <select
                id="ocr-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as "cash" | "cheque")}
                className={inputClass}
                style={inputStyle}
              >
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </Field>

            <Field label="Reference Number">
              <input
                id="ocr-ref-number"
                type="text"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                placeholder="Cheque no. / ref (optional)"
                className={inputClass}
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              id="ocr-confirm-btn"
              type="button"
              onClick={handleConfirm}
              disabled={!feeAssignmentId || !amount || Number(amount) <= 0 || isPending || stage.type === "confirming"}
              className="px-6 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)", color: "#fff" }}
            >
              {stage.type === "confirming" ? "Posting to Ledger…" : "Confirm & Post to Ledger"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/10"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Start over
            </button>
          </div>
        </GlassCard>
      )}

      {/* Step 3 — Confirmed */}
      {stage.type === "confirmed" && (
        <GlassCard weight="standard">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base"
              style={{ background: "rgba(76,175,130,0.2)", color: "#4CAF82" }}
            >
              ✓
            </div>
            <h2 className="text-base font-semibold text-text-primary">Payment Posted</h2>
          </div>
          <p className="text-sm text-text-secondary mb-1">
            The payment has been recorded in the ledger.
          </p>
          <p className="text-xs text-text-secondary font-mono">
            Transaction ID: {stage.transactionId}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/10"
            style={{ color: "#4CAF82", border: "1px solid rgba(76,175,130,0.3)" }}
          >
            Upload another receipt
          </button>
        </GlassCard>
      )}

      {/* Error state */}
      {stage.type === "error" && (
        <GlassCard weight="standard">
          <div
            className="flex items-start gap-2 text-sm p-3 rounded-lg"
            style={{ background: "rgba(200,100,100,0.08)", border: "1px solid rgba(200,100,100,0.2)", color: "#E06060" }}
          >
            <span>✕</span>
            <span>{stage.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStage({ type: "idle" })}
            className="mt-3 px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/10"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Try again
          </button>
        </GlassCard>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{
        background: active ? "rgba(76,175,130,0.2)" : "rgba(255,255,255,0.06)",
        color: active ? "#4CAF82" : "var(--color-text-secondary)",
        border: active ? "1px solid rgba(76,175,130,0.3)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {n}
    </span>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-text-secondary">
        {label}
        {required && <span style={{ color: "#E06060" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-1 transition-all";
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};
