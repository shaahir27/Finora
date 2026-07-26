"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { copilotQueryAction } from "@/app/actions/ai";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Sparkles, Send, Copy, Check, ExternalLink, Bot, User } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  copied?: boolean;
}

interface Suggestion {
  label: string;
  deepLink: string;
}

export default function ParentCopilotPage() {
  const t = useTranslations("Copilot");
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setSuggestion(null);

    const userMsgObj: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userMessage,
    };

    const newMessages: Message[] = [...messages, userMsgObj];
    setMessages(newMessages);
    setLoading(true);

    try {
      const parentUserId = session?.user?.id || "demo-parent-id";
      const schoolId = (session?.user as any)?.schoolId || sessionStorage.getItem("finora_school_id") || "demo-school-id";
      const parentLinkId = (session?.user as any)?.parentLinkId || sessionStorage.getItem("finora_parent_link_id") || "demo-parent-link";

      const history = messages.map((m) => ({ role: m.role, text: m.text }));

      const response = await copilotQueryAction("parent", schoolId, userMessage, history, {
        parentLinkId,
      });

      if (response.type === "answer") {
        setMessages([
          ...newMessages,
          { id: `model-${Date.now()}`, role: "model", text: response.text },
        ]);
      } else if (response.type === "suggestion") {
        setMessages([
          ...newMessages,
          { id: `model-${Date.now()}`, role: "model", text: response.label },
        ]);
        setSuggestion({ label: response.label, deepLink: response.deepLink });
      } else {
        setMessages([
          ...newMessages,
          { id: `model-${Date.now()}`, role: "model", text: response.text },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { id: `err-${Date.now()}`, role: "model", text: `Error: ${err.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyMessageText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    "What fees are still due?",
    "Show me my last payment",
    "Does tuition fee include GST?",
    "How do I generate Sec 80C Tax Certificate?",
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-130px)] sm:h-[calc(100vh-120px)] font-sans">
      {/* Header */}
      <div className="mb-3.5 sm:mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#0F5A47]" />
            Finora AI Copilot
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5 font-medium">
            Intelligent financial assistant for fee ledgers, tax certificates & GST explanations.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0F5A47]/10 text-[#0F5A47] border border-[#0F5A47]/20">
          <Bot className="w-3.5 h-3.5" /> Gemini Engine
        </span>
      </div>

      {/* Messages Window */}
      <GlassCard className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 mb-3.5 sm:mb-4 border-[#0F5A47]/15 bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] flex items-center justify-center text-white text-2xl shadow-lg shadow-[#0F5A47]/20">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <p className="text-base font-bold text-text-primary">Welcome to Parent AI Copilot</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm font-medium">
                Ask anything about your child's dues, payment history, Section 80C tax deduction certificates, or GST exemptions.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-lg">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-3.5 py-1.5 bg-white border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-bold rounded-full hover:bg-[#0F5A47]/10 active:scale-95 transition-all shadow-xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "model" && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] flex items-center justify-center text-white text-xs shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className="group relative max-w-[88%] sm:max-w-[80%] space-y-1">
                  <div
                    className={`rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#0F5A47] text-white rounded-br-xs font-medium shadow-sm"
                        : "bg-white text-text-primary rounded-bl-xs border border-[#0F5A47]/15 shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Copy Action Button */}
                  {msg.role === "model" && (
                    <div className="flex items-center gap-2 text-[10px] text-text-secondary font-medium px-1">
                      <button
                        onClick={() => copyMessageText(msg.id, msg.text)}
                        className="hover:text-[#0F5A47] flex items-center gap-1 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#059669]" />
                            <span className="text-[#059669]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy answer</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl bg-[#EBE7DF] border border-[#0F5A47]/20 flex items-center justify-center text-[#0F5A47] text-xs shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] flex items-center justify-center text-white text-xs shrink-0 mt-0.5 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-white text-text-secondary rounded-2xl rounded-bl-xs px-4 py-3 text-xs border border-[#0F5A47]/15 shadow-sm flex items-center gap-2">
                  <span className="font-semibold text-text-secondary">Thinking...</span>
                  <span className="inline-flex gap-1 font-bold text-[#0F5A47]">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
                  </span>
                </div>
              </div>
            )}

            {suggestion && (
              <div className="flex justify-start pl-9">
                <a
                  href={suggestion.deepLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F5A47]/10 border border-[#0F5A47]/20 rounded-xl text-[#0F5A47] text-xs font-bold hover:bg-[#0F5A47]/20 transition-all shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{suggestion.label}</span>
                </a>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </GlassCard>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          disabled={loading}
          className="flex-1 bg-white border border-[#0F5A47]/20 rounded-2xl px-4 py-3 text-xs text-text-primary outline-none focus:border-[#0F5A47] shadow-xs"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-[#0F5A47] text-white rounded-2xl text-xs font-bold hover:bg-[#0D7A5F] active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-md"
        >
          <span className="hidden sm:inline">Ask Copilot</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
