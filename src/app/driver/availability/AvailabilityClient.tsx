"use client";

import { useCallback, useEffect, useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayState {
  enabled: boolean;
  start: string;
  end: string;
}

const DEFAULT_DAYS: DayState[] = DAYS.map((_, i) => ({
  enabled: i >= 1 && i <= 5,
  start: "07:00",
  end: "21:00",
}));

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function AvailabilityClient() {
  const [days, setDays] = useState<DayState[]>(DEFAULT_DAYS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/availability");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load availability.");
        return;
      }
      const windows: Array<{ dayOfWeek: number; startTime: number; endTime: number }> = json.data.windows;
      if (windows.length > 0) {
        const next = DAYS.map((_, i) => {
          const forDay = windows.filter((w) => w.dayOfWeek === i);
          if (forDay.length === 0) return { enabled: false, start: "07:00", end: "21:00" };
          return {
            enabled: true,
            start: toTime(Math.min(...forDay.map((w) => w.startTime))),
            end: toTime(Math.max(...forDay.map((w) => w.endTime))),
          };
        });
        setDays(next);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(i: number, patch: Partial<DayState>) {
    setDays((d) => d.map((day, idx) => (idx === i ? { ...day, ...patch } : day)));
    setMessage(null);
  }

  function applyPreset(kind: "weekdays" | "evenings" | "all") {
    setDays((d) =>
      d.map((day, i) => {
        if (kind === "weekdays") return { enabled: i >= 1 && i <= 5, start: "07:00", end: "21:00" };
        if (kind === "evenings") return { enabled: true, start: "16:00", end: "23:00" };
        return { enabled: true, start: "07:00", end: "21:00" };
      })
    );
    setMessage(null);
  }

  async function save() {
    setError(null);
    setMessage(null);
    const windows = days
      .map((d, i) => ({ ...d, dayOfWeek: i }))
      .filter((d) => d.enabled)
      .map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: toMinutes(d.start), endTime: toMinutes(d.end) }))
      .filter((w) => w.endTime > w.startTime);

    setSaving(true);
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save availability.");
        return;
      }
      setMessage("Availability saved. AI dispatch will use these hours.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Availability</h1>
      <p className="mt-1 text-sm text-slate-600">
        Set the hours you can drive. Smart dispatch prioritises drivers who are on shift.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => applyPreset("weekdays")} className="btn-secondary text-xs">Weekdays 7am–9pm</button>
        <button onClick={() => applyPreset("evenings")} className="btn-secondary text-xs">Evenings 4pm–11pm</button>
        <button onClick={() => applyPreset("all")} className="btn-secondary text-xs">Every day 7am–9pm</button>
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading availability…</p>
      ) : (
        <div className="card mt-5 divide-y divide-slate-100 p-0">
          {days.map((day, i) => (
            <div key={DAYS[i]} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <label className="flex min-w-[130px] items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                {DAYS[i]}
              </label>
              {day.enabled ? (
                <div className="flex items-center gap-2 text-sm">
                  <input type="time" value={day.start} onChange={(e) => update(i, { start: e.target.value })} className="input w-32" />
                  <span className="text-slate-400">to</span>
                  <input type="time" value={day.end} onChange={(e) => update(i, { end: e.target.value })} className="input w-32" />
                </div>
              ) : (
                <span className="text-sm text-slate-400">Not available</span>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={saving || loading} className="btn-primary mt-5 w-full">
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
