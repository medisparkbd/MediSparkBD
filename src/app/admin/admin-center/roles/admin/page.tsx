"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import {
  useAdminGate,
  hasAdminPermission,
  cardClass,
  buttonPrimaryClass,
  buttonDangerClass,
} from "@/components/admin/admin-ui";

const ALL_PERMISSIONS = [
  { value: "manageContent", label: "Home Control", desc: "Website settings, banners, homepage sections" },
  { value: "manageCourses", label: "Course Control", desc: "Courses, categories, pricing" },
  { value: "manageCourseContent", label: "Course Content Control", desc: "Course content structure, flow, subjects" },
  { value: "manageStudents", label: "Enrollment Control / Student Control", desc: "Enrollment, student management" },
  { value: "managePublicExam", label: "Public Exam Control", desc: "Public exam management, categories, batches" },
  { value: "manageQa", label: "Q&A Control", desc: "Q&A management, subjects, guidelines" },
  { value: "manageSystem", label: "Dashboard Control / System", desc: "System settings, dashboard, notifications" },
  { value: "manageExams", label: "Exams (legacy broad)", desc: "Legacy broad exam access" },
  { value: "manageResults", label: "Result Control", desc: "Result sheets, rankings" },
  { value: "manageAdmins", label: "Admin Center", desc: "Admin/Moderator/Teacher management" },
] as const;

export default function AdminRolesPage() {
  const gate = useAdminGate();
  const allowed = hasAdminPermission(gate, "manageAdmins");
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const [confirmResign, setConfirmResign] = useState(false);
  const [resignBusy, setResignBusy] = useState(false);
  const [resignMsg, setResignMsg] = useState<string | null>(null);

  const handleResign = useCallback(async () => {
    if (!user) return;
    setResignBusy(true);
    setResignMsg(null);
    try {
      const res = await fetch("/api/admin/accounts/resign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setResignMsg(data?.error ?? "Failed to resign.");
        setResignBusy(false);
        return;
      }
      router.push("/admin/admin-center");
    } catch {
      setResignMsg("Network error.");
      setResignBusy(false);
    }
  }, [user, router]);

  if (!gate.ready) return <AccessLoading label="Loading Admin Roles…" />;
  if (!allowed) {
    return (
      <AccessMessage
        title="Admin Roles — Administration access required"
        message="Your role does not include permission to view Admin Roles."
        actionLabel="Back to Admin Center"
        actionHref="/admin/admin-center"
      />
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mt-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0b1e3a] admin-dark:text-white">Admin Role</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 admin-dark:text-slate-400">
          Admin Center → Admin Roles. The Admin role has full access to every Admin Panel control and system setting.
        </p>
      </header>

      {/* Full Access Info */}
      <div className={`${cardClass} mt-6 p-5`}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500 text-lg font-extrabold text-white shadow-lg">
            A
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#0b1e3a] admin-dark:text-white">Admin Permissions</h2>
            <p className="text-xs text-neutral-500">Full Access — all permissions are always enabled</p>
          </div>
        </div>
      </div>

      {/* Permissions list (read-only, all ON) */}
      <div className={`${cardClass} mt-4 p-5`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Access Permissions</h3>
        <p className="mt-1 text-xs text-slate-500">Admin has unrestricted access to all Admin Panel features and controls.</p>
        <div className="mt-4 space-y-2">
          {ALL_PERMISSIONS.map((perm) => (
            <div
              key={perm.value}
              className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 admin-dark:border-emerald-500/20 admin-dark:bg-emerald-500/10"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0b1e3a] admin-dark:text-white">{perm.label}</p>
                <p className="text-[11px] text-neutral-500">{perm.desc}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 admin-dark:text-emerald-400">
                Always ON
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500 admin-dark:text-slate-400">
          The Admin role cannot be restricted. All permissions are permanently granted and cannot be removed.
        </p>
      </div>

      {/* Resign as Admin */}
      <div className={`${cardClass} mt-4 p-5`}>
        <h3 className="text-sm font-extrabold text-[#0b1e3a] admin-dark:text-white">Admin Actions</h3>
        <p className="mt-1 text-xs text-neutral-500">
          You can voluntarily resign from the Admin role. This action only affects your own account.
        </p>
        <div className="mt-4">
          {!confirmResign ? (
            <button
              type="button"
              onClick={() => setConfirmResign(true)}
              className={buttonDangerClass + " flex items-center gap-2 px-4 py-2.5 text-xs font-bold w-auto"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Resign as Admin
            </button>
          ) : (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 admin-dark:border-red-500/30 admin-dark:bg-red-500/10">
              <p className="text-sm font-semibold text-red-700 admin-dark:text-red-400">
                Are you sure you want to resign as Admin?
              </p>
              <p className="mt-1 text-xs text-red-500 admin-dark:text-red-300">
                You will lose all admin permissions and access to the Admin Panel. This action only applies to your own account.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleResign()}
                  disabled={resignBusy}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {resignBusy ? "Resigning…" : "Confirm Resignation"}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmResign(false); setResignMsg(null); }}
                  disabled={resignBusy}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 admin-dark:border-zinc-600 admin-dark:bg-zinc-800 admin-dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
              {resignMsg && (
                <p className="mt-2 text-xs font-semibold text-red-500">{resignMsg}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
