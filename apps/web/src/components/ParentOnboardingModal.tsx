"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Calculator,
  Bot,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  FileText,
} from "lucide-react";

export function ParentOnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // Check if parent has already completed onboarding walkthrough
    const hasSeen = localStorage.getItem("finora_parent_onboarding_seen");
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("finora_parent_onboarding_seen", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const slides = [
    {
      icon: Smartphone,
      title: "1-Click Mobile UPI Payments",
      subtitle: "Fast, Secure & Zero Transaction Fees",
      desc: "Pay tuition and transport fees instantly via Google Pay, PhonePe, Paytm, or Credit Card. Download official A4 and POS tax receipts anytime.",
      badge: "Instant Verification",
      color: "from-[#0F5A47] to-[#0D7A5F]",
      iconBg: "bg-[#0F5A47]/10 text-[#0F5A47]",
    },
    {
      icon: Calculator,
      title: "Flexible Installment Simulator",
      subtitle: "Tailored to Your Family Monthly Budget",
      desc: "Customize quarterly or monthly payment installment options with real-time interest-free schedule previews before committing.",
      badge: "Budget Friendly",
      color: "from-[#059669] to-[#10B981]",
      iconBg: "bg-[#059669]/10 text-[#059669]",
    },
    {
      icon: Bot,
      title: "Bilingual AI Assistant (Hindi / English)",
      subtitle: "24/7 Instant Answers in Your Language",
      desc: "Ask AI financial questions in Hindi or English (e.g. 'मेरी बकाया फीस कितनी है?'). Get instant breakdown of dues and receipts.",
      badge: "AI Powered",
      color: "from-[#0F5A47] to-[#059669]",
      iconBg: "bg-[#0F5A47]/10 text-[#0F5A47]",
    },
  ];

  const slide = slides[currentSlide] || slides[0]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#F4F1EA] rounded-3xl border border-[#0F5A47]/20 shadow-2xl overflow-hidden relative space-y-0"
      >
        {/* Header Bar */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#0F5A47]/15 bg-white/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0F5A47] animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F5A47]">
              Parent Cockpit Walkthrough
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-[#475569] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Slide Icon Graphic */}
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${slide.iconBg} flex items-center justify-center shadow-md`}>
                  <slide.icon className="w-7 h-7" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#0F5A47]/10 text-[#0F5A47] border border-[#0F5A47]/20">
                    {slide.badge}
                  </span>
                  <h3 className="text-xl font-extrabold text-[#0F172A] mt-1 tracking-tight">
                    {slide.title}
                  </h3>
                </div>
              </div>

              {/* Subtitle & Description */}
              <div className="space-y-2 bg-white/80 p-4 rounded-2xl border border-[#0F5A47]/15 shadow-xs">
                <h4 className="text-xs font-extrabold text-[#0F5A47]">{slide.subtitle}</h4>
                <p className="text-xs text-[#475569] font-medium leading-relaxed">
                  {slide.desc}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots Indicator & Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-[#0F5A47]/15">
            {/* Dots */}
            <div className="flex gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentSlide
                      ? "w-6 bg-[#0F5A47]"
                      : "w-2 bg-[#0F5A47]/25 hover:bg-[#0F5A47]/40"
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {currentSlide > 0 && (
                <button
                  onClick={() => setCurrentSlide(currentSlide - 1)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#475569] bg-white border border-[#0F5A47]/20 hover:bg-[#0F5A47]/5 transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
              )}

              {currentSlide < slides.length - 1 ? (
                <button
                  onClick={() => setCurrentSlide(currentSlide + 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F5A47] text-white hover:bg-[#0D7A5F] transition-all shadow-md flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#0F5A47] to-[#059669] text-white hover:opacity-95 transition-all shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
