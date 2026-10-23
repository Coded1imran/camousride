"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPanel } from "@/components/MapPanel";
import { AIBadge, StatusBadge } from "@/components/ui";

interface RideData {
  id: string;
  status: string;
  pickup: string;
  destination: string;
  pickupLat: number | null;
  pickupLng: number | null;
  destLat: number | null;
  destLng: number | null;
  passengers: number;
  scheduledAt: string | null;
  createdAt: string;
  fare: {
    total?: number;
    currency?: string;
    base?: number;
    surge?: number;
    discount?: number;
    distanceKm?: number;
    durationMin?: number;
  } | null;
  statusHistory: Record<string, string>;
  poolId: string | null;
  rider: { id: string; name: string; phone: string | null; hostel: string | null; department: string | null };
  driver: { id: string; name: string; phone: string | null } | null;
  ratings: Array<{ id: string; score: number; comment: string | null; fromUserId: string; createdAt: string }>;
  sosIncidents: Array<{ id: string; status: string; type: string; createdAt: string }>;
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

const STEPS = ["REQUESTED", "MATCHED", "IN_PROGRESS", "COMPLETED"];

function nextStepLabel(status: string, role: string) {
  if (role === "DRIVER") {
    if (status === "REQUESTED") return "Accept ride";
    if (status === "MATCHED") return "Start trip";
    if (status === "IN_PROGRESS") return "Complete trip";
  }
  if (role === "STUDENT" && status === "IN_PROGRESS") return "Complete ride";
  return null;
}

export function RideDetail({
  ride,
  role,
  userId,
}: {
  ride: RideData;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  userId: string;
}) {
  const router = useRouter();
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[] | null>(null);
  const [dispatchAi, setDispatchAi] = useState<{ fallback?: boolean; latencyMs?: number } | null>(null);
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosType, setSosType] = useState("SOS");
  const [sosDescription, setSosDescription] = useState("");
  const [sosDone, setSosDone] = useState<string | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");

  const fare = ride.fare;
  const currency = fare?.currency ?? "NGN";
  const isParticipant = ride.rider.id === userId || ride.driver?.id === userId;
  const canSos = isParticipant && !["COMPLETED", "CANCELLED"].includes(ride.status);
  const myRating = ride.ratings.find((r) => r.fromUserId === userId);
  const canRate = role === "STUDENT" && ride.rider.id === userId && ride.status === "COMPLETED" && Boolean(ride.driver) && !myRating;
  const actionLabel = nextStepLabel(ride.status, role);

  const points = [
    ride.pickupLat != null && ride.pickupLng != null
      ? { lat: ride.pickupLat, lng: ride.pickupLng, label: `Pickup: ${ride.pickup}`, kind: "pickup" as const }
      : null,
    ride.destLat != null && ride.destLng != null
      ? { lat: ride.destLat, lng: ride.destLng, label: `Destination: ${ride.destination}`, kind: "destination" as const }
      : null,
  ].filter((p): p is { lat: number; lng: number; label: string; kind: "pickup" | "destination" } => p !== null);

  async function post(path: string, body?: unknown) {
    setError(null);
    setActing(path);
    try {
      const res = await fetch(`/api/rides/${ride.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Action failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    } finally {
      setActing(null);
    }
  }

  async function loadDispatch() {
    setLoadingDispatch(true);
    setError(null);
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup: ride.pickup, destination: ride.destination, passengers: ride.passengers }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load dispatch recommendations.");
        return;
      }
      setDrivers(json.data.candidates ?? []);
      setDispatchAi(json.data.ai ?? null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoadingDispatch(false);
    }
  }

  async function submitSos(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setActing("sos");
    try {
      const res = await fetch(`/api/rides/${ride.id}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: ride.id, type: sosType, description: sosDescription }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not send the SOS.");
        return;
      }
      setSosDone(json.data.incident.id);
      setSosOpen(false);
      setSosDescription("");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setActing(null);
    }
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setActing("rate");
    try {
      const res = await fetch(`/api/rides/${ride.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment: comment || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save your rating.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link href={role === "DRIVER" ? "/driver/rides" : role === "ADMIN" ? "/admin" : "/rides"} className="text-sm text-slate-500 hover:text-slate-800">
            ← Back
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
            {ride.pickup} → {ride.destination}
            <StatusBadge status={ride.status} />
            {ride.poolId && <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Shared</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Requested {new Date(ride.createdAt).toLocaleString()} · {ride.passengers} passenger
            {ride.passengers > 1 ? "s" : ""}
            {ride.rider.department ? ` · ${ride.rider.department}` : ""}
          </p>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {sosDone && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          🚨 SOS sent. Campus security has been notified. Incident reference: <span className="font-mono">{sosDone}</span>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Trip map</h2>
            {points.length > 0 ? (
              <MapPanel points={points} />
            ) : (
              <div className="grid h-[220px] place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">
                Location coordinates unavailable for this ride.
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h2>
            <ol className="space-y-3">
              {STEPS.map((step) => {
                const reached = Boolean(ride.statusHistory[step]) || ride.status === step;
                const active = ride.status === step;
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        active
                          ? "bg-emerald-600 text-white"
                          : reached
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {reached ? "✓" : "•"}
                    </span>
                    <div>
                      <p className={`text-sm ${active ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                        {step.charAt(0) + step.slice(1).toLowerCase().replace("_", " ")}
                      </p>
                      {ride.statusHistory[step] && (
                        <p className="text-xs text-slate-400">{new Date(ride.statusHistory[step]).toLocaleString()}</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {ride.status === "CANCELLED" && (
                <li className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">✕</span>
                  <p className="text-sm font-semibold text-slate-700">Cancelled</p>
                </li>
              )}
            </ol>
          </div>

          {fare && (
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Fare breakdown</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Base fare</dt><dd>{currency} {fare.base ?? 150}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Distance</dt><dd>{fare.distanceKm ?? "—"} km</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd>{fare.durationMin ?? "—"} min</dd></div>
                {fare.surge && fare.surge > 1 && (
                  <div className="flex justify-between text-amber-700"><dt>Busy-time surge</dt><dd>{fare.surge}x</dd></div>
                )}
                {fare.discount ? (
                  <div className="flex justify-between text-emerald-700"><dt>Carpool discount</dt><dd>− {currency} {fare.discount}</dd></div>
                ) : null}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                  <dt>Total</dt><dd>{currency} {(fare.total ?? 0).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold text-slate-900">Actions</h2>
            <div className="mt-3 space-y-2">
              {actionLabel && (
                <button
                  onClick={() => post(ride.status === "REQUESTED" ? "accept" : ride.status === "MATCHED" ? "start" : "complete")}
                  disabled={acting !== null}
                  className="btn-primary w-full"
                >
                  {acting ? "Working…" : actionLabel}
                </button>
              )}
              {["REQUESTED", "MATCHED"].includes(ride.status) && (role === "STUDENT" ? ride.rider.id === userId : ride.driver?.id === userId) && (
                <button onClick={() => post("cancel")} disabled={acting !== null} className="btn-secondary w-full">
                  Cancel ride
                </button>
              )}
              {role === "STUDENT" && ride.rider.id === userId && ride.status === "REQUESTED" && !ride.driver && (
                <button onClick={loadDispatch} disabled={loadingDispatch} className="btn-secondary w-full">
                  {loadingDispatch ? "Ranking drivers…" : "Get AI driver recommendations ✨"}
                </button>
              )}
              {canSos && (
                <button onClick={() => setSosOpen(true)} className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700">
                  🚨 Emergency SOS
                </button>
              )}
            </div>
            {drivers && drivers.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI dispatch</p>
                  <AIBadge ai={dispatchAi} />
                </div>
                {drivers.map((d, i) => (
                  <div key={d.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">{i + 1}. {d.name} · {d.rating.toFixed(1)}★</p>
                    <p className="text-xs text-slate-500">{d.vehicle} · {d.distanceKm} km · {d.availableNow ? "on shift" : "off shift"}</p>
                    <p className="mt-1 text-xs text-emerald-700">{d.reason}</p>
                    <button
                      onClick={async () => {
                        const okay = await post("assign", { driverId: d.id });
                        if (okay) setDrivers(null);
                      }}
                      disabled={acting !== null}
                      className="btn-secondary mt-2 w-full text-xs"
                    >
                      Assign this driver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-900">People</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Rider</p>
                <p className="font-medium text-slate-900">{ride.rider.name}</p>
                <p className="text-xs text-slate-500">{ride.rider.department ?? "—"} · {ride.rider.hostel ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Driver</p>
                {ride.driver ? (
                  <>
                    <p className="font-medium text-slate-900">{ride.driver.name}</p>
                    <p className="text-xs text-slate-500">{ride.driver.phone ?? "Phone hidden"}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Not matched yet</p>
                )}
              </div>
            </div>
          </div>

          {canRate && (
            <form onSubmit={submitRating} className="card">
              <h2 className="font-semibold text-slate-900">Rate your driver</h2>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className={`text-2xl transition ${n <= score ? "text-amber-400" : "text-slate-200 hover:text-amber-300"}`}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="input mt-3 resize-none"
                rows={2}
                placeholder="Optional comment"
              />
              <button type="submit" disabled={acting !== null} className="btn-primary mt-2 w-full">
                {acting === "rate" ? "Saving…" : "Submit rating"}
              </button>
            </form>
          )}

          {myRating && (
            <div className="card">
              <p className="text-sm text-slate-600">
                You rated this ride <span className="font-semibold text-amber-600">{myRating.score}★</span>
                {myRating.comment ? ` — “${myRating.comment}”` : ""}
              </p>
            </div>
          )}

          {ride.sosIncidents.length > 0 && (
            <div className="card border-red-200 bg-red-50">
              <p className="text-sm font-semibold text-red-800">Safety incidents</p>
              {ride.sosIncidents.map((s) => (
                <p key={s.id} className="mt-1 text-xs text-red-700">
                  {s.type} · {s.status} · {new Date(s.createdAt).toLocaleString()}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {sosOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={submitSos} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-red-700">🚨 Emergency SOS</h2>
            <p className="mt-1 text-sm text-slate-600">
              This sends your live trip details to campus security immediately. Only use in an emergency.
            </p>
            <label className="label mt-4">Incident type</label>
            <select value={sosType} onChange={(e) => setSosType(e.target.value)} className="input">
              <option value="SOS">Personal safety emergency</option>
              <option value="FRAUD">Fare / payment issue</option>
              <option value="VEHICLE">Vehicle problem</option>
              <option value="OTHER">Other</option>
            </select>
            <label className="label mt-3">What is happening? (optional)</label>
            <textarea
              value={sosDescription}
              onChange={(e) => setSosDescription(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Describe anything security should know"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setSosOpen(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={acting !== null} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700">
                {acting === "sos" ? "Sending…" : "Send SOS now"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
