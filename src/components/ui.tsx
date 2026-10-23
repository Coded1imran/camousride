export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    REQUESTED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    MATCHED: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    IN_PROGRESS: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    CANCELLED: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    OPEN: "bg-red-50 text-red-700 ring-1 ring-red-200",
    ACKED: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  };
  const label = status
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  return <span className={`badge ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>{label}</span>;
}

export function AIBadge({
  ai,
}: {
  ai: { fallback?: boolean; latencyMs?: number; model?: string; tokensIn?: number | null; tokensOut?: number | null } | null;
}) {
  if (!ai) return null;
  return (
    <span
      className={`badge gap-1 ${
        ai.fallback ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
      }`}
      title={
        ai.fallback
          ? "Gemma unavailable — using deterministic fallback. Add GEMINI_API_KEY to .env for live AI."
          : "Generated live by Gemma 4"
      }
    >
      ✨ Gemma 4{ai.fallback ? " · fallback" : ""}
      {typeof ai.latencyMs === "number" ? ` · ${ai.latencyMs}ms` : ""}
    </span>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-3xl">🚌</p>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
