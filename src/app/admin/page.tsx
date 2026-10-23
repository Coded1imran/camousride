import Link from "next/link";
import { requirePageRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { StatCard, StatusBadge } from "@/components/ui";
import { SafetyDraft } from "./SafetyDraft";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default async function AdminPage() {
  const user = await requirePageRole("ADMIN");
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [events, incidents, drivers, unmet, locations] = await Promise.all([
    prisma.demandEvent.findMany({ where: { createdAt: { gte: since } } }),
    prisma.sOSIncident.findMany({
      include: { user: { select: { name: true, role: true } }, ride: { select: { pickup: true, destination: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.user.findMany({
      where: { role: "DRIVER" },
      include: {
        vehicles: true,
        ratingsReceived: { select: { score: true } },
        availability: { select: { id: true } },
        ridesAsDriver: { where: { status: "COMPLETED" }, select: { id: true } },
      },
    }),
    prisma.ride.count({ where: { status: "REQUESTED", createdAt: { gte: since } } }),
    prisma.campusLocation.findMany({ select: { zone: true } }),
  ]);

  const zones = [...new Set(locations.map((l) => l.zone))].sort();
  const matrix: Record<string, number[]> = {};
  for (const zone of zones) matrix[zone] = Array(24).fill(0);

  let maxCell = 1;
  for (const e of events) {
    if (!matrix[e.zone]) matrix[e.zone] = Array(24).fill(0);
    matrix[e.zone][e.hour] += 1;
    if (matrix[e.zone][e.hour] > maxCell) maxCell = matrix[e.zone][e.hour];
  }

  const zoneTotals = zones
    .map((zone) => ({ zone, total: matrix[zone].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  const peak = zoneTotals[0];

  const openIncidents = incidents.filter((i) => i.status === "OPEN").length;
  const compliant = drivers.filter((d) => d.vehicles.length > 0 && d.availability.length > 0).length;

  return (
    <AppShell user={user} active="/admin">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campus operations</h1>
          <p className="mt-1 text-sm text-slate-600">Demand, safety and driver compliance for the last 7 days.</p>
        </div>
        <Link href="/admin/ops" className="btn-primary">Ask Campus Ops ✨</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ride demand" value={events.length} hint="Requests in 7 days" />
        <StatCard label="Unmet demand" value={unmet} hint="Still unassigned" />
        <StatCard label="Open safety alerts" value={openIncidents} hint={`${incidents.length} recent incidents`} />
        <StatCard label="Compliant drivers" value={`${compliant}/${drivers.length}`} hint="Vehicle + hours on file" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Demand heatmap</h2>
              <p className="mt-1 text-sm text-slate-500">Requests by campus zone and hour.</p>
            </div>
            {peak && peak.total > 0 && (
              <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                Peak: {peak.zone} · {peak.total} requests
              </span>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0.5 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-2 py-1 text-left font-medium text-slate-500">Zone</th>
                  {HOURS.filter((h) => h % 2 === 0).map((h) => (
                    <th key={h} className="px-0.5 py-1 text-center font-normal text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone}>
                    <td className="sticky left-0 bg-white px-2 py-1 font-medium text-slate-700">{zone}</td>
                    {HOURS.map((hour) => {
                      const value = matrix[zone]?.[hour] ?? 0;
                      const ratio = value / maxCell;
                      return (
                        <td key={hour} className="p-0">
                          <div
                            title={`${zone} · ${hour}:00 — ${value} request${value === 1 ? "" : "s"}`}
                            className="h-6 w-5 rounded-sm border border-white"
                            style={{
                              backgroundColor:
                                value === 0 ? "#f1f5f9" : `rgba(5, 150, 105, ${0.15 + ratio * 0.85})`,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span>Low</span>
            <span className="h-3 w-6 rounded-sm bg-emerald-100" />
            <span className="h-3 w-6 rounded-sm bg-emerald-300" />
            <span className="h-3 w-6 rounded-sm bg-emerald-500" />
            <span className="h-3 w-6 rounded-sm bg-emerald-700" />
            <span>High</span>
            <span className="ml-auto">{events.length} demand events</span>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">Ask Campus Ops</h2>
          <p className="mt-1 text-sm text-slate-500">
            Natural-language analytics with allowlisted, parameterized tool calls — never raw SQL.
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            “Which zone had the most demand last week?”
          </div>
          <Link href="/admin/ops" className="btn-primary mt-4 w-full">Open chat</Link>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top zones</p>
            <ul className="mt-2 space-y-1.5">
              {zoneTotals.slice(0, 4).map((z) => (
                <li key={z.zone} className="flex justify-between text-sm">
                  <span className="text-slate-600">{z.zone}</span>
                  <span className="font-medium text-slate-900">{z.total}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Safety alerts</h2>
            <SafetyDraft />
          </div>
          {incidents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No incidents reported. 🎉</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {incidents.map((incident) => (
                <li key={incident.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {incident.type} · {incident.user.name}
                    </p>
                    <StatusBadge status={incident.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {incident.ride ? `${incident.ride.pickup} → ${incident.ride.destination} · ` : ""}
                    {new Date(incident.createdAt).toLocaleString()}
                  </p>
                  {incident.description && <p className="mt-1 text-sm text-slate-600">{incident.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">Driver compliance</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2">Driver</th>
                  <th className="pb-2">Vehicles</th>
                  <th className="pb-2">Rating</th>
                  <th className="pb-2">Trips</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((d) => {
                  const avg = d.ratingsReceived.length
                    ? (d.ratingsReceived.reduce((s, r) => s + r.score, 0) / d.ratingsReceived.length).toFixed(1)
                    : "—";
                  const ok = d.vehicles.length > 0 && d.availability.length > 0;
                  return (
                    <tr key={d.id}>
                      <td className="py-2.5 font-medium text-slate-800">{d.name}</td>
                      <td className="py-2.5 text-slate-600">{d.vehicles.length}</td>
                      <td className="py-2.5 text-slate-600">{avg === "—" ? "—" : `${avg}★`}</td>
                      <td className="py-2.5 text-slate-600">{d.ridesAsDriver.length}</td>
                      <td className="py-2.5">
                        <span className={`badge ${ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}>
                          {ok ? "Compliant" : "Needs info"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
