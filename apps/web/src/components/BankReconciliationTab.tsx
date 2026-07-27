"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "./GlassCard";
import { processBankStatementAction, confirmBatchBankReconciliationAction } from "@/app/actions/bankReconciliation";
import { playPaymentSoundbox } from "@/lib/soundbox";
import { playTactileSound } from "@/lib/playTactileSound";
import toast from "react-hot-toast";
import { FileSpreadsheet, CheckCircle2, AlertCircle, HelpCircle, ArrowRight, Zap, RefreshCw } from "lucide-react";
import type { BankReconciliationResult, MatchedBankItem } from "@smart-school/ai";

interface BankReconciliationTabProps {
  schoolId: string;
  onSuccess: () => void;
}

const SAMPLE_BANK_STATEMENT = `Date,Narration,Ref No,Amount
2026-07-25,NEFT-ICICI-Rahul Sharma VIII-A Fee,UTR90218491,5000.00
2026-07-25,UPI-Ananya Patel VII-B Fee,RRN84910294,3500.00
2026-07-26,CHQ CLR 409182 - Piyush,CHQ409182,4500.00
2026-07-26,DIRECT CASH DEPOSIT BRANCH 402,CDM901238,2000.00`;

export function BankReconciliationTab({ schoolId, onSuccess }: BankReconciliationTabProps) {
  const [statementText, setStatementText] = useState("");
  const [results, setResults] = useState<BankReconciliationResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [posting, setPosting] = useState(false);
  const [selectedAutoMatched, setSelectedAutoMatched] = useState<Record<string, boolean>>({});

  const handleProcessStatement = () => {
    if (!statementText.trim()) {
      toast.error("Please paste or load a bank statement first");
      return;
    }

    startTransition(async () => {
      try {
        playTactileSound("action");
        const res = await processBankStatementAction(schoolId, statementText.trim());
        setResults(res);

        // Pre-select all 100% auto matched items
        const initialSelected: Record<string, boolean> = {};
        res.autoMatched.forEach((item) => {
          initialSelected[item.bankLine.lineId] = true;
        });
        setSelectedAutoMatched(initialSelected);

        toast.success(`Parsed ${res.autoMatched.length} auto-matched & ${res.probableMatches.length} probable lines`);
      } catch (err: any) {
        toast.error("Bank statement parsing failed: " + err.message);
      }
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!results) return;
    const updated: Record<string, boolean> = {};
    results.autoMatched.forEach((item) => {
      updated[item.bankLine.lineId] = checked;
    });
    setSelectedAutoMatched(updated);
  };

  const toggleSelectOne = (lineId: string) => {
    setSelectedAutoMatched((prev) => ({
      ...prev,
      [lineId]: !prev[lineId],
    }));
  };

  const handleConfirmBatchPost = async () => {
    if (!results) return;

    const itemsToPost = results.autoMatched.filter(
      (item) => selectedAutoMatched[item.bankLine.lineId]
    );

    if (itemsToPost.length === 0) {
      toast.error("No items selected for batch posting");
      return;
    }

    setPosting(true);
    try {
      playTactileSound("success");
      const payload = itemsToPost.map((item) => ({
        feeAssignmentId: item.matchedAssignment.id,
        amount: item.bankLine.amount,
        channel: item.bankLine.channel,
        refNumber: item.bankLine.refNumber,
      }));

      const res = await confirmBatchBankReconciliationAction(schoolId, payload);

      if (res.postedCount > 0) {
        playPaymentSoundbox(res.totalPostedAmount);
        toast.success(`Posted ${res.postedCount} payments totaling ₹${res.totalPostedAmount.toLocaleString("en-IN")}`);
        onSuccess();
        // Remove posted items from results
        const postedLineIds = new Set(itemsToPost.map((i) => i.bankLine.lineId));
        setResults({
          ...results,
          autoMatched: results.autoMatched.filter((i) => !postedLineIds.has(i.bankLine.lineId)),
        });
      }
    } catch (err: any) {
      toast.error("Batch posting failed: " + err.message);
    } finally {
      setPosting(false);
    }
  };

  const selectedCount = Object.values(selectedAutoMatched).filter(Boolean).length;
  const selectedTotalAmount = results?.autoMatched
    ? results.autoMatched
        .filter((item) => selectedAutoMatched[item.bankLine.lineId])
        .reduce((sum, item) => sum + item.bankLine.amount, 0)
    : 0;

  return (
    <div className="space-y-6 font-sans">
      {/* Upload & Input Card */}
      <GlassCard className="p-6 border-[#0F5A47]/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#0F5A47]" />
              Bank Statement Auto-Reconciliation Engine
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Paste raw bank statement text/CSV from ICICI, HDFC, SBI, or Axis. Gemini AI & UTR Rule Matcher will auto-match lines against open student fees.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatementText(SAMPLE_BANK_STATEMENT)}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-extrabold hover:bg-[#0F5A47]/10 transition-all whitespace-nowrap shadow-xs"
          >
            📋 Load Sample Statement
          </button>
        </div>

        <textarea
          rows={4}
          value={statementText}
          onChange={(e) => setStatementText(e.target.value)}
          placeholder="Paste CSV or bank statement lines here (e.g., Date, Narration, UTR Number, Amount)..."
          className="w-full rounded-2xl p-4 text-xs font-mono bg-white border border-border-glass text-text-primary focus:outline-none focus:border-[#0F5A47] shadow-inner"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleProcessStatement}
            disabled={!statementText.trim() || isPending}
            className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] shadow-md hover:opacity-95 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Parsing with Gemini AI...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Auto-Match Statement Lines
              </>
            )}
          </button>
        </div>
      </GlassCard>

      {/* 3-Column Reconciliation Results Board */}
      {results && (
        <div className="space-y-6">
          {/* Action Bar for 100% Matched Items */}
          {results.autoMatched.length > 0 && (
            <GlassCard className="p-4 border-[#059669]/30 bg-[#059669]/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#059669] flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#059669]">
                    {results.autoMatched.length} Auto-Matched Payment Lines
                  </h3>
                  <p className="text-xs text-text-secondary font-medium">
                    Selected {selectedCount} of {results.autoMatched.length} (Total: ₹{selectedTotalAmount.toLocaleString("en-IN")})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmBatchPost}
                disabled={selectedCount === 0 || posting}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#059669] hover:bg-[#047857] shadow-md transition-all disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
              >
                {posting ? "Batch Posting..." : `Batch Post Selected (${selectedCount} · ₹${selectedTotalAmount.toLocaleString("en-IN")})`}
              </button>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: 100% Auto-Matched Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#059669]/20 pb-2">
                <span className="text-xs font-extrabold uppercase text-[#059669] tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  1. Auto-Matched ({results.autoMatched.length})
                </span>
                {results.autoMatched.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(selectedCount !== results.autoMatched.length)}
                    className="text-[10px] font-bold text-[#059669] hover:underline"
                  >
                    {selectedCount === results.autoMatched.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {results.autoMatched.length === 0 ? (
                <GlassCard className="p-4 text-center text-xs text-text-secondary italic">
                  No 100% auto-matched bank lines found.
                </GlassCard>
              ) : (
                results.autoMatched.map((item) => (
                  <GlassCard
                    key={item.bankLine.lineId}
                    className={`p-3 border transition-all ${
                      selectedAutoMatched[item.bankLine.lineId]
                        ? "border-[#059669] bg-[#059669]/5 shadow-xs"
                        : "border-border-glass opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={!!selectedAutoMatched[item.bankLine.lineId]}
                        onChange={() => toggleSelectOne(item.bankLine.lineId)}
                        className="mt-1 rounded text-[#059669] focus:ring-[#059669] cursor-pointer"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-extrabold text-[#0F172A]">
                            {item.matchedAssignment.studentName}
                          </span>
                          <span className="text-xs font-extrabold text-[#059669]">
                            ₹{item.bankLine.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-secondary font-medium truncate">
                          Bank Narration: {item.bankLine.narration}
                        </p>
                        <div className="text-[10px] font-bold text-[#059669] bg-white px-2 py-0.5 rounded border border-[#059669]/20 inline-block">
                          {item.confidence} • {item.matchedAssignment.feeTypeName}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))
              )}
            </div>

            {/* Column 2: Probable Candidates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <span className="text-xs font-extrabold uppercase text-[#D97706] tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  2. Probable Matches ({results.probableMatches.length})
                </span>
              </div>

              {results.probableMatches.length === 0 ? (
                <GlassCard className="p-4 text-center text-xs text-text-secondary italic">
                  No probable match candidates.
                </GlassCard>
              ) : (
                results.probableMatches.map((item, idx) => (
                  <GlassCard key={idx} className="p-3 border border-amber-500/20 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono font-bold text-amber-700">
                        {item.bankLine.refNumber}
                      </span>
                      <span className="text-xs font-extrabold text-amber-700">
                        ₹{item.bankLine.amount}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-secondary truncate">{item.bankLine.narration}</p>
                    <p className="text-[10px] text-amber-800 font-semibold bg-amber-50 p-1.5 rounded border border-amber-200">
                      {item.reason}
                    </p>
                  </GlassCard>
                ))
              )}
            </div>

            {/* Column 3: Unlinked Suspense Queue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                <span className="text-xs font-extrabold uppercase text-[#DC2626] tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  3. Unlinked Suspense ({results.unlinkedSuspense.length})
                </span>
              </div>

              {results.unlinkedSuspense.length === 0 ? (
                <GlassCard className="p-4 text-center text-xs text-text-secondary italic">
                  No unlinked suspense deposits.
                </GlassCard>
              ) : (
                results.unlinkedSuspense.map((item) => (
                  <GlassCard key={item.lineId} className="p-3 border border-red-500/20 space-y-1 bg-red-50/20">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono font-bold text-red-700">{item.refNumber}</span>
                      <span className="text-xs font-extrabold text-red-700">₹{item.amount}</span>
                    </div>
                    <p className="text-[10px] text-text-secondary truncate">{item.narration}</p>
                    <span className="text-[9px] font-bold text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded">
                      Unallocated Bank Entry
                    </span>
                  </GlassCard>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
