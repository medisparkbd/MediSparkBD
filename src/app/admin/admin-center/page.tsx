"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading } from "@/components/auth/AccessGuard";
import { cardClass, buttonPrimaryClass, buttonSecondaryClass } from "@/components/admin/admin-ui";

type AdminAccount = {
  uid?: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
  role: string;
  isActive: number | boolean;
  createdAt?: string | null;
};

const ROLES = [
  {
    value: "admin",
    label: "Admin",
    color: "bg-purple-500",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    viewHref: "/admin/admin-center/admins",
    rolesHref: "/admin/admin-center/roles/admin",
  },
  {
    value: "moderator",
    label: "Moderator",
    color: "bg-blue-500",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    viewHref: "/admin/admin-center/moderators",
    rolesHref: "/admin/admin-center/roles/moderator",
  },
  {
    value: "teacher",
    label: "Teacher",
    color: "bg-emerald-500",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    viewHref: "/admin/admin-center/teachers",
    rolesHref: "/admin/admin-center/roles/teacher",
  },
] as const;

export default function AdminCenterPage() {
  const { user, authLoading } = useAuth();
  const [admins, setAdmins] = useState<AdminAccount[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/accounts", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { admins?: AdminAccount[] };
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
    } catch {
      setAdmins([]);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  if (authLoading) {
    return <AccessLoading label="Loading Admin Center…" />;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#0b1e3a] admin-dark:text-white">Admin Center</h1>
      <p className="mt-1 text-sm text-slate-500 admin-dark:text-slate-400">
        Manage staff roles, permissions and admin accounts.
      </p>

      {/* 3 Role Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => {
          const count = (admins ?? []).filter(
            (a) => (a.role ?? "admin").toLowerCase() === role.value,
          ).length;

          return (
            <div
              key={role.value}
              className={`${cardClass} p-6 flex flex-col items-center text-center`}
            >
              {/* Avatar */}
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-lg ${role.color}`}
              >
                {role.label.charAt(0)}
              </span>

              {/* Title + count */}
              <h2 className="mt-4 text-lg font-extrabold text-[#0b1e3a] admin-dark:text-white">
                {role.label}
              </h2>
              <p className="mt-1 text-xs text-slate-500 admin-dark:text-slate-400">
                {count} {count === 1 ? "user" : "users"}
              </p>

              {/* 2 Buttons */}
              <div className="mt-5 flex w-full flex-col gap-2">
                <Link
                  href={role.viewHref}
                  className={`${buttonPrimaryClass} text-center text-xs`}
                >
                  View {role.label}s
                </Link>
                <Link
                  href={role.rolesHref}
                  className={`${buttonSecondaryClass} text-center text-xs`}
                >
                  {role.label} Roles
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick info */}
      <div className={`${cardClass} mt-6 p-5`}>
        <h3 className="text-sm font-extrabold text-[#0b1e3a] admin-dark:text-white">How it works</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-slate-500 admin-dark:text-slate-400">
          <li>
            <span className="font-bold text-[#0b1e3a] admin-dark:text-white">View [Users]</span> — See all registered users under that role, with an option to add new ones.
          </li>
          <li>
            <span className="font-bold text-[#0b1e3a] admin-dark:text-white">[Role] Roles</span> — Configure permissions for each role level (what each role can access).
          </li>
        </ul>
      </div>
    </section>
  );
}
