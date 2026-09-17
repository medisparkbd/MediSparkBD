"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdmin } from "./AdminHold";

export default function SectionToggle({
  sectionKey,
  sectionLabel,
  initialIsActive,
}: {
  sectionKey: string;
  sectionLabel: string;
  initialIsActive: boolean;
}) {
  const isAdmin = useIsAdmin();
  const [isActive, setIsActive] = useState(initialIsActive);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  async function handleToggle() {
    if (saving) return;
    const next = !isActive;
    setIsActive(next);
    setSaving(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      const res = await fetch(`/api/homepage-sections/${sectionKey}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        setIsActive(!next);
      }
    } catch {
      setIsActive(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 admin-dark:text-slate-400">
        {isActive ? "ON" : "OFF"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={`Toggle ${sectionLabel} visibility`}
        onClick={() => void handleToggle()}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          isActive
            ? "bg-primary-600"
            : "bg-zinc-300 admin-dark:bg-zinc-700"
        } ${saving ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            isActive ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
