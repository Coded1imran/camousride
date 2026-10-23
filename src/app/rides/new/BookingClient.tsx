"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AIBadge } from "@/components/ui";

interface Draft {
  pickup: string;
  destination: string;
  passengers: number;
  wheelchair: boolean;
  time?: string | null;
  scheduledAt?: string | null;
}

interface AiMeta {
  model?: string;
  fallback: boolean;
  latencyMs: number;
  tokensIn?: number | null;
  tokensOut?: number | null;
}

interface Fare {
  total: number;
  currency: string;
  base: number;
  surge: number;
  discount: number;
  distanceKm: number;
  durationMin: number;
  passengers: number;
}

interface DriverOption {
  id: string;
  name: string;
  rating: number;
  trips: number;
  capacity: number;
  distanceKm: number;
  availableNow: boolean;
  vehicle: string;
  reason: string;
}

interface CarpoolGroup {
  candidateIds: string[];
  explanation: string;
  discountPercent: number;
  rides: Array<{
    id: string;
    riderName: string;
    pickup: string;
    destination: string;
    passengers: number;
    scheduledAt: string | null;
  }>;
}

const EXAMPLES = [
  "I need to get from Moremi Hall to the Faculty of Science before my 9am lecture, I'm with one friend",
  "Abeg I dey go from New Hall to Faculty of Arts, we be two",
  "Main Gate to Faculty of Engineering at 7pm, I have a wheelchair",
];

function normalizeTime(value: string): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = m[3]?.toLowerCase();
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function BookingClient({ riderName }: { riderName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fare, setFare] = useState<Fare | null>(null);
  const [ai, setAi] = useState<AiMeta | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[] | null>(null);
  const [dispatchAi, setDispatchAi] = useState<AiMeta | null>(null);
  const [carpool, setCarpool] = useState<CarpoolGroup[]>([]);
  const [understanding, setUnderstanding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function understand() {
    setError(null);
    setUnderstanding(true);
    setDraft(null);
    setDrivers(null);
    setCarpool([]);
    try {
      const res = await fetch("/api/ai/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not understand that request.");
        return;
      }
      const nextDraft: Draft = json.data.draft;
      setDraft(nextDraft);
      setFare(json.data.fare);
      setAi(json.data.ai);

      const [dispatchRes, carpoolRes] = await Promise.all([
        fetch("/api/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: nextDraft.pickup,
            destination: nextDraft.destination,
            passengers: nextDraft.passengers,
          }),
        }),
        fetch("/api/ai/carpool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup: nextDraft.pickup,
            destination: nextDraft.destination,
            passengers: nextDraft.passengers,
            scheduledAt: nextDraft.scheduledAt ?? undefined,
          }),
        }),
      ]);
      const dispatchJson = await dispatchRes.json();
      if (dispatchRes.ok) {
        setDrivers(dispatchJson.data.candidates ?? []);
        setDispatchAi(dispatchJson.data.ai ?? null);
      }
      const carpoolJson = await carpoolRes.json();
      if (carpoolRes.ok) setCarpool(carpoolJson.data.groups ?? []);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUnderstanding(false);
    }
  }

  async function confirm(driverId?: string) {
    if (!draft) return;
    setError(null);
    setConfirming(true);
    try {
      const scheduledAt = draft.time ? normalizeTime(draft.time) : draft.scheduledAt ?? null;
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: draft.pickup,
          destination: draft.destination,
          passengers: draft.passengers,
          scheduledAt: scheduledAt ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create the ride.");
        return;
      }
      const rideId = json.data.ride.id;
      if (driverId) {
        await fetch(`/api/rides/${rideId}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverId }),
        });
      }
      router.push(`/rides/${rideId}`);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setConfirming(false);
    }
  }

  async function joinCarpool(candidateId: string) {
    if (!draft) return;
    setError(null);
    setJoining(candidateId);
    try {
      const res = await fetch(`/api/rides/${candidateId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: draft.pickup,
          destination: draft.destination,
          passengers: draft.passengers,
          scheduledAt: draft.time ? normalizeTime(draft.time) ?? undefined : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not join that shared ride.");
        return;
      }
      router.push(`/rides/${json.data.ride.id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Request a ride</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hi {riderName.split(" ")[0]} — describe your trip naturally in English or Pidgin. Gemma 4 turns it into a
          structured request.
        </p>
      </div>

      <div className="card">
        <label htmlFor="request" className="label">
          Where are you going?
        </label>
        <textarea
          id="request"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input resize-none"
          placeholder="e.g. I need to get from Moremi Hall to the Faculty of Science before my 9am lecture, I'm with one friend"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              {ex.length > 52 ? `${ex.slice(0, 52)}…` : ex}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Your text is treated as data — it cannot change system rules.</p>
          <button onClick={understand} disabled={understanding || text.trim().length < 3} className="btn-primary">
            {understanding ? "Gemma is reading…" : "Understand with Gemma ✨"}
          </button>
        </div>
      </div>

      {draft && (
        <>
          <div className="card mt-5 border-emerald-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Gemma understood</h2>
              <AIBadge ai={ai} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Pickup</label>
                <input
                  value={draft.pickup}
                  onChange={(e) => setDraft({ ...draft, pickup: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Destination</label>
                <input
                  value={draft.destination}
                  onChange={(e) => setDraft({ ...draft, destination: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Passengers</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={draft.passengers}
                  onChange={(e) => setDraft({ ...draft, passengers: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Time (optional)</label>
                <input
                  value={draft.time ?? ""}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  className="input"
                  placeholder="e.g. 9am or 2026-10-24T09:00"
                />
              </div>
            </div>
            {draft.wheelchair && (
              <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                ♿ Wheelchair accessible vehicle requested — dispatch will only match suitable vehicles.
              </p>
            )}

            {fare && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="flex items-end justify-between">
                  <p className="text-sm text-slate-600">Estimated fare</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {fare.currency} {fare.total.toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {fare.distanceKm} km · ~{fare.durationMin} min · {fare.passengers} passenger
                  {fare.passengers > 1 ? "s" : ""}
                  {fare.discount > 0 ? ` · ${fare.currency} ${fare.discount} pool discount` : ""}
                </p>
              </div>
            )}

            <button onClick={() => confirm()} disabled={confirming} className="btn-primary mt-4 w-full">
              {confirming ? "Requesting…" : "Confirm & request ride"}
            </button>
          </div>

          {drivers && drivers.length > 0 && (
            <div className="card mt-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">Smart dispatch</h2>
                <AIBadge ai={dispatchAi} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Ranked by Gemma using distance, capacity, rating and shift hours. Pick one, or let the transport office
                assign a driver.
              </p>
              <ul className="mt-4 space-y-3">
                {drivers.map((d, i) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {i + 1}. {d.name} · {d.rating.toFixed(1)}★
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {d.vehicle} · {d.distanceKm} km away · {d.availableNow ? "on shift" : "off shift"}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">{d.reason}</p>
                    </div>
                    <button onClick={() => confirm(d.id)} disabled={confirming} className="btn-secondary shrink-0 text-xs">
                      Choose
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {carpool.length > 0 && (
            <div className="card mt-5">
              <h2 className="font-semibold text-slate-900">Ride together, pay less</h2>
              <p className="mt-1 text-sm text-slate-500">Gemma found riders heading the same way.</p>
              <ul className="mt-4 space-y-3">
                {carpool.map((g) => {
                  const candidate = g.rides[0];
                  return (
                    <li key={candidate?.id ?? g.explanation} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">
                        {candidate?.riderName} → {candidate?.destination}
                      </p>
                      <p className="mt-1 text-sm text-emerald-800">{g.explanation}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="badge bg-white text-emerald-700 ring-1 ring-emerald-200">
                          Save {g.discountPercent}% on your fare
                        </span>
                        <button
                          onClick={() => joinCarpool(candidate.id)}
                          disabled={joining === candidate.id}
                          className="btn-primary text-xs"
                        >
                          {joining === candidate.id ? "Joining…" : "Join shared ride"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
