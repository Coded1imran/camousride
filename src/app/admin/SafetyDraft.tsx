"use client";

import { useState } from "react";
import { AIBadge } from "@/components/ui";

export function SafetyDraft() {
  const [draft, setDraft] = useState<string | null>(null);
  const [ai, setAi] = useState<{ fallback?: boolean; latencyMs?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not draft the safety brief.");
        return;
      }
      setDraft(json.data.draft);
      setAi(json.data.ai);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={generate} disabled={loading} className="text-xs font-semibold text-violet-700 hover:underline">
        {loading ? "Drafting…" : "Draft AI alert ✨"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {draft && (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
          <div className="mb-2"><AIBadge ai={ai} /></div>
          <p className="whitespace-pre-wrap leading-relaxed">{draft}</p>
        </div>
      )}
    </div>
  );
}
