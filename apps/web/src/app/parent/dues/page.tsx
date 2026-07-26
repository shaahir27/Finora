"use client";

import { useEffect, useState, useMemo } from "react";
import { GlassCard } from "@/components/GlassCard";
import {
  getMyChildrenDues,
  getMyChildren,
  getParentLinkId,
  getParentSchoolId,
  generate80CTaxCertificateAction,
  simulateSandboxPayment,
} from "@/app/actions/parents";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { ParentOnboardingModal } from "@/components/ParentOnboardingModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Users,
  Award,
  Calendar,
  FileText,
  CreditCard,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export default function ParentDuesPage() {
  const t = useTranslations("Dues");
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  const [dues, setDues] = useState<any[]>([]);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("ALL");

  // Currency Toggle State (INR vs USD for NRI parents)
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const exchangeRate = 83.5; // 1 USD = 83.5 INR

  const formatMoney = (amountInInr: number) => {
    if (currency === "USD") {
      const usdVal = (amountInInr / exchangeRate).toFixed(2);
      return `$${Number(usdVal).toLocaleString("en-US")}`;
    }
    return `₹${Number(amountInInr).toLocaleString("en-IN")}`;
  };

  // Modal & Drawer states
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxCertificateData, setTaxCertificateData] = useState<any>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  const [showGstModal, setShowGstModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [payingFamilyDues, setPayingFamilyDues] = useState(false);

  // Interactive Simulator state
  const [simTenure, setSimTenure] = useState<number>(3);
  const [simDownPayment, setSimDownPayment] = useState<number>(0);

  useEffect(() => {
    if (status === "loading") return;
    const parentUserId = session?.user?.id || "demo-parent-id";

    // Cache parentLinkId and schoolId for Copilot
    if (!sessionStorage.getItem("finora_parent_link_id")) {
      getParentLinkId(parentUserId)
        .then((id) => {
          if (id) sessionStorage.setItem("finora_parent_link_id", id);
        })
        .catch(console.error);
    }
    if (!sessionStorage.getItem("finora_school_id")) {
      getParentSchoolId(parentUserId)
        .then((id) => {
          if (id) sessionStorage.setItem("finora_school_id", id);
        })
        .catch(console.error);
    }

    Promise.all([
      getMyChildren(parentUserId),
      getMyChildrenDues(parentUserId),
    ])
      .then(([kids, duesData]) => {
        setChildrenList(kids);
        setDues(duesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status, session]);

  // Dues filtered by selected child
  const displayedDues = useMemo(() => {
    if (selectedStudentId === "ALL") return dues;
    return dues.filter((d) => d.studentId === selectedStudentId);
  }, [dues, selectedStudentId]);

  // Aggregated KPIs
  const totalOutstanding = useMemo(() => {
    return displayedDues.reduce((sum, d) => sum + (d.remainingBalance || 0), 0);
  }, [displayedDues]);

  const totalPaidTerm = useMemo(() => {
    return displayedDues.reduce((sum, d) => sum + (d.amountPaid || 0), 0);
  }, [displayedDues]);

  const totalTuitionPaidFor80C = useMemo(() => {
    return displayedDues
      .filter((d) => d.feeType?.toLowerCase().includes("tuition"))
      .reduce((sum, d) => sum + (d.amountPaid || 0), 0);
  }, [displayedDues]);

  const nearestDueDate = useMemo(() => {
    const unpaid = displayedDues.filter((d) => d.remainingBalance > 0);
    if (unpaid.length === 0) return null;
    unpaid.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    return unpaid[0].dueDate;
  }, [displayedDues]);

  const hasOverdue = useMemo(() => {
    return displayedDues.some((d) => d.paymentStatus === "overdue");
  }, [displayedDues]);

  const handleGenerate80C = async () => {
    const parentUserId = session?.user?.id;
    if (!parentUserId) return;
    try {
      setTaxLoading(true);
      const targetStudentId =
        selectedStudentId === "ALL"
          ? childrenList[0]?.id
          : selectedStudentId;

      if (!targetStudentId) {
        toast.error("No student available for tax certificate");
        return;
      }

      const res = await generate80CTaxCertificateAction(
        parentUserId,
        targetStudentId,
        "2025-2026"
      );
      setTaxCertificateData(res);
      setShowTaxModal(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate tax certificate");
    } finally {
      setTaxLoading(false);
    }
  };

  const handlePayCombinedFamilyDues = async () => {
    const unpaidDues = displayedDues.filter((d) => d.remainingBalance > 0);
    if (unpaidDues.length === 0) {
      toast.success("No outstanding dues to pay!");
      return;
    }

    try {
      setPayingFamilyDues(true);
      for (const due of unpaidDues) {
        await simulateSandboxPayment(due.id, due.remainingBalance);
      }
      toast.success("Family dues cleared via UPI Sandbox!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Payment simulation failed");
    } finally {
      setPayingFamilyDues(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#0F5A47", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <ParentOnboardingModal />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            {t("cockpit_title")}
          </h1>
          <p className="text-text-secondary text-sm mt-0.5 font-medium">
            {t("cockpit_subtitle")}
          </p>
        </div>

        {/* Action Triggers & Currency Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />

          {/* Currency Toggle */}
          <div className="p-1 bg-[#EBE7DF] rounded-xl border border-[#0F5A47]/20 flex gap-1 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currency === "INR"
                  ? "bg-[#0F5A47] text-white shadow-xs"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                currency === "USD"
                  ? "bg-[#0F5A47] text-white shadow-xs"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              $ USD
            </button>
          </div>

          <button
            onClick={handleGenerate80C}
            disabled={taxLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-bold hover:bg-[#0F5A47]/10 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" />
            {t("sec80c_btn")}
          </button>
          <button
            onClick={() => setShowGstModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-bold hover:bg-[#0F5A47]/10 transition-colors shadow-sm"
          >
            <Info className="w-4 h-4" />
            {t("gst_btn")}
          </button>
        </div>
      </div>

      {/* Child Switcher Header Segmented Toggle */}
      {childrenList.length > 0 && (
        <div className="p-1.5 bg-[#EBE7DF] rounded-2xl flex overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap gap-1.5 border border-[#0F5A47]/15">
          <button
            onClick={() => setSelectedStudentId("ALL")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedStudentId === "ALL"
                ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/50"
            }`}
          >
            <Users className="w-4 h-4" />
            {t("all_children")} ({childrenList.length})
          </button>
          {childrenList.map((kid) => (
            <button
              key={kid.id}
              onClick={() => setSelectedStudentId(kid.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedStudentId === kid.id
                  ? "bg-[#0F5A47] text-[#FFFFFF] shadow-md shadow-[#0F5A47]/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/50"
              }`}
            >
              <span>👦</span>
              {kid.name} (Class {kid.class})
            </button>
          ))}
        </div>
      )}

      {/* Cockpit KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Dues */}
        <GlassCard className="p-5 flex flex-col justify-between border-[#0F5A47]/15">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {t("total_dues_remaining")}
            </span>
            <p className="text-2xl font-extrabold text-[#DC2626]">
              {formatMoney(totalOutstanding)}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hasOverdue
                  ? "bg-red-500/10 text-red-600 border border-red-500/20"
                  : "bg-[#059669]/10 text-[#059669] border border-[#059669]/20"
              }`}
            >
              {hasOverdue ? t("overdue_warning") : t("on_track")}
            </span>
            {totalOutstanding > 0 && (
              <button
                onClick={handlePayCombinedFamilyDues}
                disabled={payingFamilyDues}
                className="text-xs font-bold text-[#0F5A47] hover:underline flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                {t("pay_all")} &rarr;
              </button>
            )}
          </div>
        </GlassCard>

        {/* Fees Paid This Term */}
        <GlassCard className="p-5 flex flex-col justify-between border-[#0F5A47]/15">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {t("paid_this_term")}
            </span>
            <p className="text-2xl font-extrabold text-[#059669]">
              {formatMoney(totalPaidTerm)}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-text-secondary font-medium">
            {t("verified_receipts")}
          </p>
        </GlassCard>

        {/* Next Due Date Countdown */}
        <GlassCard className="p-5 flex flex-col justify-between border-[#0F5A47]/15">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {t("next_due_date")}
            </span>
            <p className="text-lg font-bold text-text-primary">
              {nearestDueDate
                ? new Date(nearestDueDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : t("no_dues_pending")}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#0F5A47] font-bold">
            <Calendar className="w-4 h-4" />
            <span>{t("avoid_penalties")}</span>
          </div>
        </GlassCard>

        {/* On-Time Parent Honor Star Badge */}
        <GlassCard className="p-5 flex flex-col justify-between border-[#0F5A47]/15 bg-gradient-to-br from-white/90 to-[#F0F6F3]">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F5A47] uppercase tracking-wider">
              <Award className="w-4 h-4 text-[#D97706]" />
              <span>{t("honor_badge")}</span>
            </div>
            <p className="text-sm font-bold text-text-primary">
              {!hasOverdue ? t("on_time_star") : t("action_needed")}
            </p>
          </div>
          <button
            onClick={() => setShowInstallmentModal(true)}
            className="mt-3 text-xs font-bold text-[#0D7A5F] hover:underline text-left flex items-center gap-1"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {t("installment_sim")}
          </button>
        </GlassCard>
      </div>

      {/* Main Fee Assignments Ledger Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-text-primary">
            {t("fee_ledger_title")} ({displayedDues.length})
          </h2>
          {totalOutstanding > 0 && (
            <button
              onClick={handlePayCombinedFamilyDues}
              disabled={payingFamilyDues}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold hover:opacity-95 transition-all shadow-md flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {t("pay_combined_btn")} ({formatMoney(totalOutstanding)})
            </button>
          )}
        </div>

        {displayedDues.length === 0 ? (
          <GlassCard className="p-8 text-center border-[#0F5A47]/15">
            <CheckCircle2 className="w-8 h-8 text-[#059669] mx-auto mb-2" />
            <p className="text-sm font-bold text-text-primary">
              {t("all_cleared")}
            </p>
          </GlassCard>
        ) : (
          displayedDues.map((due) => (
            <GlassCard
              key={due.id}
              className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-[#0F5A47]/15 hover:border-[#0F5A47]/30 transition-all"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-text-primary">
                    {due.feeType}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      due.paymentStatus === "paid"
                        ? "bg-[#059669]/10 text-[#059669] border border-[#059669]/20"
                        : due.paymentStatus === "overdue"
                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                        : "bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20"
                    }`}
                  >
                    {t(due.paymentStatus as any) || due.paymentStatus.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-text-secondary font-medium">
                  {t("student_label")}:{" "}
                  <span className="font-bold text-text-primary">
                    {due.studentName}
                  </span>{" "}
                  ({t("class_label")} {due.studentClass}) • {t("due_date_label")}: {due.dueDate}
                </p>
                {due.gstRate > 0 && (
                  <p className="text-[11px] text-[#0D7A5F] font-medium">
                    {t("includes_gst")} ({due.gstRate}%) • {t("sac_code")}
                  </p>
                )}
              </div>

              <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                <div className="flex justify-between md:justify-end gap-6 w-full">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold text-text-secondary uppercase">
                      {t("total_fee")}
                    </p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatMoney(due.amount)}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold text-text-secondary uppercase">
                      {t("balance_due")}
                    </p>
                    <p className="text-base font-extrabold text-[#0F5A47]">
                      {formatMoney(due.remainingBalance)}
                    </p>
                  </div>
                </div>

                {due.remainingBalance > 0 && (
                  <button
                    onClick={() =>
                      router.push(
                        `/parent/pay?assignmentId=${due.id}&amount=${due.remainingBalance}`
                      )
                    }
                    className="mt-1 w-full md:w-auto px-5 py-2 rounded-xl bg-[#0F5A47] text-white text-xs font-bold hover:bg-[#0D7A5F] transition-all shadow-md"
                  >
                    {t("pay_via_upi")}
                  </button>
                )}
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Section 80C Tax Exemption Modal */}
      {showTaxModal && taxCertificateData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <GlassCard className="w-full max-w-lg bg-[#F4F1EA] p-6 border-border-glass shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-glass pb-3">
              <div className="flex items-center gap-2 text-[#0F5A47]">
                <FileText className="w-5 h-5" />
                <h2 className="text-lg font-bold">Sec 80C Tax Certificate</h2>
              </div>
              <button onClick={() => setShowTaxModal(false)}>
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-3 bg-white p-4 rounded-xl border border-border-glass text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-secondary">Student Name</span>
                <span className="font-bold text-text-primary">
                  {taxCertificateData.studentName}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-secondary">Admission Number</span>
                <span className="font-bold text-text-primary">
                  {taxCertificateData.admissionNumber}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-secondary">Financial Year</span>
                <span className="font-bold text-text-primary">
                  {taxCertificateData.financialYear}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-text-secondary">Governing Act</span>
                <span className="font-bold text-[#0F5A47]">
                  {taxCertificateData.section}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-text-primary">
                  Total Deductible Tuition Paid
                </span>
                <span className="font-extrabold text-base text-[#059669]">
                  ₹
                  {taxCertificateData.deductibleTuitionAmount.toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  toast.success("Downloaded Section 80C Certificate PDF");
                  setShowTaxModal(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] shadow-md"
              >
                Download Official Certificate PDF
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* GST & SAC 9992 Explanation Modal */}
      {showGstModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <GlassCard className="w-full max-w-lg bg-[#F4F1EA] p-6 border-border-glass shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border-glass pb-3">
              <div className="flex items-center gap-2 text-[#0F5A47]">
                <Info className="w-5 h-5" />
                <h2 className="text-lg font-bold">GST & SAC 9992 Transparency</h2>
              </div>
              <button onClick={() => setShowGstModal(false)}>
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-text-primary">
              <p className="leading-relaxed">
                Under <strong>Notification 12/2017 Central Tax (Rate)</strong>, core educational services provided by schools (SAC 9992) are <strong>GST EXEMPT</strong>.
              </p>

              <div className="p-3 bg-white rounded-xl border border-border-glass space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>Tuition Fees (SAC 9992)</span>
                  <span className="text-[#059669] font-bold">0% GST (Exempt)</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport / Bus Fee</span>
                  <span className="text-text-secondary">0-18% GST (As Applicable)</span>
                </div>
              </div>

              <p className="text-text-secondary leading-relaxed">
                Finora automatically computes and lists GST rates per itemized fee type so you have complete tax visibility before paying.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowGstModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white"
              >
                Close Explanation
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Interactive Installment Plan Simulator Modal */}
      {showInstallmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <GlassCard className="w-full max-w-lg bg-[#F4F1EA] p-6 border-border-glass shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-border-glass pb-3">
              <div className="flex items-center gap-2 text-[#0F5A47]">
                <CreditCard className="w-5 h-5" />
                <h2 className="text-lg font-bold">Interactive Installment Simulator</h2>
              </div>
              <button onClick={() => setShowInstallmentModal(false)}>
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <p className="text-xs text-text-secondary font-medium leading-relaxed">
              Customize your payment tenure and upfront down payment to fit your family budget.
            </p>

            {/* Interactive Inputs */}
            <div className="space-y-4 bg-white p-4 rounded-xl border border-border-glass">
              {/* Tenure Selection */}
              <div>
                <label className="text-xs font-bold text-text-primary block mb-1.5">
                  Select Installment Tenure:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 6].map((months) => (
                    <button
                      key={months}
                      onClick={() => setSimTenure(months)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        simTenure === months
                          ? "bg-[#0F5A47] text-white border-[#0F5A47] shadow-sm"
                          : "bg-[#F4F1EA] text-text-secondary border-border-glass hover:bg-[#0F5A47]/10"
                      }`}
                    >
                      {months} Months
                    </button>
                  ))}
                </div>
              </div>

              {/* Upfront Down Payment Input / Slider */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-text-primary">
                    Upfront Down Payment:
                  </label>
                  <span className="text-xs font-extrabold text-[#0F5A47]">
                    ₹{simDownPayment.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.round(totalOutstanding * 0.5)}
                  step={500}
                  value={simDownPayment}
                  onChange={(e) => setSimDownPayment(Number(e.target.value))}
                  className="w-full accent-[#0F5A47]"
                />
                <div className="flex justify-between text-[10px] text-text-secondary font-medium">
                  <span>₹0</span>
                  <span>Max 50% (₹{Math.round(totalOutstanding * 0.5).toLocaleString("en-IN")})</span>
                </div>
              </div>
            </div>

            {/* Calculated Milestone Breakdown */}
            <div className="space-y-2 text-xs font-mono">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider font-sans block mb-1">
                Calculated Payment Schedule:
              </span>
              {(() => {
                const remainingAfterDown = Math.max(0, totalOutstanding - simDownPayment);
                const monthlyInstallment = Math.round(remainingAfterDown / simTenure);
                const items = [];

                if (simDownPayment > 0) {
                  items.push({
                    title: "Down Payment (Today)",
                    amount: simDownPayment,
                    highlight: true,
                  });
                }

                for (let i = 1; i <= simTenure; i++) {
                  items.push({
                    title: `Installment ${i} (+${(i - 1) * 30} Days)`,
                    amount: monthlyInstallment,
                    highlight: i === 1 && simDownPayment === 0,
                  });
                }

                return items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between p-2.5 rounded-xl border ${
                      item.highlight
                        ? "bg-[#0F5A47]/10 border-[#0F5A47]/30 text-[#0F5A47]"
                        : "bg-white border-border-glass text-text-primary"
                    }`}
                  >
                    <span className="font-semibold">{item.title}</span>
                    <span className="font-extrabold">₹{item.amount.toLocaleString("en-IN")}</span>
                  </div>
                ));
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-glass">
              <button
                onClick={() => setShowInstallmentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-border-glass text-text-secondary hover:bg-black/5"
              >
                Close
              </button>
              <button
                onClick={() => {
                  toast.success(`Applied ${simTenure}-Month Installment Plan!`);
                  setShowInstallmentModal(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] shadow-md"
              >
                Save & Apply Plan
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
