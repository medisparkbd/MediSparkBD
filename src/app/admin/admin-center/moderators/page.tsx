"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import {
  useAdminGate,
  hasAdminPermission,
  cardClass,
  inputClass,
  buttonPrimaryClass,
} from "@/components/admin/admin-ui";

type AdminAccount = {
  uid?: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
  role: string;
  isActive: number | boolean;
  createdAt?: string | null;
};

export default function ViewModeratorsPage() {
  const gate = useAdminGate();
  const allowed = hasAdminPermission(gate, "manageAdmins");
  const { user, authLoading } = useAuth();
  const [staff, setStaff] = useState<AdminAccount[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const res = await fetch("/api/admin/accounts", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { admins?: AdminAccount[] };
      const allAdmins = Array.isArray(data.admins) ? data.admins : [];
      setStaff(allAdmins.filter((a) => (a.role ?? "admin").toLowerCase() === "moderator"));
    } catch {
      setStaff([]);
      setLoadError(true);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !addEmail.trim()) return;
    setAddBusy(true);
    setAddMsg(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          email: addEmail.trim(),
          displayName: addName.trim() || undefined,
          role: "moderator",
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; admins?: AdminAccount[] } | null;
      if (!res.ok) {
        setAddMsg({ kind: "err", text: data?.error ?? "Failed to add moderator." });
        return;
      }
      setAddMsg({ kind: "ok", text: "Moderator added successfully." });
      setAddEmail("");
      setAddName("");
      if (data?.admins) {
        const all = data.admins;
        setStaff(all.filter((a) => (a.role ?? "admin").toLowerCase() === "moderator"));
      } else {
        void load();
      }
    } catch {
      setAddMsg({ kind: "err", text: "Network error." });
    } finally {
      setAddBusy(false);
    }
  }

  if (!gate.ready) return <AccessLoading label="Loading Moderator Users…" />;
  if (!allowed) {
    return (
      <AccessMessage
        title="Moderator Users — Administration access required"
        message="Your role does not include permission to view moderator users."
        actionLabel="Back to Admin Center"
        actionHref="/admin/admin-center"
      />
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0b1e3a] admin-dark:text-white">Moderator Users</h1>
          <p className="mt-1 text-sm text-slate-500 admin-dark:text-slate-400">
            All staff members with the Moderator role.
          </p>
        </div>
        <Link
          href="/admin/admin-center"
          className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 admin-dark:bg-[#1e3a65] admin-dark:text-white admin-dark:hover:bg-[#234e9f] transition"
        >
          ← Back to Admin Center
        </Link>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
          <p className="text-sm text-red-600 admin-dark:text-red-400">Failed to load moderator users.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-bold text-[#0b1e3a] hover:border-[#93c5fd] admin-dark:text-white"
          >
            Retry
          </button>
        </div>
      ) : staff === null ? (
        <AccessLoading label="Loading moderator users…" />
      ) : staff.length === 0 ? (
        <div className={`${cardClass} p-8 text-center`}>
          <p className="text-sm text-slate-500 admin-dark:text-slate-400">No moderator users found.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {staff.map((member) => (
            <li
              key={member.email}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dbeafe] bg-white shadow-sm shadow-[#0b1e3a]/5 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] px-4 py-3"
            >
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.displayName || member.email}
                  className="h-11 w-11 shrink-0 rounded-full object-cover shadow-md"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-extrabold text-white shadow-md">
                  {(member.displayName || member.email || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0b1e3a] admin-dark:text-white">
                  {member.displayName || member.email}
                </p>
                <p className="truncate text-[11px] text-slate-500 admin-dark:text-slate-400">
                  {member.email}
                  {member.uid && ` · UID: ${member.uid.slice(0, 8)}…`}
                </p>
              </div>
              <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 admin-dark:text-blue-400">
                Moderator
              </span>
              <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                Number(member.isActive) === 1
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 admin-dark:text-yellow-400"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 admin-dark:text-emerald-400"
              }`}>
                {Number(member.isActive) === 1 ? "Active" : "Inactive"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className={`${cardClass} mt-6 p-4`}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 admin-dark:text-slate-400">+ Add Moderator</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" disabled={addBusy || !addEmail.trim()} className={buttonPrimaryClass}>
            {addBusy ? "Adding…" : "Add Moderator"}
          </button>
        </div>
        {addMsg && (
          <p className={`mt-2 text-xs font-semibold ${addMsg.kind === "ok" ? "text-emerald-600 admin-dark:text-emerald-400" : "text-red-600 admin-dark:text-red-400"}`}>
            {addMsg.text}
          </p>
        )}
      </form>
    </section>
  );
}
