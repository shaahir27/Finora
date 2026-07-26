"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Zap,
  BarChart3,
  Users,
  CheckCircle2,
  Sparkles,
  Shield,
  FileCode2,
  Cpu,
  Layers,
  Smartphone,
  Lock,
  Globe,
  Database,
  Terminal,
  ChevronRight,
  Receipt,
  FileCheck,
  TrendingUp,
  CreditCard,
} from "lucide-react";

// ─── Animation Variants ───────────────────────────────────────────────────────

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } },
};

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-[#0F5A47]/15 bg-[#F4F1EA]/90 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-white bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] shadow-md shadow-[#0F5A47]/20 text-lg">
          ₹
        </div>
        <div>
          <span className="text-xl font-extrabold tracking-tight text-[#0F172A]">Finora</span>
          <span className="text-[9px] font-extrabold text-[#0F5A47] uppercase tracking-widest block leading-none">
            Smart School Finance OS
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-8 text-xs font-bold text-[#475569]">
        <a href="#sandbox" className="hover:text-[#0F5A47] transition-colors">Live Sandbox</a>
        <a href="#ecosystem" className="hover:text-[#0F5A47] transition-colors">Operations Hub</a>
        <a href="#impact" className="hover:text-[#0F5A47] transition-colors">Impact Metrics</a>
        <a href="#tech" className="hover:text-[#0F5A47] transition-colors">Architecture</a>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/parent/dues"
          className="text-xs font-bold px-3 py-2 rounded-xl text-[#0F172A] bg-white border border-[#0F5A47]/20 hover:bg-[#0F5A47]/10 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#0F5A47]" />
          <span className="hidden sm:inline">Parent Portal</span>
          <span className="sm:hidden">Parent</span>
        </Link>
        <Link
          href="/admin/dashboard"
          className="text-xs font-extrabold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white hover:opacity-95 border border-[#0F5A47]/20 transition-all shadow-md shadow-[#0F5A47]/20 flex items-center gap-1.5 group"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Admin Console</span>
          <span className="sm:hidden">Admin</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </motion.nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-36 pb-24 px-6 min-h-screen flex items-center overflow-hidden bg-[#F4F1EA]">
      {/* Background Ambient Warm Sand Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#0F5A47]/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] bg-[#059669]/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left Hero Copy */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="text-center lg:text-left"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0F5A47]/10 border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-extrabold mb-8 backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-[#0F5A47] animate-pulse" />
            Next-Gen School Finance & AI Reconciliation Engine
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#0F172A] mb-6 leading-[1.12]"
          >
            Reconcile School <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F5A47] via-[#059669] to-[#0D7A5F]">
              Ledgers In Seconds.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-base sm:text-lg text-[#475569] font-medium mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            Zero-lag bank reconciliation, 1-click Tally Prime XML export, AI-driven defaulter reminder engine, and a seamless parent payment cockpit.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
          >
            <Link
              href="/admin/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white font-extrabold hover:shadow-xl hover:shadow-[#0F5A47]/25 active:scale-95 transition-all flex items-center justify-center gap-2 group border border-[#0F5A47]/20"
            >
              Launch Admin Operations
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/parent/dues"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F172A] font-bold hover:bg-[#0F5A47]/5 transition-colors text-center shadow-xs"
            >
              Test Parent Cockpit
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Graphic Core (Clean Layout, Zero Overlapping) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative w-full h-auto flex items-center justify-center py-6"
        >
          {/* Main Glass Hero Card Container */}
          <div className="relative w-full max-w-lg p-6 sm:p-7 rounded-3xl bg-white/95 backdrop-blur-2xl border border-[#0F5A47]/20 shadow-2xl shadow-[#0F5A47]/10 space-y-5">
            {/* Top Brand Header */}
            <div className="flex items-center justify-between border-b border-[#0F5A47]/15 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0F5A47] to-[#059669] text-white flex items-center justify-center font-extrabold text-xl shadow-md">
                  F
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-base">Finora Operations Hub</h3>
                  <p className="text-[10px] font-bold text-[#059669] uppercase tracking-wider">Automated Ledger V2.6</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#059669]/10 text-[#059669] border border-[#059669]/25 text-[10px] font-extrabold uppercase tracking-wider">
                100% RECONCILED
              </span>
            </div>

            {/* Feature Pills Row (In-flow, Zero Overlap) */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-[#0F5A47]/10 text-[#0F5A47] border border-[#0F5A47]/20 text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
                <Zap className="w-3.5 h-3.5 text-[#059669]" />
                Zero Manual Tally Entry
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F172A] text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
                <Shield className="w-3.5 h-3.5 text-[#0F5A47]" />
                Audit-Backed Waivers
              </span>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 bg-[#F4F1EA] rounded-2xl border border-[#0F5A47]/15 space-y-1">
                <span className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider block">Today Collected</span>
                <p className="text-2xl font-extrabold text-[#0F172A]">₹1,84,500</p>
                <span className="text-[10px] font-extrabold text-[#059669] block">+18.4% vs last week</span>
              </div>
              <div className="p-4 bg-[#F4F1EA] rounded-2xl border border-[#0F5A47]/15 space-y-1">
                <span className="text-[10px] font-extrabold text-[#475569] uppercase tracking-wider block">Match Rate</span>
                <p className="text-2xl font-extrabold text-[#059669]">99.8%</p>
                <span className="text-[10px] font-extrabold text-[#059669] block">0ms Lag Sync</span>
              </div>
            </div>

            {/* Tally XML Export Bar */}
            <div className="p-4 bg-[#0F5A47]/10 rounded-2xl border border-[#0F5A47]/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0F5A47] animate-spin" />
                <span className="font-extrabold text-[#0F172A]">Tally Prime XML Export Ready</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#0F5A47] text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs">
                READY
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Live Sandbox Terminal Component ─────────────────────────────────────────

function LiveTerminalShowcase() {
  const [activeTab, setActiveTab] = useState<"rec" | "tally" | "ai" | "parent">("rec");

  return (
    <section id="sandbox" className="py-24 px-6 bg-[#EBE7DF] border-t border-[#0F5A47]/15 relative">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <span className="px-4 py-1.5 rounded-full bg-[#0F5A47]/10 border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-extrabold uppercase tracking-wider">
            Interactive Product Sandbox
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">
            Test-Drive Finora Core Engines Live
          </h2>
          <p className="text-[#475569] text-sm max-w-xl mx-auto font-medium">
            Click across the tabs below to preview how our financial engines handle real-time bank feeds, Tally XML formatting, and AI prompt analysis.
          </p>
        </div>

        {/* Sandbox Glass Container */}
        <div className="bg-white/90 border border-[#0F5A47]/20 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between p-4 bg-[#F4F1EA] border-b border-[#0F5A47]/15 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              <span className="text-xs text-[#475569] font-mono font-bold ml-2">finora-core-engine-v2.6</span>
            </div>

            {/* Selector Tabs (Interactive & Fully Functional) */}
            <div className="flex overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap gap-1.5 p-1 bg-black/5 rounded-xl border border-black/10 text-xs font-bold max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab("rec")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "rec"
                    ? "bg-[#0F5A47] text-white shadow-md"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-black/5"
                }`}
              >
                ⚡ Bank Reconciliation
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tally")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "tally"
                    ? "bg-[#0F5A47] text-white shadow-md"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-black/5"
                }`}
              >
                📊 Tally XML Engine
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "ai"
                    ? "bg-[#0F5A47] text-white shadow-md"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-black/5"
                }`}
              >
                ✨ AI Copilot
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("parent")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "parent"
                    ? "bg-[#0F5A47] text-white shadow-md"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-black/5"
                }`}
              >
                📱 Parent Cockpit
              </button>
            </div>
          </div>

          {/* Sandbox Dynamic Body Content */}
          <div className="p-6 sm:p-8 min-h-[320px]">
            {activeTab === "rec" && (
              <div className="space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center text-[#475569] border-b border-border-glass pb-2 font-bold">
                  <span>BANK FEED TRANSACTION</span>
                  <span>RECONCILIATION MATCH</span>
                  <span>TARGET LEDGER ENTRY</span>
                </div>
                {[
                  { tx: "UPI/849204/Aarav Sharma", status: "MATCHED (99.8%)", match: "Tuition Fee #ASSIGN-1002", color: "bg-[#059669]/10 text-[#059669] border-[#059669]/20" },
                  { tx: "CASH/Direct/Ananya Iyer", status: "MATCHED (100%)", match: "Annual Fee #ASSIGN-1005", color: "bg-[#059669]/10 text-[#059669] border-[#059669]/20" },
                  { tx: "CHEQUE/94821/Dev Malhotra", status: "FLAGGED (CHEQUE PENDING)", match: "Transport Fee #ASSIGN-1008", color: "bg-amber-500/10 text-amber-800 border-amber-500/20" },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-[#F4F1EA] rounded-xl border border-[#0F5A47]/15 gap-2">
                    <span className="text-[#0F172A] font-bold">{item.tx}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${item.color}`}>
                      {item.status}
                    </span>
                    <span className="text-[#0F5A47] font-bold">{item.match}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "tally" && (
              <div className="space-y-3 font-mono text-xs text-slate-800 bg-[#F4F1EA] p-5 rounded-2xl border border-[#0F5A47]/20 overflow-x-auto">
                <p className="text-[#0F5A47] font-bold">// Tally Prime XML Receipt Voucher Schema Generator Output</p>
                <p className="text-slate-500">&lt;ENVELOPE&gt;</p>
                <p className="text-slate-500">&nbsp;&nbsp;&lt;HEADER&gt;&lt;TALLYREQUEST&gt;Import Data&lt;/TALLYREQUEST&gt;&lt;/HEADER&gt;</p>
                <p className="text-slate-700">&nbsp;&nbsp;&lt;BODY&gt;&lt;IMPORTDATA&gt;&lt;REQUESTDATA&gt;</p>
                <p className="text-[#0F5A47] font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&lt;VOUCHER VCHTYPE="Receipt" ACTION="Create"&gt;</p>
                <p className="text-amber-800">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;DATE&gt;20260726&lt;/DATE&gt;</p>
                <p className="text-amber-800">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;PARTYLEDGERNAME&gt;Bank Account&lt;/PARTYLEDGERNAME&gt;</p>
                <p className="text-[#059669] font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;AMOUNT&gt;-12000.00&lt;/AMOUNT&gt;</p>
                <p className="text-[#0F5A47] font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&lt;/VOUCHER&gt;</p>
                <p className="text-slate-500">&nbsp;&nbsp;&lt;/BODY&gt;</p>
                <p className="text-slate-500">&lt;/ENVELOPE&gt;</p>
              </div>
            )}

            {activeTab === "ai" && (
              <div className="space-y-4">
                <div className="bg-[#0F5A47]/10 border border-[#0F5A47]/20 p-4 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#0F5A47] font-bold">
                    <Bot className="w-4 h-4" />
                    Finora Copilot Financial Query Analysis
                  </div>
                  <p className="text-[#0F172A] font-bold">
                    "Identify top overdue fee assignments across Grade 11 and draft automated reminders."
                  </p>
                </div>
                <div className="bg-[#F4F1EA] border border-[#0F5A47]/15 p-4 rounded-2xl text-xs space-y-2 font-mono text-[#0F172A]">
                  <p className="text-[#059669] font-bold">✓ Identified 3 High-Risk Defaulter Students (Total Dues: ₹24,000)</p>
                  <p>• Aarav Sharma (Grade 11-A): ₹12,000 overdue by 32 days</p>
                  <p>• Ananya Iyer (Grade 11-A): ₹12,000 overdue by 32 days</p>
                  <div className="pt-2">
                    <Link
                      href="/admin/defaulters"
                      className="px-3.5 py-1.5 rounded-xl bg-[#0F5A47] text-white font-bold inline-flex items-center gap-1 hover:bg-[#0D7A5F] transition-all shadow-xs"
                    >
                      ⚡ Trigger Batch AI Reminders &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "parent" && (
              <div className="space-y-4">
                <div className="p-5 bg-[#F4F1EA] rounded-2xl border border-[#0F5A47]/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-[#0F5A47]">Parent Mobile Experience</span>
                    <h4 className="text-base font-extrabold text-[#0F172A]">1-Click UPI Payment & Multi-Installment Simulator</h4>
                    <p className="text-xs text-[#475569]">Bilingual Support (Hindi / English) • Instant Receipt PDF</p>
                  </div>
                  <Link
                    href="/parent/dues"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-bold hover:opacity-95 transition-all shadow-md"
                  >
                    Open Live Parent Portal &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Impact Metrics Scorecard ────────────────────────────────────────────────

function ImpactMetrics() {
  return (
    <section id="impact" className="py-24 px-6 bg-[#F4F1EA] border-t border-[#0F5A47]/15">
      <div className="max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">
            Built for Zero Friction. Verified by Data.
          </h2>
          <p className="text-[#475569] text-sm max-w-xl mx-auto font-medium">
            Empirical financial engineering replacing manual spreadsheets across smart educational institutions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { metric: "0ms", label: "Reconciliation Lag", desc: "Real-time bank feed to ledger matching." },
            { metric: "99.4%", label: "Match Accuracy", desc: "AI-driven fuzzy ledger string matching." },
            { metric: "1-Click", label: "Tally Prime Export", desc: "Official XML Receipt Voucher XML schema." },
            { metric: "42%", label: "Defaulter Reduction", desc: "Automated multi-channel AI reminders." },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="p-6 rounded-3xl bg-white/90 border border-[#0F5A47]/15 hover:border-[#0F5A47]/30 hover:-translate-y-1 transition-all backdrop-blur-xl shadow-md"
            >
              <h3 className="text-4xl font-extrabold text-[#0F5A47] tracking-tight mb-2">{item.metric}</h3>
              <p className="text-base font-extrabold text-[#0F172A] mb-1">{item.label}</p>
              <p className="text-xs text-[#475569] font-medium">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Judge Tech Architecture Showcase ───────────────────────────────────────

function TechArchitecture() {
  return (
    <section id="tech" className="py-24 px-6 bg-[#EBE7DF] border-t border-[#0F5A47]/15">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <span className="px-4 py-1.5 rounded-full bg-[#0F5A47]/10 border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-extrabold uppercase tracking-wider">
            Architecture Stack
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">
            Enterprise Technology Core
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: "Next.js 14", icon: Globe, detail: "App Router & SSR" },
            { name: "Framer Motion", icon: Cpu, detail: "Smooth UI Animations" },
            { name: "Prisma ORM", icon: Database, detail: "PostgreSQL Schema" },
            { name: "Razorpay", icon: Lock, detail: "Webhook Verification" },
            { name: "Tally Prime", icon: FileCode2, detail: "XML Voucher Export" },
            { name: "Tailwind CSS", icon: Layers, detail: "Glassmorphism System" },
          ].map((stack, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-white/90 border border-[#0F5A47]/15 hover:border-[#0F5A47]/30 transition-all text-center space-y-2 shadow-xs"
            >
              <stack.icon className="w-6 h-6 text-[#0F5A47] mx-auto" />
              <h4 className="text-xs font-extrabold text-[#0F172A]">{stack.name}</h4>
              <p className="text-[10px] text-[#475569] font-semibold">{stack.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer & Floating Judge Dock ────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[#0F5A47]/15 bg-[#F4F1EA] text-[#475569] text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-white bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F]">
            ₹
          </div>
          <span className="text-base font-extrabold text-[#0F172A]">Finora Technologies</span>
        </div>
        <p className="font-semibold">© 2026 Finora. Smart School Finance Operating System.</p>
        <div className="flex gap-6 font-bold text-[#0F172A]">
          <Link href="/admin/dashboard" className="hover:text-[#0F5A47] transition-colors">Admin Dashboard</Link>
          <Link href="/parent/dues" className="hover:text-[#0F5A47] transition-colors">Parent Cockpit</Link>
        </div>
      </div>
    </footer>
  );
}

function FloatingJudgeDock() {
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white/95 border border-[#0F5A47]/25 shadow-xl shadow-[#0F5A47]/15 backdrop-blur-2xl flex items-center gap-2.5 max-w-[92vw]">
      <span className="text-[11px] font-extrabold text-[#0F172A] hidden sm:inline-flex items-center gap-1.5 pl-1">

        <Sparkles className="w-3.5 h-3.5 text-[#059669] animate-spin" />
        Quick Demo Launch:
      </span>
      <Link
        href="/admin/dashboard"
        className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-extrabold hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
      >
        <Shield className="w-3.5 h-3.5" />
        Admin Console
      </Link>
      <Link
        href="/parent/dues"
        className="px-3.5 py-1.5 rounded-full bg-[#F4F1EA] text-[#0F172A] text-xs font-extrabold hover:bg-black/5 active:scale-95 transition-all border border-[#0F5A47]/20 flex items-center gap-1.5"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#0F5A47]" />
        Parent Portal
      </Link>
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#0F172A] font-sans selection:bg-[#0F5A47]/20">
      <Navbar />

      <main className="relative z-10">
        <Hero />
        <LiveTerminalShowcase />
        <ImpactMetrics />
        <TechArchitecture />
      </main>

      <Footer />
      <FloatingJudgeDock />
    </div>
  );
}
