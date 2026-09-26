"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminGate, cardClass, inputClass, labelClass, buttonPrimaryClass, buttonSecondaryClass, badgeClass, badgeSuccessClass, badgeWarningClass, badgeInfoClass, badgeDangerClass, tableHeaderClass, tableRowClass } from "@/components/admin/admin-ui";
import { AccessLoading } from "@/components/auth/AccessGuard";
import { useAuth } from "@/lib/auth-context";

export type UIRule = {
  id: number;
  ruleId: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  origin: string;
  sourceRef: string | null;
  referenceNote: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type UIVersion = {
  version: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  changedBy: string | null;
  changedAt: string;
};

type UIAudit = {
  id: number;
  ruleId: string;
  action: string;
  oldData: unknown;
  newData: unknown;
  performedBy: string | null;
  performedAt: string;
};

const CATEGORIES = ["General", "Course", "Exam", "Student", "Finance", "Admin", "Content", "Technical", "AI"];
const PRIORITIES = ["Critical", "High", "Normal", "Low"];
const STATUSES = ["Active", "Draft", "Archived"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function priorityBadge(p: string): string {
  if (p === "Critical") return badgeDangerClass;
  if (p === "High") return badgeWarningClass;
  if (p === "Low") return badgeInfoClass;
  return badgeSuccessClass;
}

type Toast = { kind: "success" | "error"; text: string };

const emptyForm = {
  category: "Admin",
  title: "",
  description: "",
  priority: "Normal",
  status: "Active",
  sourceRef: "",
  referenceNote: "",
  autoId: true,
  ruleId: "",
};

export default function RulesManager({ standalone = false }: { standalone?: boolean }) {
  const gate = useAdminGate();
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<UIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UIRule | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<UIRule | null>(null);
  const [versions, setVersions] = useState<UIVersion[]>([]);
  const [audit, setAudit] = useState<UIAudit[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [recentAudit, setRecentAudit] = useState<UIAudit[]>([]);
  const [confirm, setConfirm] = useState<{ rule: UIRule; action: "archive" | "restore" } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Standalone /rules.html gate: unauthenticated → /login, non-admin → /.
  useEffect(() => {
    if (!standalone || authLoading) return;
    if (!user) {
      router.replace("/login?next=%2Frules.html");
      return;
    }
    if (gate.denied) router.replace("/");
  }, [standalone, authLoading, user, gate.denied, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchRules = useCallback(async () => {
    if (!gate.ready) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (debouncedQ) sp.set("q", debouncedQ);
      if (category) sp.set("category", category);
      if (priority) sp.set("priority", priority);
      if (status) sp.set("status", status);
      if (origin) sp.set("origin", origin);
      sp.set("sort", sort);
      sp.set("order", order);
      sp.set("limit", "300");
      const res = await fetch(`/api/admin/rules?${sp.toString()}`, { headers: gate.headers, cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { rules?: UIRule[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Failed to load rules.");
      setRules(Array.isArray(data?.rules) ? data.rules : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules.");
    } finally {
      setLoading(false);
    }
  }, [gate.ready, gate.headers, debouncedQ, category, priority, status, origin, sort, order]);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const counts = useMemo(() => {
    return {
      total: rules.length,
      active: rules.filter((r) => r.status === "Active").length,
      draft: rules.filter((r) => r.status === "Draft").length,
      archived: rules.filter((r) => r.status === "Archived").length,
      proposed: rules.filter((r) => r.origin === "proposed").length,
    };
  }, [rules]);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, category: category || "Admin" });
    setShowForm(true);
  }

  function openEdit(rule: UIRule) {
    setEditing(rule);
    setForm({
      category: rule.category,
      title: rule.title,
      description: rule.description,
      priority: rule.priority,
      status: rule.status === "Archived" ? "Active" : rule.status,
      sourceRef: rule.sourceRef ?? "",
      referenceNote: rule.referenceNote ?? "",
      autoId: false,
      ruleId: rule.ruleId,
    });
    setShowForm(true);
  }

  async function submitForm() {
    if (!gate.ready || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: form.status,
        sourceRef: form.sourceRef.trim() || null,
        referenceNote: form.referenceNote.trim() || null,
      };
      if (editing) {
        const res = await fetch(`/api/admin/rules/${encodeURIComponent(editing.ruleId)}`, {
          method: "PUT",
          headers: { ...gate.headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as { rule?: UIRule; error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? "Failed to update the rule.");
        setToast({ kind: "success", text: `${editing.ruleId} updated.` });
      } else {
        if (form.autoId) {
          payload.autoId = true;
        } else {
          payload.ruleId = form.ruleId.trim().toUpperCase();
        }
        const res = await fetch("/api/admin/rules", {
          method: "POST",
          headers: { ...gate.headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as { rule?: UIRule; error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? "Failed to create the rule.");
        setToast({ kind: "success", text: `${data?.rule?.ruleId ?? "Rule"} created.` });
      }
      setShowForm(false);
      await fetchRules();
    } catch (e) {
      setToast({ kind: "error", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(rule: UIRule) {
    if (!gate.ready) return;
    setDetail(rule);
    setDetailLoading(true);
    setVersions([]);
    setAudit([]);
    try {
      const res = await fetch(`/api/admin/rules/${encodeURIComponent(rule.ruleId)}?include=versions,audit`, {
        headers: gate.headers,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { rule?: UIRule; versions?: UIVersion[]; audit?: UIAudit[] } | null;
      if (res.ok && data) {
        if (data.rule) setDetail(data.rule);
        setVersions(Array.isArray(data.versions) ? data.versions : []);
        setAudit(Array.isArray(data.audit) ? data.audit : []);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function runArchiveRestore() {
    if (!confirm || !gate.ready) return;
    try {
      const res = await fetch(`/api/admin/rules/${encodeURIComponent(confirm.rule.ruleId)}`, {
        method: "PATCH",
        headers: { ...gate.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirm.action }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Action failed.");
      setToast({ kind: "success", text: `${confirm.rule.ruleId} ${confirm.action === "archive" ? "archived" : "restored"}.` });
      setConfirm(null);
      setDetail(null);
      await fetchRules();
    } catch (e) {
      setToast({ kind: "error", text: e instanceof Error ? e.message : "Action failed." });
    }
  }

  async function loadRecentAudit() {
    if (!gate.ready) return;
    try {
      const res = await fetch("/api/admin/rules-audit?limit=100", { headers: gate.headers, cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { logs?: UIAudit[] } | null;
      setRecentAudit(Array.isArray(data?.logs) ? data.logs : []);
    } catch {
      setRecentAudit([]);
    }
  }

  async function seed() {
    if (!gate.ready || seeding) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { ...gate.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ seed: true }),
      });
      const data = (await res.json().catch(() => null)) as { rules?: UIRule[]; seeded?: { inserted: number; total: number }; error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Seeding failed.");
      setToast({ kind: "success", text: `Seeded ${data?.seeded?.inserted ?? 0} rules.` });
      await fetchRules();
    } catch (e) {
      setToast({ kind: "error", text: e instanceof Error ? e.message : "Seeding failed." });
    } finally {
      setSeeding(false);
    }
  }

  function toggleSort(col: string) {
    if (sort === col) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setOrder(col === "ruleId" ? "asc" : "desc");
    }
  }

  if (!gate.ready) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-10 sm:px-6">
        <AccessLoading label="Verifying admin access…" />
      </section>
    );
  }

  if (gate.denied) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <p className="text-lg font-extrabold text-red-600">Admin access required</p>
          <p className="mt-2 text-sm text-neutral-600 admin-dark:text-slate-400">
            Sign in with an authorized MediSpark BD admin account to view internal rules.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#234e9f] admin-dark:text-[#93c5fd]">Internal · Admin-only</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0b1e3a] sm:text-3xl admin-dark:text-white">Rules Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 admin-dark:text-[#8da0c0]">
            {counts.total} rules · {counts.active} active · {counts.draft} draft · {counts.archived} archived · {counts.proposed} proposed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setShowAudit((s) => !s); if (!showAudit) void loadRecentAudit(); }} className={buttonSecondaryClass}>
            {showAudit ? "Hide audit" : "Audit log"}
          </button>
          <button type="button" onClick={openAdd} className={buttonPrimaryClass}>+ Add Rule</button>
        </div>
      </header>

      {toast && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${toast.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 admin-dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-600 admin-dark:text-red-400"}`}>
          {toast.text}
        </div>
      )}

      <div className={`${cardClass} mt-5 p-4`}>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div>
            <label className={labelClass} htmlFor="rules-q">Search</label>
            <input id="rules-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, title, description, admin…" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="rules-cat">Category</label>
            <select id="rules-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="rules-pri">Priority</label>
            <select id="rules-pri" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              <option value="">All</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="rules-status">Status</label>
            <select id="rules-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="rules-origin">Source</label>
            <select id="rules-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="existing">Existing</option>
              <option value="proposed">Proposed</option>
            </select>
          </div>
        </div>
      </div>

      {showAudit && (
        <div className={`${cardClass} mt-4 p-4`}>
          <h2 className="text-sm font-extrabold text-[#0b1e3a] admin-dark:text-white">Recent audit trail (latest 100)</h2>
          {recentAudit.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No audit entries yet.</p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {recentAudit.map((a) => (
                <li key={a.id} className="rounded-xl border border-[#eef4ff] px-3 py-2 text-xs admin-dark:border-[#1e3a65]/50">
                  <span className="font-bold">{a.action}</span> · <span className="font-mono font-bold">{a.ruleId}</span> · {a.performedBy ?? "unknown"} · {fmtDate(a.performedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={`${cardClass} mt-4 overflow-hidden`}>
        {loading ? (
          <div className="p-6"><AccessLoading label="Loading rules…" /></div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm font-bold text-red-600">{error}</p>
            <button type="button" onClick={() => void fetchRules()} className={`${buttonSecondaryClass} mt-3`}>Try again</button>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-extrabold text-[#0b1e3a] admin-dark:text-white">No rules yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Seed the discovered codebase rules (Existing vs Proposed) or add your first rule.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => void seed()} disabled={seeding} className={buttonPrimaryClass}>
                {seeding ? "Seeding…" : "Seed discovered rules"}
              </button>
              <button type="button" onClick={openAdd} className={buttonSecondaryClass}>+ Add Rule</button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className={tableHeaderClass}>
                  {(["ruleId", "category", "priority", "status", "updatedAt"] as const).map((col) => (
                    <th key={col} className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-widest">
                      <button type="button" onClick={() => toggleSort(col)} className="hover:underline">
                        {col === "ruleId" ? "ID" : col === "updatedAt" ? "Updated" : col[0].toUpperCase() + col.slice(1)}
                        {sort === col ? (order === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-widest">Rule</th>
                  <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-widest">Source</th>
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.ruleId} className={tableRowClass}>
                    <td className="px-4 py-3 font-mono text-xs font-bold">{r.ruleId}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{r.category}</td>
                    <td className="px-4 py-3"><span className={`${badgeClass} ${priorityBadge(r.priority)}`}>{r.priority}</span></td>
                    <td className="px-4 py-3"><span className={`${badgeClass} ${r.status === "Active" ? badgeSuccessClass : r.status === "Draft" ? badgeWarningClass : badgeDangerClass}`}>{r.status}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.updatedAt)}</td>
                    <td className="max-w-[320px] px-4 py-3">
                      <p className="truncate font-bold text-[#0b1e3a] admin-dark:text-slate-100">{r.title}</p>
                      <p className="truncate text-xs text-slate-500">{r.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${badgeClass} ${r.origin === "proposed" ? badgeWarningClass : badgeInfoClass}`}>{r.origin === "proposed" ? "Proposed" : "Existing"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => void openDetail(r)} className={buttonSecondaryClass}>View</button>
                        <button type="button" onClick={() => openEdit(r)} disabled={r.status === "Archived"} className={buttonSecondaryClass}>Edit</button>
                        {r.status === "Archived" ? (
                          <button type="button" onClick={() => setConfirm({ rule: r, action: "restore" })} className={buttonSecondaryClass}>Restore</button>
                        ) : (
                          <button type="button" onClick={() => setConfirm({ rule: r, action: "archive" })} className={buttonSecondaryClass}>Archive</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
          <button type="button" aria-label="Close" onClick={() => setShowForm(false)} className="absolute inset-0" />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6 admin-dark:bg-[#112544]">
            <h2 className="text-lg font-extrabold text-[#0b1e3a] admin-dark:text-white">{editing ? `Edit ${editing.ruleId}` : "+ Add Rule"}</h2>
            <p className="mt-1 text-xs text-slate-500">Rule IDs are validated per category prefix. Duplicates are rejected server-side.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="f-cat">Category</label>
                <select id="f-cat" value={form.category} disabled={!!editing} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="f-pri">Priority</label>
                <select id="f-pri" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={inputClass}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {!editing && (
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 admin-dark:text-slate-300">
                    <input type="checkbox" checked={form.autoId} onChange={(e) => setForm((f) => ({ ...f, autoId: e.target.checked }))} />
                    Generate Rule ID automatically
                  </label>
                  {!form.autoId && (
                    <input value={form.ruleId} onChange={(e) => setForm((f) => ({ ...f, ruleId: e.target.value }))} placeholder="e.g. ADMIN-009" className={`${inputClass} mt-2 font-mono`} />
                  )}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="f-title">Title</label>
                <input id="f-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Rule title" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="f-desc">Description</label>
                <textarea id="f-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} placeholder="Detailed explanation…" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="f-status">Status</label>
                <select id="f-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  {!editing && <option value="Archived">Archived</option>}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="f-src">Source / Reference</label>
                <input id="f-src" value={form.sourceRef} onChange={(e) => setForm((f) => ({ ...f, sourceRef: e.target.value }))} placeholder="src/lib/admin.ts" className={`${inputClass} font-mono`} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="f-note">Reference note (optional)</label>
                <input id="f-note" value={form.referenceNote} onChange={(e) => setForm((f) => ({ ...f, referenceNote: e.target.value }))} placeholder="Feature/module, date introduced…" className={inputClass} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className={buttonSecondaryClass}>Cancel</button>
              <button type="button" onClick={() => void submitForm()} disabled={saving} className={buttonPrimaryClass}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create rule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
          <button type="button" aria-label="Close" onClick={() => setDetail(null)} className="absolute inset-0" />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6 admin-dark:bg-[#112544]">
            <p className="font-mono text-xs font-bold text-[#234e9f] admin-dark:text-[#93c5fd]">{detail.ruleId} · {detail.category} · {detail.origin}</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#0b1e3a] admin-dark:text-white">{detail.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 admin-dark:text-slate-300">{detail.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`${badgeClass} ${priorityBadge(detail.priority)}`}>{detail.priority}</span>
              <span className={`${badgeClass} ${badgeSuccessClass}`}>{detail.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="font-bold uppercase tracking-wider text-slate-400">Created by</dt><dd>{detail.createdBy ?? "—"}</dd></div>
              <div><dt className="font-bold uppercase tracking-wider text-slate-400">Updated by</dt><dd>{detail.updatedBy ?? "—"}</dd></div>
              <div><dt className="font-bold uppercase tracking-wider text-slate-400">Created</dt><dd>{fmtDate(detail.createdAt)}</dd></div>
              <div><dt className="font-bold uppercase tracking-wider text-slate-400">Updated</dt><dd>{fmtDate(detail.updatedAt)}</dd></div>
              <div className="col-span-2"><dt className="font-bold uppercase tracking-wider text-slate-400">Source</dt><dd className="font-mono">{detail.sourceRef ?? "—"}</dd></div>
              {detail.referenceNote && <div className="col-span-2"><dt className="font-bold uppercase tracking-wider text-slate-400">Note</dt><dd>{detail.referenceNote}</dd></div>}
            </dl>
            <h3 className="mt-5 text-sm font-extrabold">Version history</h3>
            {detailLoading ? (
              <p className="mt-2 text-xs text-slate-500">Loading history…</p>
            ) : versions.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No versions recorded.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {versions.map((v) => (
                  <li key={v.version} className="rounded-xl border border-[#eef4ff] px-3 py-2 text-xs admin-dark:border-[#1e3a65]/50">
                    <p className="font-bold">Version {v.version} · {v.status} · {v.priority} · {fmtDate(v.changedAt)}</p>
                    <p className="mt-0.5 font-semibold">{v.title}</p>
                    <p className="mt-0.5 text-slate-500">{v.description.slice(0, 220)}{v.description.length > 220 ? "…" : ""}</p>
                    <p className="mt-0.5 text-slate-400">by {v.changedBy ?? "unknown"}</p>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDetail(null)} className={buttonSecondaryClass}>Close</button>
              {detail.status !== "Archived" && (
                <button type="button" onClick={() => { const d = detail; setDetail(null); openEdit(d); }} className={buttonPrimaryClass}>Edit</button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl admin-dark:bg-[#112544]">
            <h2 className="text-base font-extrabold">{confirm.action === "archive" ? "Archive" : "Restore"} {confirm.rule.ruleId}?</h2>
            <p className="mt-1 text-sm text-slate-500">
              {confirm.action === "archive" ? "History is preserved and the rule can be restored later." : "The rule returns to Active status."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className={buttonSecondaryClass}>Cancel</button>
              <button type="button" onClick={() => void runArchiveRestore()} className={buttonPrimaryClass}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
