import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

type Role = "STUDENT" | "DRIVER" | "ADMIN";

const NAV: Record<Role, Array<{ href: string; label: string }>> = {
  STUDENT: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/rides/new", label: "Request ride" },
    { href: "/rides", label: "My rides" },
    { href: "/ai/activity", label: "AI Activity" },
  ],
  DRIVER: [
    { href: "/driver", label: "Dashboard" },
    { href: "/driver/rides", label: "Rides" },
    { href: "/driver/vehicles", label: "Vehicles" },
    { href: "/driver/availability", label: "Availability" },
    { href: "/ai/activity", label: "AI Activity" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/ops", label: "Ask Campus Ops" },
    { href: "/ai/activity", label: "AI Activity" },
  ],
};

export function AppShell({
  user,
  active,
  children,
}: {
  user: { name: string; role: string };
  active?: string;
  children: React.ReactNode;
}) {
  const role = (user.role as Role) ?? "STUDENT";
  const items = NAV[role] ?? NAV.STUDENT;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-sm font-black text-white">C</span>
              <span className="font-bold tracking-tight text-slate-900">CampusRide</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active === item.href
                      ? "bg-emerald-50 font-semibold text-emerald-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{role === "STUDENT" ? "Student / Staff" : role === "DRIVER" ? "Driver" : "Campus Admin"}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                active === item.href ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
