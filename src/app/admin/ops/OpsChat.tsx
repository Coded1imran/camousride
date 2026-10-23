"use client";

import { useState } from "react";
import { AIBadge } from "@/components/ui";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  ai?: { fallback?: boolean; latencyMs?: number; tokensIn?: number | null; tokensOut?: number | null } | null;
}

const SUGGESTIONS = [
  "Which zone had the most demand last week?",
  "How busy is the Central zone compared with the North zone?",
  "What time of day should we add more drivers?",
  "Which destination had the most ride requests?",
];

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi — I'm Campus Ops, powered by Gemma 4. Ask me about campus demand in plain English. I can only query allowlisted, parameterized demand data — never raw SQL.",
};

export function OpsChat() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    const text = question.trim();
    if (text.length < 3) return;
    setError(null);
    setLoading(true);
    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMessage]);
    setInput("");

    try {
      const res = await fetch("/api/ai/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Campus Ops could not answer that.");
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: json.data.answer,
          ai: json.data.ai,
        },
      ]);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Ask Campus Ops</h1>
      <p className="mt-1 text-sm text-slate-600">
        Natural-language analytics for the transport office — Gemma turns questions into safe, parameterized queries.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card mt-5 flex h-[460px] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                {m.ai && <div className="mb-2"><AIBadge ai={m.ai} /></div>}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Gemma is analysing demand…
              </div>
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-slate-200 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input"
            placeholder="e.g. Which zone had the most unmet demand last week?"
            disabled={loading}
          />
          <button type="submit" disabled={loading || input.trim().length < 3} className="btn-primary shrink-0">
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
