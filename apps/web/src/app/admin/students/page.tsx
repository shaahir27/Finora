"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStudents } from "@/app/actions/students";
import { getDefaulters, queueRemindersForStudent, escalateDefaulterScore, batchQueueRemindersAction } from "@/app/actions/defaulters";
import { narrateDefaulterInsightAction, draftReminderTextForStudentAction } from "@/app/actions/ai";
import { createParentAccount } from "@/app/actions/parents";
import { useDataState } from "@/lib/useDataState";
import { FiveStateRenderer } from "@/components/FiveStateRenderer";
import { GlassCard } from "@/components/GlassCard";
import { QuickActionButton } from "@/components/QuickActionButton";
import { RiskBadge } from "@/components/RiskBadge";
import { AddStudentModal, ImportCsvModal } from "./StudentModals";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Users, AlertTriangle, UserPlus, Sparkles, X, Send, Copy } from "lucide-react";

export default function StudentsDirectoryPage() {
  const router = useRouter();
  const schoolId = DEMO_SCHOOL_ID;
  const queryClient = useQueryClient();

  // Segmented Workspace Tab: "students" | "defaulters"
  const [activeTab, setActiveTab] = useState<"students" | "defaulters">("students");

  // Search state for All Students
  const [search, setSearch] = useState("");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

  // Parent Account Link Form State
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [parentLoading, setParentLoading] = useState(false);

  // AI Insights & AI Draft Reminder Text State
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});
  const [aiDraftModal, setAiDraftModal] = useState<{ studentId: string; studentName: string; text: string } | null>(null);
  const [draftingText, setDraftingText] = useState(false);

  // All Students Query State
  const studentsState = useDataState({
    queryKey: ['students', schoolId, search],
    queryFn: () => getStudents(schoolId, { search, limit: 50 }),
  });

  // Defaulters Query State
  const defaultersState = useDataState({
    queryKey: ['defaulters', schoolId],
    queryFn: () => getDefaulters(schoolId),
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
    window.location.reload();
  };

  const handleFetchAiInsight = async (studentId: string) => {
    setLoadingAi((prev) => ({ ...prev, [studentId]: true }));
    try {
      const insight = await narrateDefaulterInsightAction(schoolId, studentId);
      if (insight) {
        setAiInsights((prev) => ({ ...prev, [studentId]: insight }));
        toast.success("AI Insight generated");
      } else {
        toast.error("Could not generate AI insight.");
      }
    } catch {
      toast.error("Failed to generate AI insight.");
    } finally {
      setLoadingAi((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const handleGenerateAiDraftText = async (studentId: string, studentName: string) => {
    setDraftingText(true);
    try {
      const draft = await draftReminderTextForStudentAction(schoolId, studentId, "whatsapp");
      if (!draft) {
        toast.error("This student has no overdue balance to draft a reminder for.");
        return;
      }
      setAiDraftModal({ studentId, studentName, text: draft.draftedText });
      toast.success("✨ AI Reminder drafted!");
    } catch {
      toast.error("Failed to draft AI reminder text.");
    } finally {
      setDraftingText(false);
    }
  };

  const handleSendReminder = async (studentId: string) => {
    try {
      const res = await queueRemindersForStudent(schoolId, studentId);
      if (res.queuedCount > 0) {
        toast.success(`${res.queuedCount} reminder(s) queued successfully!`);
      } else {
        toast.error("No overdue assignments to remind for, or reminder already exists.");
      }
    } catch {
      toast.error("Failed to queue reminder.");
    }
  };

  const handleEscalate = async (studentId: string) => {
    if (!confirm("Escalate this student to High risk? This will be visible to all admins immediately.")) return;
    try {
      await escalateDefaulterScore(schoolId, studentId);
      toast.success("Student risk level escalated to High!");
      queryClient.invalidateQueries({ queryKey: ['defaulters', schoolId] });
    } catch {
      toast.error("Failed to escalate.");
    }
  };

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      toast.error("Select at least one student to link.");
      return;
    }
    setParentLoading(true);
    try {
      await createParentAccount(schoolId, {
        name: parentName,
        phone: parentPhone,
        ...(parentEmail ? { email: parentEmail } : {}),
        studentIds: selectedStudentIds,
      });
      toast.success("Parent account linked successfully!");
      setShowParentModal(false);
      setParentName("");
      setParentPhone("");
      setParentEmail("");
      setSelectedStudentIds([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to link parent account");
    } finally {
      setParentLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Workspace Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Students & Families</h1>
        <p className="text-text-secondary text-sm">Student directory, defaulters scoreboard, AI reminder drafts, and parent account links.</p>
      </div>

      {/* Segmented Workspace Controller */}
      <div className="flex bg-white/70 p-1.5 rounded-2xl border border-border-glass max-w-md shadow-sm">
        <button
          onClick={() => setActiveTab("students")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "students"
              ? "bg-[#0F5A47] text-white shadow-md"
              : "text-text-secondary hover:text-text-primary hover:bg-black/5"
          }`}
        >
          <Users className="w-4 h-4" />
          All Students
        </button>
        <button
          onClick={() => setActiveTab("defaulters")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "defaulters"
              ? "bg-[#0F5A47] text-white shadow-md"
              : "text-text-secondary hover:text-text-primary hover:bg-black/5"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Defaulters & Reminders
        </button>
      </div>

      {/* TAB 1: ALL STUDENTS */}
      {activeTab === "students" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <input 
              type="text" 
              placeholder="Search by student name or admission #" 
              className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-border-glass bg-white text-text-primary focus:outline-none focus:border-[#0F5A47] text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowParentModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F5A47]/10 hover:bg-[#0F5A47]/20 text-[#0F5A47] border border-[#0F5A47]/20 font-semibold text-xs transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add Parent Link
              </button>
              <QuickActionButton label="Import CSV" onClick={() => setShowImportModal(true)} />
              <QuickActionButton label="Add Student" onClick={() => setShowAddModal(true)} />
            </div>
          </div>

          <FiveStateRenderer state={studentsState}>
            {(data) => {
              if (data.students.length === 0) {
                return (
                  <GlassCard className="text-center p-12 border-[#0F5A47]/15">
                    <p className="text-text-secondary text-sm">No student records found matching search query.</p>
                  </GlassCard>
                );
              }

              return (
                <div className="space-y-5 sm:space-y-6">
                  {data.students.map(student => (
                    <GlassCard key={student.id} weight="list-row" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 sm:p-6 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:shadow-md hover:-translate-y-0.5 transition-all bg-white/90">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-text-primary text-sm">{student.name}</h3>
                          <span className="text-xs font-mono text-text-secondary">#{student.admissionNumber}</span>
                          {student.status !== "active" && (
                            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20">
                              {student.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">
                          Class: <span className="font-medium text-text-primary">{student.class}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Total Balance</p>
                          <p className={`text-sm font-bold ${student.totalBalance > 0 ? "text-[#DC2626]" : "text-[#059669]"}`}>
                            ₹{student.totalBalance.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <a href={`/admin/students/${student.id}`} className="text-xs font-bold text-[#0F5A47] hover:underline">
                          View Profile Drawer &rarr;
                        </a>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              );
            }}
          </FiveStateRenderer>
        </div>
      )}

      {/* TAB 2: DEFAULTERS SCOREBOARD */}
      {activeTab === "defaulters" && (
        <div className="space-y-6">
          <FiveStateRenderer state={defaultersState}>
            {(data) => {
              if (data.length === 0) {
                return (
                  <GlassCard className="text-center p-12 border-[#0F5A47]/15">
                    <p className="text-text-secondary text-sm">No active defaulters flagged. All fee dues cleared!</p>
                  </GlassCard>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Grade-Wise Defaulter Risk Heatmap Card */}
                  <div className="p-5 bg-white/90 border border-[#0F5A47]/20 rounded-2xl shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h3 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider">
                          Grade-Wise Defaulter Risk Heatmap
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-[#0F5A47] uppercase bg-[#0F5A47]/10 px-2.5 py-0.5 rounded-full">
                        AI Risk Distribution
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(
                        data.reduce((acc: Record<string, number>, d: any) => {
                          const grade = d.studentClass || "General";
                          acc[grade] = (acc[grade] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([grade, count]) => (
                        <div key={grade} className="p-3 bg-[#F4F1EA] rounded-xl border border-[#0F5A47]/15 space-y-1">
                          <span className="text-[10px] font-bold text-[#475569] block">Class {grade}</span>
                          <p className="text-lg font-extrabold text-[#D97706]">
                            {count as number} Defaulter{(count as number) === 1 ? "" : "s"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Batch Action Header Bar */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-2xl border border-[#0F5A47]/15 shadow-xs">
                    <div>
                      <h2 className="text-sm font-extrabold text-text-primary">Defaulters Scoreboard ({data.length})</h2>
                      <p className="text-xs text-text-secondary">Proactive automated reminder queueing</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const studentIds = data.map((d: any) => d.studentId);
                          const res = await batchQueueRemindersAction(schoolId, studentIds);
                          toast.success(`Batch queued ${res.count} reminder(s) across ${data.length} defaulters!`);
                        } catch (err: any) {
                          toast.error(err.message || "Batch reminder queueing failed");
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <span>⚡ Batch Send Reminders (All {data.length})</span>
                    </button>
                  </div>
                  {data.map(defaulter => (
                    <GlassCard key={defaulter.studentId} weight="list-row" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 sm:p-6 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:shadow-md hover:-translate-y-0.5 transition-all bg-white/90">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-text-primary text-sm">{defaulter.studentName}</h3>
                          <span className="text-xs font-mono text-text-secondary">#{defaulter.admissionNumber}</span>
                          <RiskBadge level={defaulter.riskLevel === 3 ? "high" : defaulter.riskLevel === 2 ? "medium" : "low"} />
                        </div>
                        <p className="text-xs text-text-secondary">
                          Remaining Balance: <span className="font-bold text-[#DC2626]">₹{defaulter.remainingBalance.toLocaleString('en-IN')}</span> 
                          {" • "} 
                          <span className="font-semibold text-text-primary">{defaulter.maxDaysOverdue} days overdue</span>
                        </p>
                        <p className="text-xs text-text-secondary italic">
                          {aiInsights[defaulter.studentId] ? (
                            <span className="text-[#0F5A47] font-semibold">
                              ✨ AI Insight: {aiInsights[defaulter.studentId]}
                            </span>
                          ) : (
                            defaulter.computedReason
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleFetchAiInsight(defaulter.studentId)}
                          disabled={loadingAi[defaulter.studentId]}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0F5A47]/10 text-[#0F5A47] hover:bg-[#0F5A47]/20 border border-[#0F5A47]/20 transition-all flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {loadingAi[defaulter.studentId] ? "Analyzing..." : "AI Insight"}
                        </button>

                        <button
                          onClick={() => handleGenerateAiDraftText(defaulter.studentId, defaulter.studentName)}
                          disabled={draftingText}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white shadow-md hover:opacity-95 transition-all flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Draft Text
                        </button>

                        <QuickActionButton label="Send Reminder" onClick={() => handleSendReminder(defaulter.studentId)} />
                        <QuickActionButton label="Escalate" onClick={() => handleEscalate(defaulter.studentId)} />
                      </div>
                    </GlassCard>
                  ))}
                </div>
              );
            }}
          </FiveStateRenderer>
        </div>
      )}

      {/* AI Draft Text Reminder Modal */}
      {aiDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#F4F1EA] rounded-2xl p-6 max-w-lg w-full border border-border-glass shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-glass pb-3">
              <div className="flex items-center gap-2 text-[#0F5A47]">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-base font-bold text-text-primary">✨ AI Generated WhatsApp / SMS Draft</h3>
              </div>
              <button onClick={() => setAiDraftModal(null)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-text-secondary">
              Personalized reminder message drafted by Gemini for <span className="font-bold text-text-primary">{aiDraftModal.studentName}</span>:
            </p>

            <div className="p-4 bg-white rounded-xl border border-border-glass text-xs font-sans text-text-primary leading-relaxed whitespace-pre-wrap shadow-inner">
              {aiDraftModal.text}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiDraftModal.text);
                  toast.success("Draft copied to clipboard!");
                }}
                className="px-4 py-2 rounded-xl bg-white border border-border-glass text-xs font-bold text-text-primary hover:bg-black/5 transition-all flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-[#0F5A47]" />
                Copy Text
              </button>
              <button
                onClick={() => {
                  handleSendReminder(aiDraftModal.studentId);
                  setAiDraftModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Dispatch Reminder Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Parent Account Link Modal */}
      {showParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#F4F1EA] rounded-2xl p-6 max-w-lg w-full border border-border-glass shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-glass pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0F5A47]" />
                Link Parent & Guardian Credentials
              </h3>
              <button onClick={() => setShowParentModal(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateParent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Parent Full Name *</label>
                <input
                  type="text"
                  required
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full bg-white border border-border-glass rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                  placeholder="e.g. Vikram Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Phone Number (E.164) *</label>
                <input
                  type="tel"
                  required
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full bg-white border border-border-glass rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full bg-white border border-border-glass rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Select Student(s) to Link *</label>
                {studentsState.state === "synced" && (
                  <select
                    multiple
                    value={selectedStudentIds}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedStudentIds(values);
                    }}
                    className="w-full bg-white border border-border-glass rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#0F5A47] h-28"
                  >
                    {studentsState.data.students.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.class}) #{s.admissionNumber}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowParentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={parentLoading || selectedStudentIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#0F5A47] text-white text-xs font-bold shadow-md hover:bg-[#0D7A5F] disabled:opacity-50 transition-all"
                >
                  {parentLoading ? "Linking..." : "Create Parent Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals for Adding Student & Importing CSV */}
      <AddStudentModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        schoolId={schoolId} 
        onSuccess={handleSuccess} 
      />
      
      <ImportCsvModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        schoolId={schoolId} 
        onSuccess={handleSuccess} 
      />
    </div>
  );
}

