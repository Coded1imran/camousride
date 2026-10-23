import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Student / Staff",
  DRIVER: "Driver",
  ADMIN: "Campus Admin",
};

export default async function DashboardPage() {
  const user = await requireSession();

  const [rideCount, vehicleCount] = await Promise.all([
    user.role === "DRIVER"
      ? prisma.ride.count({ where: { driverId: user.id } })
      : prisma.ride.count({ where: { riderId: user.id } }),
    user.role === "DRIVER" ? prisma.vehicle.count({ where: { ownerId: user.id } }) : Promise.resolve(0),
  ]);

  const actions =
    user.role === "STUDENT"
      ? [
          { href: "/rides/new", title: "Request a ride", body: "Describe your trip in plain English or Pidgin — Gemma 4 handles the rest.", cta: "Book now" },
          { href: "/rides", title: "My rides", body: "Track live trips, join shared rides and rate your driver.", cta: "View rides" },
        ]
      : user.role === "DRIVER"
        ? [
            { href: "/driver", title: "Driver dashboard", body: "Earnings, trips, ratings and AI demand hotspots.", cta: "Open dashboard" },
            { href: "/driver/vehicles", title: "My vehicles", body: "Add make, model, plate, capacity and a photo.", cta: "Manage vehicles" },
            { href: "/driver/availability", title: "Availability", body: "Set the hours AI dispatch can match you.", cta: "Set hours" },
          ]
        : [
            { href: "/admin", title: "Campus overview", body: "Demand heatmap, safety alerts and driver compliance.", cta: "Open admin" },
            { href: "/admin/ops", title: "Ask Campus Ops", body: "Ask questions about demand in plain English.", cta: "Ask Gemma" },
          ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-lg font-black text-white">C</span>
            <span className="text-lg font-bold tracking-tight text-slate-900">CampusRide</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-7 text-white shadow-sm">
          <p className="text-sm text-emerald-300">
            {user.role === "STUDENT" ? "Rider dashboard" : user.role === "DRIVER" ? "Driver dashboard" : "Transport office dashboard"}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Welcome, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            {user.role === "STUDENT"
              ? "Request a ride in plain English, join a carpool to pay less, and stay safe with the SOS button on every late-night trip."
              : user.role === "DRIVER"
                ? "Manage your vehicles and availability. Gemma 4 ranks you for nearby rides and shows you where demand is building."
                : "See where demand is concentrated, review safety incidents, check driver compliance and ask Campus Ops anything."}
          </p>
          <div className="mt-5 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-2xl font-bold">{rideCount}</p>
              <p className="text-slate-400">{user.role === "DRIVER" ? "Trips driven" : "Rides requested"}</p>
            </div>
            {user.role === "DRIVER" && (
              <div>
                <p className="text-2xl font-bold">{vehicleCount}</p>
                <p className="text-slate-400">Vehicles</p>
              </div>
            )}
            {user.department && (
              <div>
                <p className="text-2xl font-bold">{user.department}</p>
                <p className="text-slate-400">Department</p>
              </div>
            )}
            {user.hostel && (
              <div>
                <p className="text-2xl font-bold">{user.hostel}</p>
                <p className="text-slate-400">Location</p>
              </div>
            )}
          </div>
        </div>

        <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card group flex flex-col transition hover:border-emerald-300 hover:shadow-md"
            >
              <h3 className="font-semibold text-slate-900">{a.title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{a.body}</p>
              <span className="mt-4 text-sm font-semibold text-emerald-700 group-hover:text-emerald-800">{a.cta} →</span>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">🤖 Gemma 4 is the engine</p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-800">
            Every booking, dispatch decision, carpool match, safety alert and analytics answer is generated through one
            swappable AI module. Open the AI Activity panel to see each call, its latency and token usage.
          </p>
          <Link href="/ai/activity" className="mt-3 inline-block text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline">
            View AI Activity →
          </Link>
        </div>
      </main>
    </div>
  );
}
