"use client";

/**
 * Copilot Widget Component — Phase 18 / R3-12 Integration
 *
 * Floating AI drawer with automatic weekly digest pre-loading, markdown rendering,
 * suggested actions, deep links, and manual question submission.
 */

import { useState, useEffect, useRef, useTransition, useId } from "react";
import { X, Sparkles, Send } from "lucide-react";
import {
  askAdminCopilotAction,
  getWeeklySummaryDigestAction,
} from "@/app/actions/ai";

interface ConversationMessage {
  id: string;
  role: "user" | "copilot";
  text: string;
  suggestion?: { label: string; deepLink: string };
}

export function CopilotWidget({ schoolId }: { schoolId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isDigestLoading, setIsDigestLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  // Fetch weekly digest on widget mount or when schoolId changes
  useEffect(() => {
    let isMounted = true;
    async function loadDigest() {
      setIsDigestLoading(true);
      try {
        const digestText = await getWeeklySummaryDigestAction(schoolId);
        if (isMounted) {
          setMessages([
            {
              id: "digest-1",
              role: "copilot",
              text: digestText,
            },
          ]);
        }
      } catch {
        if (isMounted) {
          setMessages([
            {
              id: "digest-err",
              role: "copilot",
              text: "Welcome to Finora Admin Copilot! Ask me anything about payments, defaulters, waivers, or reconciliation anomalies.",
            },
          ]);
        }
      } finally {
        if (isMounted) setIsDigestLoading(false);
      }
    }

    if (schoolId) {
      loadDigest();
    }
    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isPending]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query || isPending) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ConversationMessage = {
      id: userMsgId,
      role: "user",
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    startTransition(async () => {
      try {
        const response = await askAdminCopilotAction(schoolId, query);
        const copilotMsg: ConversationMessage = {
          id: `copilot-${Date.now()}`,
          role: "copilot",
          text: typeof response === "string" ? response : (response as any).text || (response as any).answer || String(response),
        };
        setMessages((prev) => [...prev, copilotMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "copilot",
            text: `Sorry, I couldn't process that request. (${err.message || "Unknown error"})`,
          },
        ]);
      }
    });
  };

  const suggestionChips = [
    "Who owes the most fee?",
    "Show me flagged transactions",
    "How do I apply a waiver?",
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-4 sm:right-6 w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center text-white shadow-2xl z-50 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F]"
        style={{
          boxShadow: "0 8px 30px rgba(15, 90, 71, 0.4)",
        }}
        aria-label="Toggle AI Copilot"
      >
        {isOpen ? <X className="w-6 h-6 sm:w-7 sm:h-7" /> : <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />}
      </button>

      {/* Slide-out Chat Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-22 sm:bottom-24 right-3 sm:right-6 w-[calc(100vw-1.5rem)] sm:w-96 h-[520px] max-h-[calc(100dvh-6.5rem)] rounded-2xl flex flex-col overflow-hidden z-50 shadow-2xl border border-[#0F5A47]/20 bg-[#F4F1EA]/95 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="border-b border-[#0F5A47]/15 px-4 py-3 flex items-center justify-between bg-white/90 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-text-primary">Finora AI Copilot</h2>
                <p className="text-[9px] sm:text-[10px] font-semibold text-text-secondary">Gemini Financial Engine</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-black/5 text-text-secondary min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-4 space-y-4">
            {isDigestLoading && <DigestSkeleton />}
            
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isPending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion Chips */}
          {messages.length <= 1 && !isDigestLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInputValue(chip)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full border border-[#0F5A47]/20 bg-white text-[#0F5A47] font-bold hover:bg-[#0F5A47]/10 active:scale-95 transition-all shadow-xs min-h-[32px]"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-[#0F5A47]/15 p-3 bg-white/90">
            <form id={formId} onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Copilot..."
                className="flex-1 rounded-xl px-3 py-2 text-base sm:text-xs text-text-primary outline-none bg-white border border-[#0F5A47]/20 focus:border-[#0F5A47] min-h-[44px]"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isPending}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all bg-[#0F5A47] hover:bg-[#0D7A5F] active:scale-95 shadow-sm shrink-0 min-w-[44px] min-h-[44px]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-xl px-3.5 py-2.5 shadow-xs text-xs font-sans ${
          isUser
            ? "bg-[#0F5A47] text-white rounded-br-xs font-medium"
            : "bg-white text-text-primary border border-[#0F5A47]/15 rounded-bl-xs"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{renderMarkdown(message.text)}</div>
        
        {message.suggestion && (
          <a
            href={message.suggestion.deepLink}
            className="mt-2 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors border border-[#0F5A47]/20 bg-[#0F5A47]/10 text-[#0F5A47] hover:bg-[#0F5A47]/20 inline-flex"
          >
            <span>→</span> <span>{message.suggestion.label}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-bold text-[#0F5A47]">{part.slice(2, -2)}</strong> : part
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center h-4 px-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#0F5A47]" style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

function DigestSkeleton() {
  return (
    <div className="p-3 bg-white/80 rounded-xl border border-[#0F5A47]/15 space-y-2 animate-pulse">
      <div className="h-3 w-1/3 bg-[#0F5A47]/20 rounded"></div>
      <div className="h-2.5 w-full bg-black/10 rounded"></div>
      <div className="h-2.5 w-4/5 bg-black/10 rounded"></div>
    </div>
  );
}
