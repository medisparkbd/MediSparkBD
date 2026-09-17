"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { getSocialPlatformIcon } from "@/components/social-icons";
import type { SocialLink } from "@/lib/social-links-constants";

function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 50);
}

export default function SocialLinksManagementPage() {
  const { user, authLoading } = useAuth();
  const toast = useAdminToast();
  const [adminStatus, setAdminStatus] = useState<"checking" | "admin" | "denied">("checking");
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<SocialLink[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: "", icon: "", url: "", isActive: true });
  const [addBusy, setAddBusy] = useState(false);

  // Edit form
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", icon: "", url: "", isActive: true });

  // Admin check
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    user
      .getIdToken()
      .then((token) =>
        fetch("/api/admin", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      )
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { isAdmin?: boolean } | null) => {
        if (!cancelled) setAdminStatus(data?.isAdmin ? "admin" : "denied");
      })
      .catch(() => {
        if (!cancelled) setAdminStatus("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Load links
  useEffect(() => {
    if (adminStatus !== "admin") return;
    let cancelled = false;
    async function load() {
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await fetch("/api/social-links", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = (await res.json()) as { links?: SocialLink[] };
        if (!cancelled && data.links) setLinks(data.links);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [adminStatus, user]);

  async function authHeaders(): Promise<Record<string, string>> {
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  if (authLoading || adminStatus === "checking" || (adminStatus === "admin" && loading)) {
    return <AccessLoading label="Loading social links…" />;
  }

  if (adminStatus === "denied") {
    return (
      <AccessMessage
        title="Administrators only"
        message="Social Links management is restricted to authorized administrators."
        actionLabel="Back to Admin Home"
        actionHref="/admin"
      />
    );
  }

  if (!links) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-center text-sm font-semibold text-red-500">Failed to load social links. Please refresh the page.</p>
      </section>
    );
  }

  function moveLink(index: number, direction: -1 | 1) {
    setLinks((prev) => {
      if (!prev) return prev;
      const items = [...prev];
      const target = index + direction;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      return items;
    });
  }

  async function handleSaveOrder() {
    if (!user || !links) return;
    setSaving(true);
    setNotice(null);
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/social-links", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          links: links.map((link) => ({
            key: link.key,
            label: link.label,
            icon: link.icon ?? null,
            url: link.url?.trim() || null,
            isActive: link.isActive,
          })),
        }),
      });
      const data = (await response.json()) as { error?: string; links?: SocialLink[] };
      if (!response.ok) {
        setNotice({ kind: "error", text: data.error ?? "Failed to save social links." });
        toast.showToast("error", data.error ?? "Failed to save social links.");
        return;
      }
      if (data.links) setLinks(data.links);
      setNotice({ kind: "success", text: "Social links order saved. Live website updated." });
      toast.showToast("success", "Social links order saved. Live website updated.");
    } catch {
      setNotice({ kind: "error", text: "Failed to save social links." });
      toast.showToast("error", "Failed to save social links.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!addForm.label.trim()) {
      toast.showToast("error", "Platform Name is required.");
      return;
    }
    if (addForm.url && addForm.url.trim() && !/^https?:\/\//.test(addForm.url.trim())) {
      toast.showToast("error", "URL must start with http:// or https://");
      return;
    }
    if (!links) return;
    const key = slugifyLabel(addForm.label);
    if (!key || key.length < 2) {
      toast.showToast("error", "Platform Name must produce a valid slug (at least 2 characters).");
      return;
    }
    if (links.some((l) => l.key === key)) {
      toast.showToast("error", `Platform "${addForm.label}" already exists (key: ${key}). Use Edit instead.`);
      return;
    }
    setAddBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/social-links", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key,
          label: addForm.label.trim(),
          icon: addForm.icon.trim() || null,
          url: addForm.url.trim() || null,
          isActive: addForm.isActive,
        }),
      });
      const data = (await res.json()) as { error?: string; links?: SocialLink[] };
      if (!res.ok) {
        toast.showToast("error", data.error ?? "Failed to add social link.");
        return;
      }
      if (data.links) setLinks(data.links);
      toast.showToast("success", `Social link "${addForm.label.trim()}" added. Live website updated.`);
      setAddForm({ label: "", icon: "", url: "", isActive: true });
      setShowAdd(false);
    } catch {
      toast.showToast("error", "Network error while adding.");
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(link: SocialLink) {
    setEditingKey(link.key);
    setEditForm({
      label: link.label,
      icon: link.icon ?? "",
      url: link.url ?? "",
      isActive: link.isActive,
    });
  }

  async function saveEdit() {
    if (!editingKey) return;
    if (!editForm.label.trim()) {
      toast.showToast("error", "Platform Name is required.");
      return;
    }
    if (editForm.url && editForm.url.trim() && !/^https?:\/\//.test(editForm.url.trim())) {
      toast.showToast("error", "URL must start with http:// or https://");
      return;
    }
    setBusyKey(editingKey);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/social-links", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: editingKey,
          label: editForm.label.trim(),
          icon: editForm.icon.trim() || null,
          url: editForm.url.trim() || null,
          isActive: editForm.isActive,
        }),
      });
      const data = (await res.json()) as { error?: string; links?: SocialLink[] };
      if (!res.ok) {
        toast.showToast("error", data.error ?? "Failed to update social link.");
        return;
      }
      if (data.links) setLinks(data.links);
      toast.showToast("success", "Social link updated. Live website updated.");
      setEditingKey(null);
    } catch {
      toast.showToast("error", "Network error.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteLink(key: string, label: string) {
    if (!window.confirm(`Delete "${label}"? This will remove it from the Live Website.`)) return;
    setBusyKey(key);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(`/api/social-links?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { error?: string; links?: SocialLink[] };
      if (!res.ok) {
        toast.showToast("error", data.error ?? "Failed to delete social link.");
        return;
      }
      if (data.links) setLinks(data.links);
      else setLinks((prev) => (prev ? prev.filter((l) => l.key !== key) : prev));
      toast.showToast("success", `"${label}" deleted. Live website updated.`);
    } catch {
      toast.showToast("error", "Network error while deleting.");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleActive(key: string) {
    if (!links) return;
    const link = links.find((l) => l.key === key);
    if (!link) return;
    setBusyKey(key);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/social-links", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: link.key,
          label: link.label,
          icon: link.icon ?? null,
          url: link.url ?? null,
          isActive: !link.isActive,
        }),
      });
      const data = (await res.json()) as { error?: string; links?: SocialLink[] };
      if (!res.ok) {
        toast.showToast("error", data.error ?? "Failed to toggle status.");
        return;
      }
      if (data.links) setLinks(data.links);
      toast.showToast("success", link.isActive ? `"${link.label}" disabled.` : `"${link.label}" enabled.`);
    } catch {
      toast.showToast("error", "Network error.");
    } finally {
      setBusyKey(null);
    }
  }

  const cardClass =
    "rounded-2xl border border-[#dbeafe] bg-white shadow-sm shadow-[#0b1e3a]/5 p-5 transition-colors duration-300 sm:p-6 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544]";
  const inputClass =
    "mt-1 w-full rounded-xl border border-neutral-200 bg-[#f8fbff] px-3 py-2 text-sm text-[#0b1e3a] outline-none transition placeholder:text-slate-400 focus:border-[#2f6bce]/60 focus:bg-white admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100";
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-500 admin-dark:text-slate-400";

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#0b1e3a] admin-dark:text-white">Social Links</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 admin-dark:text-slate-400">
          Manage the social platform links for the “Join With Us Now!” section (after FAQ) and the website footer. Add any platform (Facebook, YouTube, Telegram, Instagram,
          WhatsApp, TikTok or custom), reorder, enable/disable. Changes go live immediately after saving.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary-900/30 transition hover:bg-primary-700"
        >
          {showAdd ? "Cancel" : "+ Add Social Media / Add Link"}
        </button>
        {(links?.length ?? 0) > 1 && (
          <button
            type="button"
            onClick={() => void handleSaveOrder()}
            disabled={saving}
            className="rounded-xl border border-[#dbeafe] bg-white px-5 py-2.5 text-sm font-bold text-[#0b1e3a] transition hover:bg-[#f8fbff] disabled:opacity-50 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] admin-dark:text-zinc-100"
          >
            {saving ? "Saving…" : "Save Order"}
          </button>
        )}
      </div>

      {showAdd && (
        <div className={`${cardClass} mt-4`}>
          <h3 className="text-sm font-extrabold text-[#0b1e3a] admin-dark:text-zinc-100">Add Social Media</h3>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className={labelClass}>Platform Name *</span>
              <input
                value={addForm.label}
                onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                placeholder="e.g. Facebook, TikTok, Discord"
                className={inputClass}
              />
              {addForm.label.trim() && <p className="mt-1 text-[10px] text-slate-500 admin-dark:text-slate-400">Key: {slugifyLabel(addForm.label) || "(invalid)"}</p>}
            </label>
            <label className="block">
              <span className={labelClass}>Platform Icon</span>
              <input
                value={addForm.icon}
                onChange={(e) => setAddForm({ ...addForm, icon: e.target.value })}
                placeholder="Emoji, image URL or SVG path (optional, leave empty for auto)"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-slate-500 admin-dark:text-slate-400">Leave empty to use default brand icon. Supports emoji (🔥), image URL (https://...) or SVG path.</p>
            </label>
            <label className="block">
              <span className={labelClass}>Link / URL *</span>
              <input
                type="url"
                value={addForm.url}
                onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                placeholder="https://facebook.com/medispark"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Status</span>
              <select
                value={addForm.isActive ? "active" : "inactive"}
                onChange={(e) => setAddForm({ ...addForm, isActive: e.target.value === "active" })}
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={addBusy}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {addBusy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddForm({ label: "", icon: "", url: "", isActive: true });
              }}
              className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 admin-dark:border-zinc-700 admin-dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {(links ?? []).map((link, index) => {
          const isEditing = editingKey === link.key;
          const iconPath = link.icon || getSocialPlatformIcon(link.key);
          const isUrlIcon = Boolean(iconPath && (iconPath.startsWith("http") || iconPath.startsWith("data:")));
          const isEmojiIcon = Boolean(iconPath && iconPath.length <= 4 && /\p{Emoji}/u.test(iconPath));
          const busy = busyKey === link.key;
          return (
            <li key={link.key} className={`${cardClass} ${link.isActive ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600/10 text-primary-600 admin-dark:text-primary-400 overflow-hidden">
                  {isUrlIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconPath!} alt="" className="h-6 w-6 rounded object-contain" />
                  ) : isEmojiIcon ? (
                    <span className="text-lg">{iconPath}</span>
                  ) : iconPath ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
                      <path d={iconPath!} />
                    </svg>
                  ) : (
                    link.label.charAt(0)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-extrabold text-[#0b1e3a] admin-dark:text-zinc-100">{link.label}</h3>
                  <p className="truncate text-xs text-slate-500 admin-dark:text-slate-400">key: {link.key} · {link.url || "no URL"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${link.label} up`}
                    onClick={() => moveLink(index, -1)}
                    disabled={index === 0 || !!isEditing}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dbeafe] bg-white text-xs text-zinc-600 transition hover:border-primary-500/50 disabled:opacity-40 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] admin-dark:text-zinc-300"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${link.label} down`}
                    onClick={() => moveLink(index, 1)}
                    disabled={index === (links?.length ?? 0) - 1 || !!isEditing}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dbeafe] bg-white text-xs text-zinc-600 transition hover:border-primary-500/50 disabled:opacity-40 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] admin-dark:text-zinc-300"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={link.isActive}
                    aria-label={`Toggle ${link.label}`}
                    onClick={() => void toggleActive(link.key)}
                    disabled={busy}
                    className={`relative ml-1 inline-flex h-6 w-11 items-center rounded-full transition ${link.isActive ? "bg-primary-600" : "bg-zinc-300 admin-dark:bg-zinc-700"} ${busy ? "opacity-50" : ""}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${link.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {!isEditing ? (
                <>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-lg bg-[#f1f5f9] px-3 py-2 text-xs font-mono text-slate-600 admin-dark:bg-[#0f2547] admin-dark:text-slate-300 truncate">
                      {link.url || <span className="font-sans text-amber-600">No URL — will not appear on website</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${link.isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-zinc-200 text-zinc-500"}`}>
                        {link.isActive ? "Active" : "Inactive"}
                      </span>
                      {link.icon && <span className="truncate text-slate-500 admin-dark:text-slate-400">icon: {link.icon.slice(0, 40)}</span>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(link)}
                      disabled={busy}
                      className="rounded-lg border border-[#dbeafe] px-3 py-1.5 text-xs font-bold text-[#0b1e3a] transition hover:bg-[#f8fbff] disabled:opacity-50 admin-dark:border-[#1e3a65] admin-dark:text-zinc-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteLink(link.key, link.label)}
                      disabled={busy}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50 admin-dark:border-red-900/50 admin-dark:bg-red-950/30 admin-dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-4 admin-dark:border-[#1e3a65] admin-dark:bg-[#0a162e]">
                  <div className="grid gap-3">
                    <label className="block">
                      <span className={labelClass}>Platform Name *</span>
                      <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Platform Icon</span>
                      <input
                        value={editForm.icon}
                        onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                        placeholder="Emoji, URL or SVG path"
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Link / URL</span>
                      <input type="url" value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} placeholder="https://..." className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Status</span>
                      <select
                        value={editForm.isActive ? "active" : "inactive"}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "active" })}
                        className={inputClass}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={busy}
                      className="rounded-xl bg-primary-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      disabled={busy}
                      className="rounded-xl border border-neutral-200 px-5 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 admin-dark:border-zinc-700 admin-dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {notice && (
        <p
          role="status"
          className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 admin-dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-600 admin-dark:text-red-400"}`}
        >
          {notice.text}
        </p>
      )}

      <p className="mt-6 text-xs leading-relaxed text-slate-500 admin-dark:text-slate-400">
        Tip: Reorder with ▲/▼ then click “Save Order”. Toggle Active/Inactive switches live immediately. Add any platform — WhatsApp, TikTok, Discord, etc. — via “+ Add Social Media”.
      </p>
    </section>
  );
}
