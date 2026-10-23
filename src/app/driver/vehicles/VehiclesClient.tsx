"use client";

import { useCallback, useEffect, useState } from "react";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  plate: string;
  capacity: number;
  photoUrl: string | null;
}

const EMPTY = { make: "", model: "", plate: "", capacity: 4, photoUrl: "" };

export function VehiclesClient() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vehicles");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load vehicles.");
        return;
      }
      setVehicles(json.data.vehicles);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        make: form.make,
        model: form.model,
        plate: form.plate,
        capacity: Number(form.capacity),
        photoUrl: form.photoUrl || undefined,
      };
      const res = await fetch(editingId ? `/api/vehicles/${editingId}` : "/api/vehicles", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save the vehicle.");
        return;
      }
      reset();
      await load();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this vehicle? You will not be able to accept rides until you add another.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not remove the vehicle.");
        return;
      }
      await load();
    } catch {
      setError("Network error — please try again.");
    }
  }

  function edit(v: Vehicle) {
    setForm({ make: v.make, model: v.model, plate: v.plate, capacity: v.capacity, photoUrl: v.photoUrl ?? "" });
    setEditingId(v.id);
    setShowForm(true);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My vehicles</h1>
          <p className="mt-1 text-sm text-slate-600">Vehicles you register here are used by AI dispatch for capacity matching.</p>
        </div>
        <button
          onClick={() => {
            reset();
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Add vehicle
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={submit} className="card mb-5 border-emerald-200">
          <h2 className="font-semibold text-slate-900">{editingId ? "Edit vehicle" : "Add a vehicle"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Make</label>
              <input required value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className="input" placeholder="Toyota" />
            </div>
            <div>
              <label className="label">Model</label>
              <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input" placeholder="Corolla" />
            </div>
            <div>
              <label className="label">Plate number</label>
              <input required value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="input" placeholder="LAG-482-XY" />
            </div>
            <div>
              <label className="label">Capacity (seats)</label>
              <input type="number" min={1} max={16} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Photo URL (optional)</label>
              <input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} className="input" placeholder="https://…/my-car.jpg" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : editingId ? "Save changes" : "Add vehicle"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-3xl">🚗</p>
          <h3 className="mt-3 font-semibold text-slate-900">No vehicles yet</h3>
          <p className="mt-1 text-sm text-slate-500">Add your car so AI dispatch can match you with riders.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((v) => (
            <li key={v.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{v.make} {v.model}</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-600">{v.plate}</p>
                  <p className="mt-1 text-xs text-slate-500">{v.capacity} seats</p>
                </div>
                <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Active</span>
              </div>
              {v.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.photoUrl} alt={`${v.make} ${v.model}`} className="mt-3 h-32 w-full rounded-xl object-cover" />
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => edit(v)} className="btn-secondary flex-1 text-xs">Edit</button>
                <button onClick={() => remove(v.id)} className="flex-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
