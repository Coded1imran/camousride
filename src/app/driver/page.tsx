import Link from "next/link";
import { requirePageRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { EmptyState, StatCard, StatusBadge } from "@/components/ui";

export default async function DriverDashboardPage() {
  const user = await requirePageRole("DRIVER");

  const [rides, vehicles, ratings, demand] = await Promise.all([
    prisma.ride.findMany({
      where: { driverId: user.id },
      include: { rider: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.vehicle.findMany({ where: { ownerId: user.id } }),
    prisma.driverRating.findMany({ where: { toUserId: user.id }, select: { score: true } }),
    prisma.demandEvent.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const completed = rides.filter((r) => r.status === "COMPLETED");
  const earnings = completed.reduce(
    (sum, r) => sum + ((r.fare as { total?: number } | null)?.total ?? 0),
    0
  );
  const avgRating = ratings.length
    ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratings.length) * 10) / 10
    : null;

  const zoneCounts = new Map<string, number>();
  for (const event of demand) {
    zoneCounts.set(event.zone, (zoneCounts.get(event.zone) ?? 0) + 1);
  }
  const hotspots = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxHotspot = hotspots[0]?.[1] ?? 1;

  return (
    <AppShell user={user} active="/driver">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Driver dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Earnings, trips, ratings and where demand is building.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/driver/vehicles" className="btn-secondary">Vehicles</Link>
          <Link href="/driver/availability" className="btn-primary">Availability</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Earnings" value={`NGN ${earnings.toLocaleString()}`} hint="Completed trips" />
        <StatCard label="Trips completed" value={completed.length} hint={`${rides.length} total assigned`} />
        <StatCard label="Rating" value={avgRating ? `${avgRating}★` : "New"} hint={`${ratings.length} ratings`} />
        <StatCard label="Vehicles" value={vehicles.length} hint={vehicles.length ? "Ready for dispatch" : "Add a vehicle to accept rides"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Demand hotspots</h2>
            <span className="badge bg-violet-50 text-violet-700 ring-1 ring-violet-200">✨ Gemma insight</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Campus destinations requested in the last 7 days.</p>
          <ul className="mt-4 space-y-3">
            {hotspots.length === 0 && <li className="text-sm text-slate-500">No demand data yet.</li>}
            {hotspots.map(([zone, count]) => (
              <li key={zone}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{zone} zone</span>
                  <span className="text-slate-500">{count} requests</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.round((count / maxHotspot) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            💡 Tip: position near the top zone 10 minutes before the busiest hour to catch more dispatch matches.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900">Open ride requests</h2>
          <p className="mt-1 text-sm text-slate-500">Accept from the ride screen.</p>
          <Link href="/driver/rides" className="btn-primary mt-4 w-full">
            View ride queue
          </Link>
          {vehicles.length === 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Add a vehicle first — riders need to know what you drive.
            </p>
          )}
        </div>
      </div>

      <div className="card mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent trips</h2>
          <Link href="/driver/rides" className="text-sm font-semibold text-emerald-700 hover:underline">See all →</Link>
        </div>
        {rides.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No trips yet" body="Open ride requests will appear in your queue." />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2">Route</th>
                  <th className="pb-2">Rider</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Fare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rides.slice(0, 6).map((ride) => {
                  const fare = ride.fare as { total?: number; currency?: string } | null;
                  return (
                    <tr key={ride.id}>
                      <td className="py-2.5">
                        <Link href={`/rides/${ride.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                          {ride.pickup} → {ride.destination}
                        </Link>
                      </td>
                      <td className="py-2.5 text-slate-600">{ride.rider.name}</td>
                      <td className="py-2.5"><StatusBadge status={ride.status} /></td>
                      <td className="py-2.5 text-right text-slate-700">
                        {fare?.total != null ? `${fare.currency ?? "NGN"} ${fare.total}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
