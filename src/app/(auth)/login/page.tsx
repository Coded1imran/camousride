import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { role?: string; registered?: string };
}) {
  const isAdminHint = searchParams.role === "ADMIN";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl backdrop-blur">
      <h1 className="text-2xl font-bold text-white">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-400">
        {isAdminHint
          ? "Campus admin sign in. Use your seeded admin account."
          : "Log in to request rides, drive, or manage campus transport."}
      </p>

      {searchParams.registered === "1" && (
        <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          Account created. Please log in.
        </p>
      )}

      <div className="mt-6">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-sm text-slate-400">
        New here?{" "}
        <Link href="/register" className="font-semibold text-emerald-300 hover:text-emerald-200">
          Create an account
        </Link>
      </p>
    </div>
  );
}
