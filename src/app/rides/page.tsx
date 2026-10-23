import Link from "next/link";
import { requirePageRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { EmptyState, StatusBadge } from "@/components/ui";

export default async function RidesPage() {
  const user = await requirePageRole("STUDENT");

  const rides = await prisma.ride.findMany({
    where: { riderId: user.id },
    include: { driver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AppShell user={user} active="/rides">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My rides</h1>
          <p className="mt-1 text-sm text-slate-600">Track live trips, review past rides and rate drivers.</p>
        </div>
        <Link href="/rides/new" className="btn-primary">
          New ride
        </Link>
      </div>

      {rides.length === 0 ? (
        <EmptyState
          title="No rides yet"
          body="Describe your first trip in plain English and Gemma will turn it into a ride request."
          action={
            <Link href="/rides/new" className="btn-primary">
              Request a ride
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rides.map((ride) => {
            const fare = ride.fare as { total?: number; currency?: string } | null;
            return (
              <li key={ride.id}>
                <Link
                  href={`/rides/${ride.id}`}
                  className="card flex flex-col gap-3 transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={ride.status} />
                      {ride.poolId && (
                        <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Shared ride</span>
                      )}
                    </div>
                    <p className="mt-2 truncate font-semibold text-slate-900">
                      {ride.pickup} → {ride.destination}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(ride.createdAt).toLocaleString()} · {ride.passengers} passenger
                      {ride.passengers > 1 ? "s" : ""}
                      {ride.driver ? ` · Driver: ${ride.driver.name}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    {fare?.total != null && (
                      <p className="font-bold text-slate-900">
                        {fare.currency ?? "NGN"} {fare.total.toLocaleString()}
                      </p>
                    )}
                    <p className="text-xs text-emerald-700">View details →</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
