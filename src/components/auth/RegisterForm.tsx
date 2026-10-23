"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "STUDENT" | "DRIVER";

export function RegisterForm({ defaultRole }: { defaultRole: Role }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(defaultRole);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    department: "",
    hostel: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role,
          phone: form.phone || undefined,
          department: form.department || undefined,
          hostel: form.hostel || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unable to create account.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-800/80 p-1">
        {(["STUDENT", "DRIVER"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              role === r ? "bg-emerald-500 text-slate-950" : "text-slate-300 hover:text-white"
            }`}
          >
            {r === "STUDENT" ? "Student / Staff" : "Driver"}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="name" className="label text-slate-300">Full name</label>
        <input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} className="input" placeholder="Adaeze Okafor" />
      </div>

      <div>
        <label htmlFor="email" className="label text-slate-300">University email</label>
        <input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className="input" placeholder="you@university.edu.ng" />
      </div>

      <div>
        <label htmlFor="password" className="label text-slate-300">Password (min 8 chars)</label>
        <input id="password" type="password" minLength={8} required value={form.password} onChange={(e) => update("password", e.target.value)} className="input" placeholder="••••••••" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="department" className="label text-slate-300">Department</label>
          <input id="department" value={form.department} onChange={(e) => update("department", e.target.value)} className="input" placeholder="Computer Science" />
        </div>
        <div>
          <label htmlFor="hostel" className="label text-slate-300">
            {role === "DRIVER" ? "Base location" : "Hostel / home"}
          </label>
          <input id="hostel" value={form.hostel} onChange={(e) => update("hostel", e.target.value)} className="input" placeholder="Moremi Hall" />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="label text-slate-300">Phone (optional)</label>
        <input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="input" placeholder="0803 000 0000" />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Creating account…" : role === "DRIVER" ? "Create driver account" : "Create rider account"}
      </button>
    </form>
  );
}
