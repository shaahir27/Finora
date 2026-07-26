"use client";

import { useState } from "react";
import {
  getStudentProfile,
  updateStudentStatus,
  updateStudent,
} from "@/app/actions/students";
import { applyWaiver } from "@/app/actions/ledger";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { RecordPaymentModal } from "./RecordPaymentModal";
import toast from "react-hot-toast";
import {
  X,
  Tag,
  FileText,
  CreditCard,
  History,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  User,
  Info,
  Calendar,
  CheckCircle2,
} from "lucide-react";

export function StudentProfileClient({
  schoolId,
  studentId,
}: {
  schoolId: string;
  studentId: string;
}) {
  const [activeTab, setActiveTab] = useState<"assignments" | "history">("assignments");

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("graduated");
  const [balanceDisposition, setBalanceDisposition] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    class: "",
    admissionNumber: "",
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Waiver Modal State
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverAssignmentId, setWaiverAssignmentId] = useState("");
  const [waiverAmount, setWaiverAmount] = useState("");
  const [waiverReason, setWaiverReason] = useState("Sibling Concession");
  const [waiverSubmitting, setWaiverSubmitting] = useState(false);

  const state = useDataState({
    queryKey: ["studentProfile", schoolId, studentId],
    queryFn: () => getStudentProfile(schoolId, studentId),
  });

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setUpdateError("");
    try {
      await updateStudentStatus(studentId, "seed-admin-01", {
        status: newStatus as any,
        balanceDisposition: balanceDisposition
          ? (balanceDisposition as any)
          : undefined,
      });
      setShowStatusModal(false);
      window.location.reload();
    } catch (err: any) {
      setUpdateError(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleApplyWaiverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiverAssignmentId || !waiverAmount || Number(waiverAmount) <= 0) {
      toast.error("Please enter a valid waiver amount");
      return;
    }

    try {
      setWaiverSubmitting(true);
      await applyWaiver("seed-admin-01", schoolId, waiverAssignmentId, {
        amount: Number(waiverAmount),
        reason: waiverReason,
      });
      toast.success(`Applied ₹${waiverAmount} waiver under "${waiverReason}"`);
      setShowWaiverModal(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply waiver");
    } finally {
      setWaiverSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans">
      <FiveStateRenderer state={state}>
        {(data) => {
          let totalAssigned = 0;
          let totalPaid = 0;
          let totalWaived = 0;
          const allTransactions: any[] = [];

          for (const a of data.feeAssignments) {
            totalAssigned += Number(a.amount);
            for (const tx of a.transactions) {
              allTransactions.push({ ...tx, feeTypeName: a.feeType.name });
              if (tx.reconciliationStatus === "posted") {
                totalPaid += Number(tx.amount);
              }
            }
            for (const w of a.waivers) {
              totalWaived += Number(w.amount);
            }
          }

          const totalBalance = Math.max(0, totalAssigned - totalPaid - totalWaived);

          const payableAssignments = data.feeAssignments
            .map((a: any) => {
              const pd = a.transactions
                .filter((t: any) => t.reconciliationStatus === "posted")
                .reduce((s: number, t: any) => s + Number(t.amount), 0);
              const wv = a.waivers.reduce(
                (s: number, w: any) => s + Number(w.amount),
                0
              );
              const remaining = Math.max(0, Number(a.amount) - pd - wv);
              return {
                id: a.id,
                feeTypeName: a.feeType.name,
                remainingBalance: remaining,
              };
            })
            .filter((a: any) => a.remainingBalance > 0);

          const parentInfo = (data as any).guardianOf?.[0]?.parentLink?.user ?? (data as any).parentLinks?.[0]?.parentLink?.user;

          return (
            <div className="space-y-6 sm:space-y-8">
              {/* Header Profile Dossier Card */}
              <GlassCard className="p-5 sm:p-6 border-[#0F5A47]/15 bg-white/90 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] text-white flex items-center justify-center font-extrabold text-2xl shadow-md">
                      {data.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
                          {data.name}
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#0F5A47]/10 text-[#0F5A47]">
                          Class {data.class}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Admission #: <span className="font-mono font-bold">{data.admissionNumber || "N/A"}</span>
                        {" • "}
                        Guardian: <span className="font-semibold text-text-primary">{parentInfo?.email || "Not linked"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    {payableAssignments.length > 0 && (
                      <>
                        <button
                          onClick={() => {
                            setShowPaymentModal(true);
                          }}
                          className="flex-1 lg:flex-none px-4 py-2 bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Record Payment
                        </button>
                        <button
                          onClick={() => {
                            if (payableAssignments[0]?.id) {
                              setWaiverAssignmentId(payableAssignments[0].id);
                            }
                            setShowWaiverModal(true);
                          }}
                          className="flex-1 lg:flex-none px-4 py-2 bg-white border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-bold rounded-xl hover:bg-[#0F5A47] hover:text-white shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Apply Waiver
                        </button>
                      </>
                    )}
                    <QuickActionButton
                      label="Change Status"
                      onClick={() => setShowStatusModal(true)}
                    />
                    <QuickActionButton
                      label="Edit Profile"
                      onClick={() => {
                        setEditData({
                          name: data.name,
                          class: data.class,
                          admissionNumber: data.admissionNumber || "",
                        });
                        setShowEditModal(true);
                      }}
                    />
                  </div>
                </div>

                {/* Parent & Guardian Contact Information Drawer */}
                {parentInfo && (
                  <div className="pt-3 border-t border-border-glass grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-text-secondary bg-white/60 p-2.5 rounded-xl border border-border-glass">
                      <User className="w-4 h-4 text-[#0F5A47]" />
                      <div>
                        <span className="text-[10px] text-text-secondary block font-bold uppercase">Parent Guardian</span>
                        <span className="font-bold text-text-primary">Demo Parent ({parentInfo.email})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary bg-white/60 p-2.5 rounded-xl border border-border-glass">
                      <Phone className="w-4 h-4 text-[#0F5A47]" />
                      <div>
                        <span className="text-[10px] text-text-secondary block font-bold uppercase">Phone Number</span>
                        <span className="font-bold text-text-primary">{parentInfo.phone || "+91 99999 99999"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary bg-white/60 p-2.5 rounded-xl border border-border-glass">
                      <Mail className="w-4 h-4 text-[#0F5A47]" />
                      <div>
                        <span className="text-[10px] text-text-secondary block font-bold uppercase">Account Status</span>
                        <span className="font-bold text-[#059669]">Verified Parent App Access</span>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* Financial Metrics Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <GlassCard className="p-4 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:shadow-md transition-all">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary block mb-1">
                    Total Fee Assigned
                  </span>
                  <p className="text-2xl font-extrabold text-text-primary">
                    ₹{totalAssigned.toLocaleString("en-IN")}
                  </p>
                </GlassCard>

                <GlassCard className="p-4 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:shadow-md transition-all">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary block mb-1">
                    Total Fees Paid
                  </span>
                  <p className="text-2xl font-extrabold text-[#059669]">
                    ₹{totalPaid.toLocaleString("en-IN")}
                  </p>
                </GlassCard>

                <GlassCard className="p-4 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:shadow-md transition-all">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary block mb-1">
                    Waivers / Concessions
                  </span>
                  <p className="text-2xl font-extrabold text-[#0D7A5F]">
                    ₹{totalWaived.toLocaleString("en-IN")}
                  </p>
                </GlassCard>

                <GlassCard className="p-4 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:shadow-md transition-all">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary block mb-1">
                    Net Outstanding Dues
                  </span>
                  <p
                    className={`text-2xl font-extrabold ${
                      totalBalance > 0 ? "text-[#DC2626]" : "text-[#059669]"
                    }`}
                  >
                    ₹{totalBalance.toLocaleString("en-IN")}
                  </p>
                </GlassCard>
              </div>

              {/* 2-Tab Segmented View Container */}
              <div className="space-y-6 pt-2">
                <div className="p-1 bg-[#EBE7DF] rounded-2xl flex gap-1.5 border border-[#0F5A47]/15 w-fit shadow-xs">
                  <button
                    onClick={() => setActiveTab("assignments")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "assignments"
                        ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Fee Assignments ({data.feeAssignments.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === "history"
                        ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Payment History ({allTransactions.length})
                  </button>
                </div>

                {/* TAB 1: FEE ASSIGNMENTS LEDGER */}
                {activeTab === "assignments" && (
                  <div className="space-y-5">
                    {data.feeAssignments.map((assignment: any) => {
                      const pd = assignment.transactions
                        .filter((t: any) => t.reconciliationStatus === "posted")
                        .reduce((s: number, t: any) => s + Number(t.amount), 0);
                      const wv = assignment.waivers.reduce(
                        (s: number, w: any) => s + Number(w.amount),
                        0
                      );
                      const totalAssignedAmt = Number(assignment.amount);
                      const remBal = Math.max(0, totalAssignedAmt - pd - wv);
                      const progressPct = Math.min(
                        100,
                        Math.round(((pd + wv) / totalAssignedAmt) * 100)
                      );

                      const dueDateObj = new Date(assignment.dueDate);
                      const isOverdue = remBal > 0 && dueDateObj < new Date();
                      const daysOverdue = isOverdue
                        ? Math.floor((Date.now() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
                        : 0;

                      return (
                        <GlassCard
                          key={assignment.id}
                          weight="list-row"
                          className="p-5 sm:p-6 border-[#0F5A47]/15 space-y-4 bg-white/90 shadow-xs"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-extrabold text-text-primary text-base">
                                  {assignment.feeType.name}
                                </h4>
                                <span
                                  className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full tracking-wider ${
                                    remBal === 0
                                      ? "bg-[#059669]/10 text-[#059669] border border-[#059669]/20"
                                      : "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20"
                                  }`}
                                >
                                  {remBal === 0 ? "PAID IN FULL" : `₹${remBal.toLocaleString("en-IN")} OUTSTANDING`}
                                </span>

                                {isOverdue && (
                                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-red-500/10 text-red-700 border border-red-500/20 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {daysOverdue} Days Overdue
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-text-secondary font-medium">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-[#0F5A47]" />
                                  Due Date: {dueDateObj.toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Info className="w-3.5 h-3.5 text-[#0F5A47]" />
                                  SAC Code: 9992 (GST Exempt per Notif 12/2017)
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-text-secondary font-bold uppercase block">
                                Assigned Fee
                              </span>
                              <p className="font-extrabold text-[#0F5A47] text-lg">
                                ₹{totalAssignedAmt.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>

                          {/* Payment Progress Bar */}
                          <div className="space-y-1.5 bg-white/60 p-3 rounded-xl border border-border-glass">
                            <div className="flex justify-between text-xs font-bold text-text-secondary">
                              <span>Settlement Progress</span>
                              <span>{progressPct}% Cleared ({pd > 0 ? `₹${pd.toLocaleString('en-IN')} Paid` : 'Unpaid'})</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-black/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#0F5A47] to-[#059669] rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Itemized Waivers Breakdown */}
                          {assignment.waivers && assignment.waivers.length > 0 && (
                            <div className="pt-2 border-t border-border-glass text-xs space-y-1.5 bg-white/70 p-3 rounded-xl">
                              <span className="font-extrabold text-[#0D7A5F] block text-xs">
                                Applied Concessions & Scholarships:
                              </span>
                              {assignment.waivers.map((w: any) => (
                                <div
                                  key={w.id}
                                  className="flex justify-between text-text-secondary font-medium text-xs"
                                >
                                  <span>• {w.reason}</span>
                                  <span className="font-bold text-[#059669]">
                                    -₹{Number(w.amount).toLocaleString("en-IN")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </GlassCard>
                      );
                    })}
                  </div>
                )}

                {/* TAB 2: PAYMENT HISTORY LEDGER */}
                {activeTab === "history" && (
                  <GlassCard className="overflow-x-auto p-5 border-[#0F5A47]/15 bg-white/90">
                    {allTransactions.length === 0 ? (
                      <p className="text-center py-8 text-xs text-text-secondary">
                        No payment transactions recorded for this student yet.
                      </p>
                    ) : (
                      <table className="w-full text-sm text-left min-w-[600px]">
                        <thead className="text-[10px] uppercase text-text-secondary bg-white/60 border-b border-border-glass">
                          <tr>
                            <th className="px-3.5 py-3 font-bold">Date</th>
                            <th className="px-3.5 py-3 font-bold">Fee Category</th>
                            <th className="px-3.5 py-3 font-bold">Channel</th>
                            <th className="px-3.5 py-3 text-right font-bold">Amount</th>
                            <th className="px-3.5 py-3 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-glass">
                          {allTransactions.map((tx: any) => (
                            <tr key={tx.id} className="hover:bg-white/60 transition-colors">
                              <td className="px-3.5 py-3 text-xs text-text-primary font-medium">
                                {new Date(tx.postedAt).toLocaleDateString()}
                              </td>
                              <td className="px-3.5 py-3 text-xs font-bold text-text-primary">
                                {tx.feeTypeName}
                              </td>
                              <td className="px-3.5 py-3 text-xs uppercase font-bold text-text-secondary">
                                {tx.channel}
                              </td>
                              <td className="px-3.5 py-3 text-right text-xs font-extrabold text-[#0F5A47]">
                                ₹{Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3.5 py-3">
                                <span
                                  className={`px-2.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full tracking-wider ${
                                    tx.reconciliationStatus === "posted"
                                      ? "bg-[#059669]/10 text-[#059669] border border-[#059669]/20"
                                      : "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20"
                                  }`}
                                >
                                  {tx.reconciliationStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </GlassCard>
                )}
              </div>

              {/* Audit-Backed Waiver & Concession Modal */}
              {showWaiverModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md bg-[#F4F1EA] p-6 border-border-glass shadow-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-border-glass pb-3">
                      <div className="flex items-center gap-2 text-[#0F5A47]">
                        <Tag className="w-5 h-5" />
                        <h2 className="text-lg font-bold">Apply Fee Waiver</h2>
                      </div>
                      <button onClick={() => setShowWaiverModal(false)}>
                        <X className="w-5 h-5 text-text-secondary" />
                      </button>
                    </div>

                    <form onSubmit={handleApplyWaiverSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Target Fee Assignment *
                        </label>
                        <select
                          required
                          value={waiverAssignmentId}
                          onChange={(e) => setWaiverAssignmentId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                        >
                          {payableAssignments.map((a: any) => (
                            <option key={a.id} value={a.id}>
                              {a.feeTypeName} (Bal: ₹{a.remainingBalance})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Waiver Amount (₹) *
                        </label>
                        <input
                          required
                          type="number"
                          min={1}
                          placeholder="e.g. 2000"
                          value={waiverAmount}
                          onChange={(e) => setWaiverAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Concession Category / Reason *
                        </label>
                        <select
                          required
                          value={waiverReason}
                          onChange={(e) => setWaiverReason(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                        >
                          <option value="Sibling Concession">
                            Sibling Concession (2nd Child)
                          </option>
                          <option value="Merit Scholarship">Merit Scholarship</option>
                          <option value="Staff Benefit Concession">
                            Staff Benefit Concession
                          </option>
                          <option value="Financial Hardship Relief">
                            Financial Hardship Relief
                          </option>
                          <option value="EWS Scheme Concession">
                            EWS Scheme Concession
                          </option>
                        </select>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowWaiverModal(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-black/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={waiverSubmitting}
                          className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] shadow-md transition-all"
                        >
                          {waiverSubmitting ? "Applying..." : "Apply Waiver"}
                        </button>
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* Status Change Modal */}
              {showStatusModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md bg-[#F4F1EA] p-6 border-border-glass shadow-2xl space-y-4">
                    <h2 className="text-lg font-bold text-text-primary">
                      Change Student Status
                    </h2>
                    <form onSubmit={handleStatusChange} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          New Status
                        </label>
                        <select
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="withdrawn">Withdrawn</option>
                          <option value="graduated">Graduated</option>
                          <option value="transferred">Transferred</option>
                        </select>
                      </div>

                      {newStatus !== "active" && totalBalance > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary mb-1">
                            Balance Disposition
                          </label>
                          <p className="text-xs text-red-600 font-semibold mb-2">
                            Student has ₹{totalBalance} remaining balance. Select handling strategy:
                          </p>
                          <select
                            required
                            className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                            value={balanceDisposition}
                            onChange={(e) => setBalanceDisposition(e.target.value)}
                          >
                            <option value="">Select action...</option>
                            <option value="write_off">
                              Write-off as Bad Debt (Apply Waiver)
                            </option>
                            <option value="carry_forward">Carry Forward Balance</option>
                          </select>
                        </div>
                      )}

                      {updateError && (
                        <div className="text-red-600 text-xs p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                          {updateError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowStatusModal(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-black/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updating}
                          className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] shadow-md transition-all"
                        >
                          Save Status
                        </button>
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* Edit Profile Modal */}
              {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <GlassCard className="w-full max-w-md bg-[#F4F1EA] p-6 border-border-glass shadow-2xl space-y-4">
                    <h2 className="text-lg font-bold text-text-primary">
                      Edit Student Profile
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setUpdating(true);
                        setUpdateError("");
                        try {
                          await updateStudent(studentId, editData);
                          setShowEditModal(false);
                          window.location.reload();
                        } catch (err: any) {
                          setUpdateError(err.message || "Failed to edit profile");
                        } finally {
                          setUpdating(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Full Name *
                        </label>
                        <input
                          required
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Class *
                        </label>
                        <input
                          required
                          type="text"
                          value={editData.class}
                          onChange={(e) =>
                            setEditData({ ...editData, class: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Admission Number
                        </label>
                        <input
                          type="text"
                          value={editData.admissionNumber}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              admissionNumber: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-border-glass rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                        />
                      </div>

                      {updateError && (
                        <div className="text-red-600 text-xs p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                          {updateError}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowEditModal(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-black/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updating}
                          className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] shadow-md transition-all"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </GlassCard>
                </div>
              )}

              {/* Record Payment Modal */}
              {showPaymentModal && (
                <RecordPaymentModal
                  schoolId={schoolId}
                  adminId="seed-admin-01"
                  assignments={payableAssignments}
                  onClose={() => setShowPaymentModal(false)}
                  onSuccess={() => window.location.reload()}
                />
              )}
            </div>
          );
        }}
      </FiveStateRenderer>
    </div>
  );
}
