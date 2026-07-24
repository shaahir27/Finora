"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { copilotQueryAction } from "@/app/actions/ai";
import { useTranslations } from "next-intl";

interface Message {
  role: "user" | "model";
  text: string;
}

interface Suggestion {
  label: string;
  deepLink: string;
}

export default function ParentCopilotPage() {
  const t = useTranslations("Copilot");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setSuggestion(null);

    const newMessages: Message[] = [...messages, { role: "user", text: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const parentUserId = sessionStorage.getItem("finora_parent_user_id");
      if (!parentUserId) throw new Error("Not authenticated");

      // We need the parentLinkId — fetch it via a lightweight server action
      // For now use parentUserId as the parentLinkId placeholder (copilotQueryAction
      // accepts parentLinkId which maps via prisma.parentLink.findUnique({ userId }))
      // We store parent_link_id in sessionStorage after first successful dues fetch
      const parentLinkId = sessionStorage.getItem("finora_parent_link_id") || parentUserId;

      const history = messages.map((m) => ({ role: m.role, text: m.text }));

      // We need schoolId — it's stored when the parent logs in via the dues fetch
      const schoolId = sessionStorage.getItem("finora_school_id") || "";

      const response = await copilotQueryAction("parent", schoolId, userMessage, history, {
        parentLinkId,
      });

      if (response.type === "answer") {
        setMessages([...newMessages, { role: "model", text: response.text }]);
      } else if (response.type === "suggestion") {
        setMessages([...newMessages, { role: "model", text: response.label }]);
        setSuggestion({ label: response.label, deepLink: response.deepLink });
      } else {
        setMessages([...newMessages, { role: "model", text: response.text }]);
      }
    } catch (err: any) {
      setMessages([...newMessages, { role: "model", text: `Error: ${err.message || "Something went wrong. Please try again."}` }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "What fees are still due?",
    "Show me my last payment",
    "Does tuition fee include GST?",
    "How do I pay a due?",
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">✦ {t("title")}</h1>
        <p className="text-text-secondary mt-1">{t("subtitle")}</p>
      </div>

      {/* Messages */}
      <GlassCard className="flex-1 overflow-y-auto p-4 space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-2xl">✦</div>
            <p className="text-text-secondary max-w-sm">Ask me anything about your dues, payment history, or GST on school fees.</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 bg-white/10 text-text-secondary text-sm rounded-full hover:bg-white/20 hover:text-text-primary transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-accent-primary text-white rounded-br-sm"
                      : "bg-white/10 text-text-primary rounded-bl-sm border border-border-glass"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-text-secondary rounded-2xl rounded-bl-sm px-4 py-3 text-sm border border-border-glass">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
                  </span>
                </div>
              </div>
            )}
            {suggestion && (
              <div className="flex justify-start">
                <a
                  href={suggestion.deepLink}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary/20 border border-accent-primary/40 rounded-full text-accent-primary-text text-sm hover:bg-accent-primary/30 transition-colors"
                >
                  <span>→</span> {suggestion.label}
                </a>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </GlassCard>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          disabled={loading}
          className="flex-1 bg-white/5 border border-border-glass rounded-xl px-4 py-3 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-accent-primary text-white rounded-xl font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
