"use client";

import { useCallback, useEffect, useState } from "react";
import { useContentDnd } from "@/components/admin/useContentDnd";

/**
 * ChapterContentOrderManager — manual cross-type ordering of ONE chapter's
 * Classes · Exams · Materials.
 *
 * - One merged list (1. Class, 2. Material, 3. Exam, …) with serial numbers.
 * - Drag handle reorders via Pointer Events (mouse + touch, no dependencies);
 *   ↑ / ↓ buttons cover mobile + keyboard users.
 * - Every change is persisted to the database (sort_order columns) and the
 *   list re-loads from the server, so refresh keeps the same order and
 *   student-facing lists (already ORDER BY sort_order) match automatically.
 * - Reordering writes ONLY sort_order — content data is never modified.
 */

type OrderItem = {
  kind: "class" | "material" | "exam";
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
};

const KIND_META: Record<OrderItem["kind"], { label: string; badge: string }> = {
  class: {
    label: "Class",
    badge: "bg-sky-500/15 text-sky-600 admin-dark:text-sky-400",
  },
  exam: {
    label: "Exam",
    badge: "bg-violet-500/15 text-violet-600 admin-dark:text-violet-400",
  },
  material: {
    label: "Material",
    badge: "bg-emerald-500/15 text-emerald-600 admin-dark:text-emerald-400",
  },
};

function itemKey(item: Pick<OrderItem, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

function sameSequence(a: OrderItem[], b: OrderItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => itemKey(item) === itemKey(b[i]));
}

export default function ChapterContentOrderManager({
  chapterId,
}: {
  chapterId: string;
}) {
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<OrderItem[]>([]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/admin/chapter-order?chapterId=${encodeURIComponent(chapterId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        items?: OrderItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load order.");
      const next = Array.isArray(data.items) ? data.items : [];
      setItems(next);
      setSavedItems(next);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load order.",
      );
      setItems([]);
      setSavedItems([]);
    }
  }, [chapterId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function persist(next: OrderItem[]) {
    // No-op when nothing actually moved.
    if (sameSequence(next, savedItems)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/chapter-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId,
          order: next.map((item) => ({ kind: item.kind, id: item.id })),
        }),
      });
      const data = (await res.json()) as {
        items?: OrderItem[];
        error?: string;
      };
      if (!res.ok) {
        // Stale tab (409) → reload the fresh order so the admin sees reality.
        if (res.status === 409) await load();
        throw new Error(data.error ?? "Failed to save order.");
      }
      const fresh = Array.isArray(data.items) ? data.items : next;
      setItems(fresh);
      setSavedItems(fresh);
    } catch (error) {
      // Revert the optimistic move so the UI never shows an unsaved order.
      setItems(savedItems);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save order.",
      );
    } finally {
      setSaving(false);
    }
  }

  const dnd = useContentDnd<OrderItem>({
    items: items ?? [],
    keyOf: itemKey,
    disabled: saving || items === null,
    onPreview: setItems,
    onCommit: (next) => void persist(next),
  });
  const { dragIndex } = dnd;

  function move(index: number, direction: -1 | 1) {
    if (saving || dragIndex !== null || items === null) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setItems(next);
    void persist(next);
  }

  if (items === null) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 px-4 py-6 admin-dark:border-zinc-700">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        <p className="text-sm font-semibold text-slate-500 admin-dark:text-slate-400">
          Loading content order…
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-500 admin-dark:text-slate-400">
          {items.length === 0
            ? "No classes, exams or materials in this chapter yet."
            : "Drag the handle or use ↑ ↓ — the order saves to the database."}
        </p>
        <span className="ml-auto inline-flex items-center gap-1.5" aria-live="polite">
          {saving ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600/10 px-2.5 py-1 text-[11px] font-bold text-primary-600 admin-dark:text-primary-300">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              Saving…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 admin-dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Saved
            </span>
          )}
        </span>
      </div>

      {loadError ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 admin-dark:text-red-300">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-1 font-bold underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      {saveError ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 admin-dark:text-red-300">
          {saveError}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul ref={dnd.listRef} className="mt-3 space-y-2">
          {items.map((item, index) => {
            const meta = KIND_META[item.kind];
            const isDragging = dragIndex === index;
            const handle = dnd.handleProps(index);
            return (
              <li
                key={itemKey(item)}
                ref={dnd.rowRef(itemKey(item))}
                className={`flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-shadow admin-dark:bg-[#112544] sm:gap-3 ${
                  isDragging
                    ? "z-10 border-primary-500/70 shadow-xl shadow-primary-900/20"
                    : "border-[#dbeafe] shadow-[#0b1e3a]/5 admin-dark:border-[#1e3a65]"
                }`}
                style={isDragging ? { transition: "none" } : undefined}
              >
                {/* Serial number — position in the saved order */}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600/15 text-xs font-extrabold text-primary-600 admin-dark:text-primary-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {/* Drag handle — the only touch-action:none zone */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Drag ${item.title} to reorder`}
                  title="Drag to reorder"
                  onPointerDown={(e) => handle.onPointerDown(e, index)}
                  onPointerMove={handle.onPointerMove}
                  onPointerUp={handle.onPointerUp}
                  onPointerCancel={handle.onPointerCancel}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      move(index, -1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      move(index, 1);
                    }
                  }}
                  className={`flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-base font-black tracking-tighter text-slate-400 transition hover:bg-[#f1f5f9] hover:text-primary-600 active:cursor-grabbing admin-dark:text-slate-500 admin-dark:hover:bg-[#132a4f] admin-dark:hover:text-[#93c5fd] ${
                    saving ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  ⠿
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0b1e3a] admin-dark:text-white">
                    {item.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    {item.subtitle !== meta.label ? (
                      <span className="text-[11px] text-slate-500 admin-dark:text-slate-500">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </span>
                {/* ↑ / ↓ alternative — mobile-friendly + keyboard accessible */}
                <span
                  className="flex shrink-0 gap-1"
                  role="group"
                  aria-label={`Reorder ${item.title}`}
                >
                  <button
                    type="button"
                    disabled={saving || dragIndex !== null || index === 0}
                    onClick={() => move(index, -1)}
                    title="Move up"
                    aria-label={`Move ${item.title} up`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbeafe] bg-white text-sm font-black text-slate-600 transition hover:border-primary-500/60 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-30 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-slate-300"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={
                      saving || dragIndex !== null || index === items.length - 1
                    }
                    onClick={() => move(index, 1)}
                    title="Move down"
                    aria-label={`Move ${item.title} down`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbeafe] bg-white text-sm font-black text-slate-600 transition hover:border-primary-500/60 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-30 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-slate-300"
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {items.length > 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500 admin-dark:text-slate-500">
          Students see the same sequence inside this chapter. New classes,
          exams or materials are added at the end automatically; deleting an
          item keeps the remaining serials continuous.
        </p>
      ) : null}
    </div>
  );
}
