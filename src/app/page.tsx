import Link from "next/link";

const features = [
  {
    icon: "💬",
    title: "Natural-language booking",
    body: "Type \u201cMoremi Hall to Faculty of Science before my 9am lecture\u201d \u2014 Gemma 4 turns it into a structured ride, in English or Pidgin.",
  },
  {
    icon: "🤝",
    title: "Smart carpool matching",
    body: "Riders going the same way at the same time get grouped automatically, with a lower split fare and an AI explanation.",
  },
  {
    icon: "🛡️",
    title: "Safety copilot + SOS",
    body: "Late-night rides are watched for route deviations and long stops. One tap sends a structured incident to campus security.",
  },
  {
    icon: "📊",
    title: "Campus Ops analytics",
    body: "Admins ask plain-English questions and get demand heatmaps, safety trends and recommended actions.",
  },
];

const roles = [
  {
    title: "Students & staff",
    points: ["Register with your university email", "Track rides live and rate drivers", "Join shared rides to split fares", "SOS button on every trip"],
    href: "/register?role=STUDENT",
    cta: "Ride with CampusRide",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    title: "Drivers",
    points: ["Add vehicles and availability", "See earnings, trips and ratings", "AI dispatch and demand hotspots", "Campus-verified compliance"],
    href: "/register?role=DRIVER",
    cta: "Drive with CampusRide",
    accent: "from-sky-500 to-indigo-600",
  },
  {
    title: "Campus admin",
    points: ["Demand heatmap by zone and hour", "Safety alerts and incident log", "Driver compliance overview", "Ask Campus Ops in plain English"],
    href: "/login?role=ADMIN",
    cta: "Admin sign in",
    accent: "from-amber-500 to-orange-600",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-slate-950">C</span>
          <span className="text-lg font-bold tracking-tight">CampusRide</span>
          <span className="badge bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30">Gemma 4</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="rounded-xl px-4 py-2 text-slate-300 transition hover:text-white">
            Log in
          </Link>
          <Link href="/register" className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 transition hover:bg-slate-200">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-14 text-center">
        <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> AI-first campus mobility
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-bold tracking-tight sm:text-6xl">
          Get across campus safely.{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">Pay less together.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-300">
          CampusRide matches students, staff and verified drivers for late-night walks, hostel-to-lecture runs and gate pickups — with Gemma 4 planning, dispatching and watching over every trip.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Request a ride
          </Link>
          <Link href="/login?role=ADMIN" className="btn-secondary border-white/15 bg-white/5 px-6 py-3 text-base text-white hover:bg-white/10">
            Campus admin demo
          </Link>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 text-left sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:border-emerald-400/30 hover:bg-white/[0.06]">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 text-left md:grid-cols-3">
          {roles.map((r) => (
            <div key={r.title} className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-6">
              <div className={`mb-4 h-1.5 w-12 rounded-full bg-gradient-to-r ${r.accent}`} />
              <h3 className="text-lg font-semibold">{r.title}</h3>
              <ul className="mt-3 flex-1 space-y-2 text-sm text-slate-400">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link href={r.href} className="mt-5 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200">
                {r.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative border-t border-white/10 py-6 text-center text-xs text-slate-500">
        CampusRide · AI-powered campus rides · Built with Next.js, Prisma, Leaflet &amp; Gemma 4
      </footer>
    </main>
  );
}
