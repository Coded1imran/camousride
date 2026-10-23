"use client";

import { useCallback, useEffect, useState } from "react";

interface LogEntry {
  id: string;
  tool: string;
  model: string | null;
  input: unknown;
  output: unknown;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  status: string;
  fallbackUsed: boolean;
  createdAt: string;
}

interface Stats {
  totalCalls: number;
  avgLatencyMs: number;
  fallbackCalls: number;
  tokensIn: number;
  tokensOut: number;
}

export function ActivityClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/activity");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load AI activity.");
        return;
      }
      setLogs(json.data.logs);
      setStats(json.data.stats);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Activity</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every Gemma 4 call — booking, dispatch, carpool, safety and analytics — logged with latency and tokens.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {stats && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card"><p className="text-xs uppercase text-slate-500">AI calls</p><p className="mt-1 text-2xl font-bold">{stats.totalCalls}</p></div>
          <div className="card"><p className="text-xs uppercase text-slate-500">Avg latency</p><p className="mt-1 text-2xl font-bold">{stats.avgLatencyMs} ms</p></div>
          <div className="card"><p className="text-xs uppercase text-slate-500">Fallback calls</p><p className="mt-1 text-2xl font-bold">{stats.fallbackCalls}</p></div>
          <div className="card"><p className="text-xs uppercase text-slate-500">Tokens (in / out)</p><p className="mt-1 text-2xl font-bold">{stats.tokensIn} / {stats.tokensOut}</p></div>
        </div>
      )}

      <div className="card p-0">
        {loading && logs.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Loading AI activity…</p>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl">✨</p>
            <h3 className="mt-3 font-semibold text-slate-900">No AI calls yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Request a ride or ask Campus Ops a question — the input, output, latency and tokens will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => (
              <li key={log.id} className="p-4">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className={`badge ${log.fallbackUsed ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"}`}>
                      {log.fallbackUsed ? "fallback" : "live"}
                    </span>
                    <span className="font-semibold text-slate-900">{log.tool}</span>
                    <span className="text-slate-400">{log.model ?? "gemma-4-31b-it"}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {log.latencyMs ?? 0} ms · in {log.tokensIn ?? "—"} / out {log.tokensOut ?? "—"} tokens ·{" "}
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Input</p>
                      <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(log.input, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Output</p>
                      <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(log.output, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
