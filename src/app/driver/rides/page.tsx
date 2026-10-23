import Link from "next/link";
import { requirePageRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { EmptyState, StatusBadge } from "@/components/ui";

export default async function DriverRidesPage() {
  const user = await requirePageRole("DRIVER");

  const [open, mine] = await Promise.all([
    prisma.ride.findMany({
      where: { status: "REQUESTED" },
      include: { rider: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.ride.findMany({
      where: { driverId: user.id },
      include: { rider: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <AppShell user={user} active="/driver/rides">
      <h1 className="text-2xl font-bold text-slate-900">Ride queue</h1>
      <p className="mt-1 text-sm text-slate-600">Open requests from riders plus trips assigned to you.</p>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Open requests</h2>
      {open.length === 0 ? (
        <EmptyState title="No open requests" body="New rider requests will show up here automatically." />
      ) : (
        <ul className="space-y-3">
          {open.map((ride) => {
            const fare = ride.fare as { total?: number; currency?: string } | null;
            return (
              <li key={ride.id}>
                <Link href={`/rides/${ride.id}`} className="card flex items-center justify-between gap-3 transition hover:border-emerald-300">
                  <div>
                    <p className="font-semibold text-slate-900">{ride.pickup} → {ride.destination}</p>
                    <p className="text-xs text-slate-500">
                      {ride.rider.name} · {ride.passengers} passenger{ride.passengers > 1 ? "s" : ""} · {new Date(ride.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{fare?.currency ?? "NGN"} {fare?.total ?? "—"}</p>
                    <p className="text-xs text-emerald-700">View →</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Assigned to me</h2>
      {mine.length === 0 ? (
        <EmptyState title="No assigned trips" body="Accept an open request and it will appear here." />
      ) : (
        <ul className="space-y-3">
          {mine.map((ride) => {
            const fare = ride.fare as { total?: number; currency?: string } | null;
            return (
              <li key={ride.id}>
                <Link href={`/rides/${ride.id}`} className="card flex items-center justify-between gap-3 transition hover:border-emerald-300">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ride.status} />
                      {ride.poolId && <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Shared</span>}
                    </div>
                    <p className="mt-1.5 font-semibold text-slate-900">{ride.pickup} → {ride.destination}</p>
                    <p className="text-xs text-slate-500">{ride.rider.name} · {new Date(ride.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-slate-900">{fare?.currency ?? "NGN"} {fare?.total ?? "—"}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
