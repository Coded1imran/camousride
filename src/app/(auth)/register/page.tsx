import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { role?: string };
}) {
  const defaultRole = searchParams.role === "DRIVER" ? "DRIVER" : "STUDENT";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl backdrop-blur">
      <h1 className="text-2xl font-bold text-white">Create your account</h1>
      <p className="mt-1 text-sm text-slate-400">
        Students, staff and drivers register with their university email. Admins are seeded by the transport office.
      </p>
      <div className="mt-6">
        <RegisterForm defaultRole={defaultRole} />
      </div>
      <p className="mt-6 text-center text-sm text-slate-400">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">
          Log in
        </Link>
      </p>
    </div>
  );
}
