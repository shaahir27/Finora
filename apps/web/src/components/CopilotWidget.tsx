"use client";

import { useState, useEffect, useRef, useTransition, useId } from "react";
import { copilotQueryAction, generateWeeklyDigestAction } from "@/app/actions/ai";
import { X } from "lucide-react";

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

export function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isDigestLoading, setIsDigestLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  // Load weekly digest once when the widget is first opened
  const [hasLoadedDigest, setHasLoadedDigest] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoadedDigest) {
      setHasLoadedDigest(true);
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
    }
  }, [isOpen, hasLoadedDigest]);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

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
    "Which students are at risk?",
    "How do I apply a waiver?",
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg z-50 transition-transform hover:scale-110"
        style={{
          background: "linear-gradient(135deg, #4CAF82, #2D6A4F)",
          boxShadow: "0 4px 20px rgba(76, 175, 130, 0.4)",
        }}
        aria-label="Toggle AI Copilot"
      >
        {isOpen ? <X className="w-6 h-6" /> : <span className="text-2xl font-serif">✦</span>}
      </button>

      {/* Slide-out Chat Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 w-96 h-[600px] max-h-[calc(100vh-8rem)] rounded-2xl flex flex-col overflow-hidden z-50 shadow-2xl border border-white/10"
          style={{ 
            background: "rgba(10, 12, 15, 0.85)", 
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div className="border-b border-white/10 px-4 py-3 flex items-center gap-3 bg-white/5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-md" style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)" }}>
              ✦
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">AI Copilot</h2>
              <p className="text-[10px] text-gray-400">Powered by Gemini</p>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {isDigestLoading && <DigestSkeleton />}
            
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isPending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion Chips */}
          {messages.length <= 1 && !isDigestLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInputValue(chip)}
                  className="text-[10px] px-2 py-1 rounded-full border transition-colors"
                  style={{ borderColor: "rgba(76,175,130,0.3)", color: "#4CAF82", background: "rgba(76,175,130,0.08)" }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-white/10 p-3 bg-white/5">
            <form id={formId} onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Copilot..."
                className="flex-1 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-[#4CAF82]"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isPending}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40 transition-transform hover:scale-105"
                style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
        className={`max-w-[85%] rounded-xl px-3 py-2 ${isUser ? "rounded-br-sm" : "rounded-bl-sm"}`}
        style={
          isUser
            ? { background: "linear-gradient(135deg, #2D6A4F, #1B4332)", border: "1px solid rgba(76,175,130,0.2)" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }
        }
      >
        <div className="text-xs text-white whitespace-pre-wrap leading-relaxed">{renderMarkdown(message.text)}</div>
        
        {message.suggestion && (
          <a
            href={message.suggestion.deepLink}
            className="mt-2 flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded transition-opacity hover:opacity-80 inline-flex"
            style={{ background: "rgba(76,175,130,0.15)", color: "#4CAF82" }}
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
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center h-4 px-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "#4CAF82", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

function DigestSkeleton() {
  return (
    <div className="space-y-1.5 w-48">
      {[80, 100, 60].map((w, i) => (
        <div key={i} className="h-2 rounded" style={{ width: `${w}%`, background: "rgba(255,255,255,0.08)", animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}
