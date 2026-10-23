import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.16),_transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2.5 self-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-slate-950">C</span>
          <span className="text-xl font-bold tracking-tight text-white">CampusRide</span>
        </Link>
        {children}
        <p className="mt-8 text-center text-xs text-slate-500">
          Powered by Gemma 4 · Safe, shared campus rides
        </p>
      </div>
    </div>
  );
}
