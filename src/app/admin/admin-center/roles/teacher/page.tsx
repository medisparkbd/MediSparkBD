"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import {
  useAdminGate,
  hasAdminPermission,
  noticeClass,
  cardClass,
  buttonPrimaryClass,
  type Notice,
} from "@/components/admin/admin-ui";

const PERMISSIONS = [
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

const TEACHER_DEFAULT = ["manageCourseContent", "managePublicExam", "manageQa", "manageResults"];

export default function TeacherRolesPage() {
  const gate = useAdminGate();
  const allowed = hasAdminPermission(gate, "manageAdmins");
  const { user, authLoading } = useAuth();
  const [matrix, setMatrix] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/roles", { cache: "no-store", headers: gate.headers });
      const data = (await res.json()) as { rolePermissions?: Record<string, string[]> };
      setMatrix(data.rolePermissions?.teacher ?? null);
    } catch {
      setMatrix(null);
    }
  }, [user, gate.headers]);

  useEffect(() => {
    if (gate.ready && allowed) void load();
  }, [gate.ready, allowed, load]);

  function togglePermission(permission: string) {
    setMatrix((prev) => {
      const current = prev ?? [...TEACHER_DEFAULT];
      const next = current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission];
      return next;
    });
  }

  async function save() {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...gate.headers },
        body: JSON.stringify({ rolePermissions: { teacher: matrix ?? [] } }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; rolePermissions?: Record<string, string[]> } | null;
      if (!res.ok) {
        setNotice({ kind: "error", text: data?.error ?? "Failed to save Teacher permissions." });
        return;
      }
      setMatrix(data?.rolePermissions?.teacher ?? matrix);
      setNotice({ kind: "success", text: "Teacher permissions saved. Changes apply immediately to frontend and backend." });
    } catch {
      setNotice({ kind: "error", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  if (!gate.ready) return <AccessLoading label="Loading Teacher Roles…" />;
  if (!allowed) {
    return (
      <AccessMessage
        title="Teacher Roles — Administration access required"
        message="Your role does not include permission to manage Teacher permissions. Only Admin can manage roles."
        actionLabel="Back to Admin Center"
        actionHref="/admin/admin-center"
      />
    );
  }

  const currentPerms = matrix ?? [...TEACHER_DEFAULT];

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mt-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0b1e3a] admin-dark:text-white">Teacher Role</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 admin-dark:text-slate-400">
          Admin Center → Teacher Roles. Configure which Admin Panel controls Teachers can access.
        </p>
      </header>

      {/* Role info */}
      <div className={`${cardClass} mt-6 p-5`}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-extrabold text-white shadow-lg">
            T
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#0b1e3a] admin-dark:text-white">Teacher Permissions</h2>
            <p className="text-xs text-neutral-500">Only an Admin can change these permissions. Teachers cannot modify their own or others&apos; permissions.</p>
          </div>
        </div>
      </div>

      {/* Permission toggles */}
      <div className={`${cardClass} mt-4 p-5`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Permissions</h3>
        <p className="mt-1 text-xs text-slate-500">Toggle ON/OFF to grant or revoke each permission for all Teacher accounts.</p>
        <div className="mt-4 space-y-2">
          {PERMISSIONS.map((perm) => {
            const isEnabled = currentPerms.includes(perm.value);
            const isForbidden = perm.value === "manageAdmins";
            return (
              <div
                key={perm.value}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  isForbidden
                    ? "border-neutral-200 bg-neutral-50 opacity-60 admin-dark:border-zinc-700 admin-dark:bg-zinc-900/50"
                    : isEnabled
                    ? "border-emerald-200 bg-emerald-50 admin-dark:border-emerald-500/20 admin-dark:bg-emerald-500/10"
                    : "border-neutral-200 bg-white admin-dark:border-zinc-700 admin-dark:bg-zinc-900/30"
                }`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`${perm.label}: ${isEnabled ? "ON" : "OFF"}`}
                  disabled={isForbidden}
                  onClick={() => !isForbidden && togglePermission(perm.value)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isEnabled ? "bg-emerald-500" : "bg-neutral-300 admin-dark:bg-zinc-600"
                  } ${isForbidden ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0b1e3a] admin-dark:text-white">{perm.label}</p>
                  <p className="text-[11px] text-neutral-500">{perm.desc}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isForbidden
                    ? "bg-neutral-100 text-neutral-400 admin-dark:bg-zinc-800 admin-dark:text-zinc-500"
                    : isEnabled
                    ? "bg-emerald-500/10 text-emerald-600 admin-dark:text-emerald-400"
                    : "bg-neutral-100 text-neutral-400 admin-dark:bg-zinc-800 admin-dark:text-zinc-500"
                }`}>
                  {isForbidden ? "Forbidden" : isEnabled ? "ON" : "OFF"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-500 admin-dark:text-slate-400">
          <strong>Note:</strong> &quot;Admin Center&quot; permission is always forbidden for Teachers. Teachers cannot access role management under any circumstance.
        </p>
      </div>

      {/* Save */}
      <button type="button" onClick={() => void save()} disabled={busy} className={`${buttonPrimaryClass} mt-5`}>
        {busy ? "Saving…" : "Save Teacher Permissions"}
      </button>
      {notice && <p role="status" className={noticeClass(notice)}>{notice.text}</p>}
    </section>
  );
}
