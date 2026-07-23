"use client";

/**
 * Admin Copilot Tab — /admin/copilot
 * ui_ux_specification.md — ADMIN — AI Copilot screen
 *
 * Design: Forest Ledger palette (design_system.md). Glassmorphism panels.
 * State: client-side React state for conversation history (no server persistence — by design,
 *        api_specification.md: "No COPILOT_SESSION table").
 *
 * Opening message: weekly digest loaded on mount.
 * Suggestion responses: rendered with a deep-link button.
 */

import { useState, useEffect, useRef, useTransition, useId } from "react";
import {
  copilotQueryAction,
  generateWeeklyDigestAction,
} from "@/app/actions/ai";
import { GlassCard } from "@/components/GlassCard";

// Hardcoded schoolId for now — Session 6 will derive from auth session
const SCHOOL_ID = process.env.NEXT_PUBLIC_DEMO_SCHOOL_ID ?? "demo-school";

type MessageRole = "user" | "assistant" | "system";

interface ConversationMessage {
  id: string;
  role: MessageRole;
  text: string;
  suggestion?: {
    label: string;
    deepLink: string;
  };
  timestamp: Date;
}

export default function AdminCopilotPage() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isDigestLoading, setIsDigestLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  // Load weekly digest as opening message on mount
  useEffect(() => {
    setIsDigestLoading(true);
    generateWeeklyDigestAction(SCHOOL_ID)
      .then((digestText) => {
        setMessages([
          {
            id: "digest-0",
            role: "assistant",
            text: `**Weekly Digest**\n\n${digestText}`,
            timestamp: new Date(),
          },
        ]);
      })
      .catch(() => {
        setMessages([
          {
            id: "digest-error",
            role: "system",
            text: "Weekly digest unavailable — Gemini may be offline. You can still ask questions.",
            timestamp: new Date(),
          },
        ]);
      })
      .finally(() => setIsDigestLoading(false));
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question || isPending) return;

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Build conversation history for the server action (text-only, not full message objects)
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        text: m.text,
      }));

    startTransition(async () => {
      const response = await copilotQueryAction("admin", SCHOOL_ID, question, history);

      if (response.type === "answer") {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: response.text,
            timestamp: new Date(),
          },
        ]);
      } else if (response.type === "suggestion") {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: response.suggestion,
            suggestion: { label: response.label, deepLink: response.deepLink },
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-error-${Date.now()}`,
            role: "system",
            text: response.text,
            timestamp: new Date(),
          },
        ]);
      }
    });
  };

  const suggestionChips = [
    "Show me this week's summary",
    "Which students are at highest risk?",
    "How do I apply a waiver?",
    "Are there any flagged anomalies?",
    "Show the reminders queue status",
  ];

  return (
    <div className="flex flex-col h-screen bg-bg-base" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="border-b border-border-glass px-6 py-4 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)" }}
          aria-hidden="true"
        >
          ✦
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">AI Copilot</h1>
          <p className="text-xs text-text-secondary">Powered by Gemini · Admin workspace</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(76,175,130,0.15)", color: "#4CAF82" }}
          >
            Read-only
          </span>
        </div>
      </div>

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        id="copilot-message-list"
        aria-live="polite"
        aria-label="Copilot conversation"
      >
        {isDigestLoading && (
          <div className="flex justify-start">
            <div
              className="max-w-2xl rounded-2xl rounded-tl-sm px-4 py-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <DigestSkeleton />
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips — shown only when no messages except digest */}
      {messages.length <= 1 && !isDigestLoading && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setInputValue(chip)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105"
              style={{
                borderColor: "rgba(76,175,130,0.3)",
                color: "#4CAF82",
                background: "rgba(76,175,130,0.08)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border-glass px-4 py-3">
        <form
          id={formId}
          onSubmit={handleSubmit}
          className="flex items-center gap-3"
          aria-label="Ask the copilot"
        >
          <input
            ref={inputRef}
            id="copilot-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about collections, reminders, defaulters…"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-text-primary outline-none focus:ring-1 transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              caretColor: "#4CAF82",
            }}
            disabled={isPending}
            autoComplete="off"
          />
          <button
            id="copilot-send-btn"
            type="submit"
            disabled={!inputValue.trim() || isPending}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:scale-105"
            style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)" }}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <p className="text-xs text-text-secondary mt-2 text-center">
          Copilot can read data and suggest actions — it cannot record payments or apply waivers.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-tr-sm"
            : isSystem
            ? "rounded-tl-sm"
            : "rounded-tl-sm"
        }`}
        style={
          isUser
            ? { background: "linear-gradient(135deg, #2D6A4F, #1B4332)", border: "1px solid rgba(76,175,130,0.2)" }
            : isSystem
            ? { background: "rgba(255,200,100,0.08)", border: "1px solid rgba(255,200,100,0.2)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }
        }
      >
        {/* Render text with basic markdown bold support */}
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
          {renderMarkdown(message.text)}
        </p>

        {/* Deep-link suggestion button */}
        {message.suggestion && (
          <a
            href={message.suggestion.deepLink}
            id={`copilot-suggestion-${message.id}`}
            className="mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all hover:opacity-90 inline-flex"
            style={{ background: "rgba(76,175,130,0.15)", color: "#4CAF82", border: "1px solid rgba(76,175,130,0.3)" }}
          >
            <span>→</span>
            <span>{message.suggestion.label}</span>
          </a>
        )}

        <p className="text-xs text-text-secondary mt-2 opacity-50">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  // Simple bold renderer: **text** → <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center h-5" aria-label="Copilot is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: "#4CAF82",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function DigestSkeleton() {
  return (
    <div className="space-y-2 w-72" aria-label="Loading weekly digest">
      {[80, 100, 60, 90].map((w, i) => (
        <div
          key={i}
          className="h-3 rounded"
          style={{
            width: `${w}%`,
            background: "rgba(255,255,255,0.08)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}
