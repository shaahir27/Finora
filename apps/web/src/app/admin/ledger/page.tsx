"use client";

import { useState, useTransition, useEffect } from "react";
import { getLedgerSnapshot, batchClearChequesAction, exportLedgerCsvAction } from "@/app/actions/ledger";
import { generateReceipt } from "@/app/actions/receipts";
import { exportTallyXmlReport } from "@/app/actions/reports";
import { processOcrUploadAction, confirmOcrEntryAction } from "@/app/actions/ai";
import { getAllEntries, updateEntryStatus, removeEntry, type OfflinePaymentEntry } from "@/lib/offlineQueue";
import { syncOfflinePayment, getSyncConflicts, resolveSyncConflict, reportSyncConflict } from "@/app/actions/offlineSync";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { OfflineSyncStatusBadge } from "@/components/OfflineSyncStatusBadge";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BookOpen, ScanLine, WifiOff, Printer, X, Download, FileText, CheckCircle2, AlertTriangle, Search, Zap, CheckSquare, Eye } from "lucide-react";
import type { OcrExtractionResult } from "@smart-school/ai";

import { PosReceiptModal } from "@/components/PosReceiptModal";
import { TransactionActionsModal, type TransactionActionType } from "./TransactionActionsModal";
import { SoundboxToggle } from "@/components/SoundboxToggle";
import { playPaymentSoundbox } from "@/lib/soundbox";
import { playTactileSound } from "@/lib/playTactileSound";
import { LedgerKpiHeader } from "@/components/LedgerKpiHeader";
import { TransactionInspectorDrawer } from "@/components/TransactionInspectorDrawer";
import { BankReconciliationTab } from "@/components/BankReconciliationTab";

const CHANNELS = ["all", "upi", "cash", "cheque"] as const;
const STATUSES = ["all", "posted", "cheque_pending", "flagged", "reversed"] as const;

type OcrStage =
  | { type: "idle" }
  | { type: "processing" }
  | { type: "staged"; stagingId: string; extraction: OcrExtractionResult }
  | { type: "confirming" }
  | { type: "confirmed"; transactionId: string }
  | { type: "error"; message: string };

export default function AdminLedgerPage() {
  const schoolId = DEMO_SCHOOL_ID;
  const adminId = "demo-admin";
  const queryClient = useQueryClient();

  // Segmented Workspace Tab: "ledger" | "bank_reconcile" | "ocr" | "offline"
  const [activeTab, setActiveTab] = useState<"ledger" | "bank_reconcile" | "ocr" | "offline">("ledger");

  // Ledger Filter State
  const [channel, setChannel] = useState<typeof CHANNELS[number]>("all");
  const [statusFilter, setStatusFilter] = useState<typeof STATUSES[number]>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Selection & Batch Action States
  const [selectedTxIds, setSelectedTxIds] = useState<Record<string, boolean>>({});
  const [inspectedTxId, setInspectedTxId] = useState<string | null>(null);
  const [batchClearing, setBatchClearing] = useState(false);

  // Modals & Action States
  const [activeTx, setActiveTx] = useState<any>(null);
  const [actionType, setActionType] = useState<TransactionActionType | null>(null);
  const [receiptTx, setReceiptTx] = useState<any>(null);
  const [posReceiptTx, setPosReceiptTx] = useState<any>(null);

  // OCR Tab States
  const [ocrImageUrl, setOcrImageUrl] = useState("");
  const [ocrStage, setOcrStage] = useState<OcrStage>({ type: "idle" });
  const [isOcrPending, startOcrTransition] = useTransition();
  const [ocrFeeAssignmentId, setOcrFeeAssignmentId] = useState("");
  const [ocrAmount, setOcrAmount] = useState("");
  const [ocrChannel, setOcrChannel] = useState<"cash" | "cheque">("cash");
  const [ocrRefNumber, setOcrRefNumber] = useState("");

  // Offline Sync States
  const [localQueue, setLocalQueue] = useState<OfflinePaymentEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const state = useDataState({
    queryKey: ["ledgerSnapshot", schoolId, channel, statusFilter, search, startDate, endDate, cursor],
    queryFn: () =>
      getLedgerSnapshot(schoolId, {
        ...(channel !== "all" ? { channel: channel as "upi" | "cash" | "cheque" } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
        ...(search ? { search } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate + "T23:59:59") } : {}),
        ...(cursor ? { cursor } : {}),
        limit: 50,
      }),
  });

  const { data: serverConflicts = [], refetch: refetchConflicts } = useQuery({
    queryKey: ['syncConflicts', schoolId],
    queryFn: () => getSyncConflicts(schoolId)
  });

  const loadLocalQueue = async () => {
    try {
      const entries = await getAllEntries();
      setLocalQueue(entries);
    } catch (err) {
      console.error("Failed to load offline queue", err);
    }
  };

  useEffect(() => {
    if (activeTab === "offline") {
      loadLocalQueue();
    }
  }, [activeTab]);

  const openAction = (tx: any, type: TransactionActionType) => {
    setActiveTx(tx);
    setActionType(type);
  };

  const handleGenerateReceipt = async (txId: string, format: "a4" | "thermal") => {
    const win = window.open("about:blank", "_blank");
    try {
      const res = await generateReceipt(txId, format);
      if (win) {
        win.location.href = res.pdfUrl;
      } else {
        window.location.href = res.pdfUrl;
      }
      toast.success(`Generated ${format.toUpperCase()} receipt`);
    } catch (e: any) {
      if (win) win.close();
      toast.error(`Receipt generation failed: ${e.message}`);
    }
  };

  // CSV Export Handler
  const handleExportCsv = async () => {
    try {
      playTactileSound("export");
      const res = await exportLedgerCsvAction(schoolId, {
        ...(channel !== "all" ? { channel: channel as any } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate + "T23:59:59") } : {}),
      });

      const blob = new Blob([res.csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", res.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${res.count} ledger rows to CSV`);
    } catch (err: any) {
      toast.error("CSV export failed: " + err.message);
    }
  };

  // Batch Selection Handlers
  const handleToggleSelectAll = (txs: any[], checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      txs.forEach((t) => {
        next[t.id] = true;
      });
    }
    setSelectedTxIds(next);
  };

  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Batch Cheque Clear Handler
  const handleBatchClearCheques = async () => {
    const selectedIds = Object.keys(selectedTxIds).filter((id) => selectedTxIds[id]);
    if (selectedIds.length === 0) return;

    setBatchClearing(true);
    try {
      playTactileSound("success");
      const res = await batchClearChequesAction(schoolId, selectedIds);
      if (res.clearedCount > 0) {
        playPaymentSoundbox(res.totalAmount);
        toast.success(`Cleared ${res.clearedCount} cheques totaling ₹${res.totalAmount.toLocaleString("en-IN")}`);
        setSelectedTxIds({});
        queryClient.invalidateQueries({ queryKey: ["ledgerSnapshot"] });
      } else {
        toast.error("No pending cheques were found in the selected batch");
      }
    } catch (err: any) {
      toast.error("Batch clearance failed: " + err.message);
    } finally {
      setBatchClearing(false);
    }
  };

  // OCR Processing Handlers
  const handleOcrProcess = () => {
    if (!ocrImageUrl.trim()) return;
    setOcrStage({ type: "processing" });
    startOcrTransition(async () => {
      try {
        const result = await processOcrUploadAction(schoolId, ocrImageUrl.trim());
        setOcrStage({ type: "staged", stagingId: result.stagingId, extraction: result.extraction });
        if (result.extraction.amount) setOcrAmount(String(result.extraction.amount));
        if (result.extraction.refNumber) setOcrRefNumber(result.extraction.refNumber);
        toast.success("Document analyzed by Gemini");
      } catch (err: any) {
        setOcrStage({ type: "error", message: err.message || "OCR processing failed" });
        toast.error("Failed to analyze image");
      }
    });
  };

  const handleOcrConfirm = () => {
    if (ocrStage.type !== "staged") return;
    if (!ocrFeeAssignmentId || !ocrAmount || Number(ocrAmount) <= 0) return;

    setOcrStage({ type: "confirming" });
    startOcrTransition(async () => {
      try {
        const result = await confirmOcrEntryAction(adminId, schoolId, ocrStage.stagingId, {
          feeAssignmentId: ocrFeeAssignmentId,
          amount: Number(ocrAmount),
          channel: ocrChannel,
          ...(ocrRefNumber ? { refNumber: ocrRefNumber } : {}),
        });
        setOcrStage({ type: "confirmed", transactionId: result.transaction.id });
        playPaymentSoundbox(Number(ocrAmount));
        toast.success("Transaction posted to ledger");
      } catch (err: any) {
        setOcrStage({ type: "error", message: err.message || "Confirmation failed" });
        toast.error("Failed to post transaction");
      }
    });
  };

  // Offline Sync Handlers
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const entries = await getAllEntries();
      const queued = entries.filter(e => e.status === "queued" || e.status === "conflict");

      for (const entry of queued) {
        await updateEntryStatus(entry.local_id, "syncing");
        await loadLocalQueue();

        const res = await syncOfflinePayment(
          entry.local_id,
          entry.fee_assignment_id,
          entry.channel,
          entry.amount,
          entry.queued_at,
          adminId,
          schoolId,
          entry.ref_number
        );

        if (res.success) {
          await removeEntry(entry.local_id);
        } else {
          await updateEntryStatus(entry.local_id, "conflict");
          await reportSyncConflict(
            entry.local_id,
            schoolId,
            adminId,
            entry.fee_assignment_id,
            entry.channel as "cash" | "cheque",
            entry.amount,
            entry.queued_at,
            res.conflictReason ?? "unknown_error"
          ).catch((err) => {
            toast.error("Reported conflict locally, but failed to notify server admins.");
            console.error(err);
          });
        }
      }
      await loadLocalQueue();
      await refetchConflicts();
      toast.success("Offline sync completed");
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async (conflictId: string, action: "discarded" | "reentered_adjusted") => {
    const reason = prompt(`Reason for resolving as ${action}:`);
    if (!reason) return;

    setResolvingId(conflictId);
    try {
      await resolveSyncConflict(conflictId, adminId, action, reason);
      await refetchConflicts();
      toast.success("Conflict resolved");
    } catch (err: any) {
      toast.error("Failed to resolve conflict: " + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const selectedIdsCount = Object.values(selectedTxIds).filter(Boolean).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 font-sans">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Finance Operations</h1>
          <p className="text-text-secondary text-sm">Master ledger journal, bank auto-reconciliation, OCR scanner & offline sync.</p>
        </div>
        <SoundboxToggle />
      </div>

      {/* Top Segmented Workspace Controller */}
      <div className="flex bg-white/70 p-1.5 rounded-2xl border border-border-glass max-w-3xl shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "ledger"
              ? "bg-[#0F5A47] text-white shadow-md"
              : "text-text-secondary hover:text-text-primary hover:bg-black/5"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Master Ledger
        </button>
        <button
          onClick={() => setActiveTab("bank_reconcile")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "bank_reconcile"
              ? "bg-[#0F5A47] text-white shadow-md"
              : "text-text-secondary hover:text-text-primary hover:bg-black/5"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          Bank Auto-Match
        </button>
        <button
          onClick={() => setActiveTab("ocr")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "ocr"
              ? "bg-[#0F5A47] text-white shadow-md"
              : "text-text-secondary hover:text-text-primary hover:bg-black/5"
          }`}
        >
          <ScanLine className="w-4 h-4" />
          OCR Scanner
        </button>
        <button
          onClick={() => setActiveTab("offline")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === "offline"
              ? "bg-[#0F5A47] text-white shadow-md"
              : "text-text-secondary hover:text-text-primary hover:bg-black/5"
          }`}
        >
          <WifiOff className="w-4 h-4" />
          Offline Sync
        </button>
      </div>

      {/* TAB 1: MASTER LEDGER */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <FiveStateRenderer state={state}>
            {(data) => (
              <div className="space-y-6">
                {/* Executive KPI Banner */}
                <LedgerKpiHeader
                  totalCollected={data.totalCollected || 0}
                  pendingChequeTotal={data.pendingChequeTotal || 0}
                  pendingChequeCount={data.pendingChequeCount || 0}
                  flaggedTotal={data.flaggedTotal || 0}
                  flaggedCount={data.flaggedCount || 0}
                  revenueByChannel={data.revenueByChannel || []}
                />

                {/* Filter & Search Toolbar */}
                <GlassCard className="p-3.5 border-[#0F5A47]/15 space-y-2.5">
                  {/* Row 1: Search Bar + Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 relative max-w-lg">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-text-secondary" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setCursor(undefined);
                          setSearch(e.target.value);
                        }}
                        placeholder="Student name, admission #, or UTR/Ref..."
                        className="w-full bg-white border border-border-glass rounded-xl pl-10 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47] shadow-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportCsv}
                        className="px-3.5 py-2 bg-white border border-[#0F5A47]/30 text-[#0F5A47] text-xs font-bold rounded-xl shadow-xs hover:bg-[#0F5A47]/5 transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            playTactileSound("export");
                            const res = await exportTallyXmlReport(schoolId, startDate, endDate);
                            window.open(res.url, "_blank");
                            toast.success(`Exported ${res.count} Tally XML Vouchers`);
                          } catch (err: any) {
                            toast.error(err.message || "Tally export failed");
                          }
                        }}
                        className="px-3.5 py-2 bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-95 transition-all flex items-center gap-1.5"
                      >
                        <span>📊 Export Tally XML</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Equal Grid of Filter Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-black/5">
                    <div>
                      <label className="block text-[10px] font-extrabold text-text-secondary mb-1 uppercase tracking-wider">Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setCursor(undefined);
                          setStatusFilter(e.target.value as any);
                        }}
                        className="w-full bg-white border border-border-glass rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                      >
                        <option value="all">ALL STATUSES</option>
                        <option value="posted">POSTED</option>
                        <option value="cheque_pending">CHEQUE PENDING</option>
                        <option value="flagged">FLAGGED ANOMALY</option>
                        <option value="reversed">REVERSED</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-text-secondary mb-1 uppercase tracking-wider">Mode</label>
                      <select
                        value={channel}
                        onChange={(e) => {
                          setCursor(undefined);
                          setChannel(e.target.value as typeof channel);
                        }}
                        className="w-full bg-white border border-border-glass rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                      >
                        {CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {c.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-text-secondary mb-1 uppercase tracking-wider">From Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setCursor(undefined);
                          setStartDate(e.target.value);
                        }}
                        className="w-full bg-white border border-border-glass rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-text-secondary mb-1 uppercase tracking-wider">To Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setCursor(undefined);
                          setEndDate(e.target.value);
                        }}
                        className="w-full bg-white border border-border-glass rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                      />
                    </div>
                  </div>
                </GlassCard>

                {/* Floating Batch Action Bar */}
                {selectedIdsCount > 0 && (
                  <GlassCard className="p-3 bg-[#0F5A47] text-white flex items-center justify-between shadow-xl border-[#0F5A47]">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <CheckSquare className="w-4 h-4 text-amber-300" />
                      <span>{selectedIdsCount} transactions selected</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBatchClearCheques}
                        disabled={batchClearing}
                        className="px-4 py-1.5 bg-amber-400 text-[#0F172A] hover:bg-amber-300 text-xs font-extrabold rounded-lg shadow-xs transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {batchClearing ? "Clearing..." : "⚡ Batch Clear Cheques"}
                      </button>
                      <button
                        onClick={() => setSelectedTxIds({})}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </GlassCard>
                )}

                {/* Master Ledger Table */}
                <GlassCard className="overflow-x-auto p-4 border-[#0F5A47]/15">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] uppercase tracking-wider text-text-secondary bg-white/80 border-b border-border-glass">
                      <tr>
                        <th className="px-3 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={data.transactions.length > 0 && selectedIdsCount === data.transactions.length}
                            onChange={(e) => handleToggleSelectAll(data.transactions, e.target.checked)}
                            className="rounded text-[#0F5A47] cursor-pointer"
                          />
                        </th>
                        <th className="px-3.5 py-3 font-extrabold">Date</th>
                        <th className="px-3.5 py-3 font-extrabold">Ref / UTR ID</th>
                        <th className="px-3.5 py-3 font-extrabold">Student</th>
                        <th className="px-3.5 py-3 font-extrabold">Channel</th>
                        <th className="px-3.5 py-3 text-right font-extrabold">Amount</th>
                        <th className="px-3.5 py-3 font-extrabold">Status</th>
                        <th className="px-3.5 py-3 text-right font-extrabold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-glass">
                      {data.transactions.map((t: any) => (
                        <tr
                          key={t.id}
                          className={`hover:bg-white/80 transition-colors cursor-pointer ${
                            selectedTxIds[t.id] ? "bg-[#0F5A47]/5" : ""
                          }`}
                          onClick={(e) => {
                            // Don't trigger inspector if clicked checkbox or dropdown
                            const target = e.target as HTMLElement;
                            if (target.tagName !== "INPUT" && target.tagName !== "SELECT" && target.tagName !== "OPTION") {
                              setInspectedTxId(t.id);
                            }
                          }}
                        >
                          <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={!!selectedTxIds[t.id]}
                              onChange={() => handleToggleSelectTx(t.id)}
                              className="rounded text-[#0F5A47] cursor-pointer"
                            />
                          </td>
                          <td className="px-3.5 py-3.5 text-text-primary text-xs font-medium">
                            {new Date(t.postedAt).toLocaleDateString()}
                          </td>
                          <td className="px-3.5 py-3.5 font-mono text-[11px] font-bold text-text-secondary">
                            #{t.refNumber || t.id.slice(-6)}
                          </td>
                          <td className="px-3.5 py-3.5 text-text-primary font-bold text-xs">
                            {t.studentName ?? t.student?.name ?? "—"}
                          </td>
                          <td className="px-3.5 py-3.5">
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${
                                t.channel?.toLowerCase() === "upi"
                                  ? "bg-[#059669]/10 text-[#059669] border-[#059669]/20"
                                  : t.channel?.toLowerCase() === "cash"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                  : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              }`}
                            >
                              {t.channel}
                            </span>
                          </td>
                          <td className="px-3.5 py-3.5 text-right font-extrabold text-[#0F5A47] text-sm">
                            ₹{Number(t.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3.5 py-3.5">
                            <span
                              className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full tracking-wider ${
                                t.reconciliationStatus === "posted"
                                  ? "bg-[#059669]/10 text-[#059669] border border-[#059669]/20"
                                  : t.reconciliationStatus === "cheque_pending"
                                  ? "bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20"
                                  : t.reconciliationStatus === "flagged"
                                  ? "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20"
                                  : "bg-[#64748B]/10 text-[#64748B] border border-[#64748B]/20"
                              }`}
                            >
                              {t.reconciliationStatus}
                            </span>
                          </td>
                          <td className="px-3.5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            {t.reconciliationStatus === "reversed" ? (
                              <span className="text-[10px] text-text-secondary font-bold italic">No Actions</span>
                            ) : (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  e.target.value = "";
                                  if (val === "inspect") setInspectedTxId(t.id);
                                  else if (val === "receipt") setReceiptTx(t);
                                  else if (val === "pos_receipt") setPosReceiptTx(t);
                                  else if (val === "clear_cheque") openAction(t, "clear_cheque");
                                  else if (val === "bounce_cheque") openAction(t, "bounce_cheque");
                                  else if (val === "resolve_anomaly") openAction(t, "resolve_anomaly");
                                  else if (val === "apply_penalty") openAction(t, "apply_penalty");
                                  else if (val === "reverse") openAction(t, "reverse");
                                }}
                                className="bg-white border border-[#0F5A47]/25 hover:border-[#0F5A47] text-[#0F5A47] text-xs font-bold px-3 py-1.5 rounded-xl outline-none transition-all shadow-xs cursor-pointer"
                              >
                                <option value="" disabled>Manage Options ▾</option>
                                <option value="inspect">🔍 Inspect Audit Trail</option>
                                {t.reconciliationStatus === "posted" && (
                                  <>
                                    <option value="receipt">📄 Download A4 Receipt</option>
                                    <option value="pos_receipt">🖨️ POS 80mm Receipt</option>
                                    <option value="apply_penalty">🏷️ Apply Late Penalty</option>
                                    <option value="reverse">🔄 Reverse Entry</option>
                                  </>
                                )}
                                {t.reconciliationStatus === "cheque_pending" && (
                                  <>
                                    <option value="clear_cheque">✅ Clear Cheque</option>
                                    <option value="bounce_cheque">❌ Mark Bounced</option>
                                  </>
                                )}
                                {t.reconciliationStatus === "flagged" && (
                                  <option value="resolve_anomaly">⚠️ Resolve Anomaly</option>
                                )}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                      {data.transactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-secondary text-sm">
                            No transactions found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </GlassCard>
              </div>
            )}
          </FiveStateRenderer>
        </div>
      )}

      {/* TAB 2: BANK AUTO-RECONCILIATION ENGINE */}
      {activeTab === "bank_reconcile" && (
        <BankReconciliationTab schoolId={schoolId} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ledgerSnapshot"] })} />
      )}

      {/* TAB 3: OCR SCANNER */}
      {activeTab === "ocr" && (
        <div className="max-w-3xl space-y-6">
          <GlassCard className="space-y-4 p-6 border-[#0F5A47]/15">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-[#0F5A47]" />
              Upload Statement or Cheque Image
            </h2>
            <p className="text-xs text-text-secondary">
              Upload a physical cheque or bank receipt image URL to extract details via Gemini AI. Staged previews do not affect ledger balances until confirmed.
            </p>
            <div className="flex gap-3">
              <input
                type="url"
                value={ocrImageUrl}
                onChange={(e) => setOcrImageUrl(e.target.value)}
                placeholder="https://your-storage.supabase.co/receipt.jpg"
                disabled={ocrStage.type === "processing" || isOcrPending}
                className="flex-1 rounded-xl px-4 py-2.5 text-xs text-text-primary bg-white border border-border-glass focus:outline-none focus:border-[#0F5A47]"
              />
              <button
                type="button"
                onClick={handleOcrProcess}
                disabled={!ocrImageUrl.trim() || isOcrPending || ocrStage.type === "processing"}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] shadow-md hover:opacity-95 disabled:opacity-40 transition-all"
              >
                {ocrStage.type === "processing" ? "Analyzing..." : "Analyze with Gemini"}
              </button>
            </div>
          </GlassCard>

          {(ocrStage.type === "staged" || ocrStage.type === "confirming") && (
            <GlassCard className="space-y-4 p-6 border-[#0F5A47]/20">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-text-primary">Staged Extraction Preview</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#059669]/10 text-[#059669] border border-[#059669]/20">
                  {ocrStage.type === "staged" ? `${ocrStage.extraction.confidence} confidence` : "Processing"}
                </span>
              </div>

              {ocrStage.type === "staged" && ocrStage.extraction.extractionNotes && (
                <div className="text-xs p-3 rounded-xl bg-white/80 border border-border-glass text-text-secondary">
                  <span className="font-semibold text-text-primary">Gemini notes: </span>
                  {ocrStage.extraction.extractionNotes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Fee Assignment ID *</label>
                  <input
                    type="text"
                    value={ocrFeeAssignmentId}
                    onChange={(e) => setOcrFeeAssignmentId(e.target.value)}
                    placeholder="Fee assignment ID"
                    className="w-full rounded-xl px-3 py-2 text-xs bg-white border border-border-glass focus:outline-none focus:border-[#0F5A47]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    value={ocrAmount}
                    onChange={(e) => setOcrAmount(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs bg-white border border-border-glass focus:outline-none focus:border-[#0F5A47]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Channel *</label>
                  <select
                    value={ocrChannel}
                    onChange={(e) => setOcrChannel(e.target.value as "cash" | "cheque")}
                    className="w-full rounded-xl px-3 py-2 text-xs bg-white border border-border-glass focus:outline-none focus:border-[#0F5A47]"
                  >
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Reference / Cheque No.</label>
                  <input
                    type="text"
                    value={ocrRefNumber}
                    onChange={(e) => setOcrRefNumber(e.target.value)}
                    placeholder="Ref or cheque number"
                    className="w-full rounded-xl px-3 py-2 text-xs bg-white border border-border-glass focus:outline-none focus:border-[#0F5A47]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOcrConfirm}
                  disabled={!ocrFeeAssignmentId || !ocrAmount || Number(ocrAmount) <= 0 || isOcrPending}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0F5A47] hover:bg-[#0D7A5F] shadow-md transition-all disabled:opacity-40"
                >
                  Confirm & Post to Master Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setOcrStage({ type: "idle" })}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-text-secondary hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </GlassCard>
          )}

          {ocrStage.type === "confirmed" && (
            <GlassCard className="p-6 border-[#059669]/30 bg-[#059669]/5 space-y-2">
              <h3 className="text-sm font-bold text-[#059669]">✓ Payment Successfully Posted</h3>
              <p className="text-xs text-text-secondary">Transaction ID: {ocrStage.transactionId}</p>
              <button
                type="button"
                onClick={() => setOcrStage({ type: "idle" })}
                className="mt-2 text-[#0F5A47] underline text-xs font-bold"
              >
                Scan Another Document
              </button>
            </GlassCard>
          )}
        </div>
      )}

      {/* TAB 4: OFFLINE SYNC */}
      {activeTab === "offline" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-text-primary">Local Pending Queue & Conflicts</h2>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] shadow-md hover:opacity-95 disabled:opacity-50 transition-all"
            >
              {syncing ? "Syncing Network..." : "Sync Now"}
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Device Queue ({localQueue.length})</h3>
            {localQueue.length === 0 ? (
              <GlassCard className="p-6 text-center text-xs text-text-secondary">
                No offline payments queued on this browser session.
              </GlassCard>
            ) : (
              localQueue.map((entry) => (
                <GlassCard key={entry.local_id} weight="list-row" className="flex justify-between items-center p-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-text-primary uppercase text-xs">{entry.channel}</span>
                      <span className="text-[#0F5A47] font-bold text-sm">₹{entry.amount}</span>
                      <OfflineSyncStatusBadge status={entry.status} />
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1">Queued at: {new Date(entry.queued_at).toLocaleString()}</p>
                  </div>
                </GlassCard>
              ))
            )}
          </div>

          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Server Sync Conflicts ({serverConflicts.length})</h3>
            {serverConflicts.length === 0 ? (
              <GlassCard className="p-6 text-center text-xs text-text-secondary">
                No unresolved sync conflicts across the school.
              </GlassCard>
            ) : (
              serverConflicts.map((conflict: any) => (
                <GlassCard key={conflict.id} weight="list-row" className="border-red-500/30 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-text-primary uppercase text-xs">{conflict.channel}</span>
                        <span className="text-text-primary font-bold text-sm">₹{conflict.amount.toString()}</span>
                        <OfflineSyncStatusBadge status="conflict" />
                      </div>
                      <p className="text-xs text-red-600 font-medium mt-1">Conflict Reason: {conflict.conflictReason}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(conflict.id, "discarded")}
                        disabled={resolvingId === conflict.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-700 hover:bg-red-500/20"
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conflict.id, "reentered_adjusted")}
                        disabled={resolvingId === conflict.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0F5A47]/10 text-[#0F5A47] hover:bg-[#0F5A47]/20"
                      >
                        Resolve Re-entered
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      )}

      {/* Transaction Inspector Drawer */}
      {inspectedTxId && (
        <TransactionInspectorDrawer
          transactionId={inspectedTxId}
          onClose={() => setInspectedTxId(null)}
          onGenerateReceipt={handleGenerateReceipt}
          onOpenPosReceipt={(tx) => setPosReceiptTx(tx)}
        />
      )}

      {/* Inline Receipt Modal */}
      {receiptTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#F4F1EA] rounded-2xl p-6 max-w-md w-full border border-border-glass shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-glass pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#0F5A47]" />
                Download GST Receipt
              </h3>
              <button onClick={() => setReceiptTx(null)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 text-xs text-text-secondary">
              <p><span className="font-semibold text-text-primary">Student:</span> {receiptTx.studentName ?? receiptTx.student?.name}</p>
              <p><span className="font-semibold text-text-primary">Amount:</span> ₹{receiptTx.amount}</p>
              <p><span className="font-semibold text-text-primary">Channel:</span> {receiptTx.channel.toUpperCase()}</p>
              <p><span className="font-semibold text-text-primary">Date:</span> {new Date(receiptTx.postedAt).toLocaleDateString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  handleGenerateReceipt(receiptTx.id, "a4");
                  setReceiptTx(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-white border border-border-glass text-xs font-bold text-text-primary hover:bg-black/5 flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-[#0F5A47]" />
                A4 PDF Receipt
              </button>
              <button
                onClick={() => {
                  handleGenerateReceipt(receiptTx.id, "thermal");
                  setReceiptTx(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold shadow-md hover:opacity-95 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Thermal Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Actions Modal (Anomaly, Clear, Bounce, Reverse, Penalty) */}
      {activeTx && actionType && (
        <TransactionActionsModal
          adminId={adminId}
          schoolId={schoolId}
          transaction={activeTx}
          actionType={actionType}
          onClose={() => {
            setActiveTx(null);
            setActionType(null);
          }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ledgerSnapshot"] })}
        />
      )}

      {/* POS Thermal Receipt (80mm) Modal */}
      {posReceiptTx && (
        <PosReceiptModal
          transaction={posReceiptTx}
          onClose={() => setPosReceiptTx(null)}
        />
      )}
    </div>
  );
}
