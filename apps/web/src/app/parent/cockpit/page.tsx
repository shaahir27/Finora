"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  MessageSquare,
  Bot,
  DollarSign,
  QrCode,
  Download,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { playPaymentSoundbox } from "@/lib/soundbox";
import { buildWhatsAppPaymentUrl } from "@/lib/whatsapp";
import toast from "react-hot-toast";

export default function HouseholdCockpitPage() {
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>("ALL");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const children = [
    {
      id: "stu-101",
      name: "Aarav Sharma",
      class: "Grade 10-A",
      admNo: "ADM-2026-001",
      dues: 15000,
      status: "pending",
      nextDueDate: "Aug 10, 2026",
    },
    {
      id: "stu-102",
      name: "Kabir Sharma",
      class: "Grade 8-B",
      admNo: "ADM-2026-002",
      dues: 4500,
      status: "pending",
      nextDueDate: "Aug 15, 2026",
    },
  ];

  const totalFamilyDues = children.reduce((acc, c) => acc + c.dues, 0);

  const handle1TapWhatsApp = (child: typeof children[0]) => {
    const url = buildWhatsAppPaymentUrl({
      phone: "+919876543210",
      studentName: child.name,
      studentClass: child.class,
      amountRupees: child.dues,
      feeAssignmentId: child.id,
    });
    window.open(url, "_blank");
    toast.success(`Generated 1-Tap WhatsApp Payment Link for ${child.name}`);
  };

  const handlePayAllFamilyDues = () => {
    playPaymentSoundbox(totalFamilyDues, "Family Dues");
    toast.success("Family Dues ₹19,500 cleared via UPI Sandbox!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-9 h-9 rounded-full border-2 border-[#0F5A47] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F5A47]/10 text-[#0F5A47] text-xs font-extrabold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#059669]" />
            Household Financial Cockpit
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Family Payment Hub</h1>
          <p className="text-text-secondary text-xs">
            Manage fee obligations, 1-tap WhatsApp payments, and Sec 80C certificates for all linked children.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/parent/dues"
            className="px-4 py-2.5 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F172A] text-xs font-bold hover:bg-[#0F5A47]/5 transition-all shadow-xs flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-[#0F5A47]" />
            Detailed Dues Breakdown
          </Link>
          <button
            onClick={handlePayAllFamilyDues}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-extrabold hover:opacity-95 transition-all shadow-md shadow-[#0F5A47]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Pay All Dues (₹{totalFamilyDues.toLocaleString("en-IN")})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-5 border-[#0F5A47]/20 relative overflow-hidden bg-gradient-to-br from-white to-[#0F5A47]/5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#475569] tracking-wider">Total Outstanding</span>
              <h3 className="text-2xl font-extrabold text-[#0F172A] mt-1">₹{totalFamilyDues.toLocaleString("en-IN")}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-[#059669] font-bold mt-3 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            2 Children Linked • Zero Overdue Penalties
          </p>
        </GlassCard>

        <GlassCard className="p-5 border-blue-500/20 bg-gradient-to-br from-white to-blue-50">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#475569] tracking-wider">Next Due Date</span>
              <h3 className="text-2xl font-extrabold text-[#1E40AF] mt-1">Aug 10, 2026</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-[#475569] font-semibold mt-3">Aarav Sharma — Q2 Tuition Fee</p>
        </GlassCard>

        <GlassCard className="p-5 border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#475569] tracking-wider">Sec 80C Deductible</span>
              <h3 className="text-2xl font-extrabold text-[#059669] mt-1">₹19,500</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 font-bold mt-3">100% Tax Certificate Ready for FY 2025-26</p>
        </GlassCard>
      </div>

      {/* Children Fee Cards Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">Linked Children & Dues</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map((child) => (
            <GlassCard key={child.id} className="p-5 border-[#0F5A47]/15 space-y-4 hover:border-[#0F5A47]/30 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0F5A47] to-[#059669] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-text-primary text-sm">{child.name}</h3>
                    <p className="text-xs text-text-secondary">{child.class} • {child.admNo}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20 text-[10px] font-extrabold uppercase">
                  Due ₹{child.dues.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="p-3 bg-[#F4F1EA] rounded-xl border border-border-glass space-y-1 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="text-text-secondary">Next Due:</span>
                  <span className="font-bold text-text-primary">{child.nextDueDate}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-text-secondary">Fee Type:</span>
                  <span className="font-bold text-[#0F5A47]">Tuition & Transport Q2</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/parent/pay?studentId=${child.id}&amount=${child.dues}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#0F5A47] text-white text-xs font-bold text-center hover:bg-[#0D7A5F] transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pay Now</span>
                </Link>
                <button
                  onClick={() => handle1TapWhatsApp(child)}
                  className="py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Link</span>
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Quick Access Shortcuts */}
      <GlassCard className="p-5 border-[#0F5A47]/15 space-y-4">
        <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">Parent Services & Downloads</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/parent/dues"
            className="p-4 rounded-2xl bg-white border border-border-glass hover:border-[#0F5A47]/30 transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
              <FileText className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-text-primary group-hover:text-[#0F5A47] transition-colors">Sec 80C Tax Cert</p>
            <span className="text-[10px] text-text-secondary block">Deductible Tuition Receipt</span>
          </Link>

          <Link
            href="/parent/history"
            className="p-4 rounded-2xl bg-white border border-border-glass hover:border-[#0F5A47]/30 transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-text-primary group-hover:text-[#0F5A47] transition-colors">Payment History</p>
            <span className="text-[10px] text-text-secondary block">Download Past Receipts</span>
          </Link>

          <Link
            href="/parent/copilot"
            className="p-4 rounded-2xl bg-white border border-border-glass hover:border-[#0F5A47]/30 transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
              <Bot className="w-4 h-4 text-[#059669]" />
            </div>
            <p className="text-xs font-bold text-text-primary group-hover:text-[#0F5A47] transition-colors">Parent AI Copilot</p>
            <span className="text-[10px] text-text-secondary block">Ask Fee & Policy Questions</span>
          </Link>

          <Link
            href="/parent/settings"
            className="p-4 rounded-2xl bg-white border border-border-glass hover:border-[#0F5A47]/30 transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-[#0F5A47]/10 flex items-center justify-center text-[#0F5A47]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-text-primary group-hover:text-[#0F5A47] transition-colors">Account Settings</p>
            <span className="text-[10px] text-text-secondary block">Phone, Language & Alerts</span>
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
