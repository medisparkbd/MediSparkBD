"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export type ControlCourse = {
  slug: string;
  name: string;
  category: string;
  kind: "free" | "paid";
  fee: number;
  pendingCount: number;
  totalApplications: number;
};

/** Custom event fired after an enrollment is accepted/rejected so every
 *  pending indicator across the hierarchy refreshes immediately. */
export const ENROLLMENT_CHANGED_EVENT = "medispark:enrollment-changed";

export function notifyEnrollmentChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENROLLMENT_CHANGED_EVENT));
  }
}

/** Live course list + per-course pending application counts (MySQL).
 *  Pass categoryId to get ONLY that Course Control category's courses.
 *
 *  Shared across hook instances: concurrent mounts reuse one in-flight
 *  request and results are cached 30s, so the home page + enrollment pages
 *  together fire a single summary request instead of one each. Background
 *  polls never flip `loading` (no skeleton flash) and pause when the tab
 *  is hidden. */
const SUMMARY_TTL_MS = 30_000;
type SummaryCacheEntry = { courses: ControlCourse[]; at: number };
const summaryCache = new Map<string, SummaryCacheEntry>();
const summaryInFlight = new Map<string, Promise<ControlCourse[] | null>>();

async function fetchSummary(
  token: string,
  categoryId: string,
): Promise<ControlCourse[] | null> {
  const key = categoryId;
  const ongoing = summaryInFlight.get(key);
  if (ongoing) return ongoing;
  const promise = (async (): Promise<ControlCourse[] | null> => {
    try {
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
      const res = await fetch(`/api/admin/enrollment-control/summary${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { courses?: ControlCourse[] };
      const courses = Array.isArray(data.courses) ? data.courses : [];
      summaryCache.set(key, { courses, at: Date.now() });
      return courses;
    } catch {
      return null;
    }
  })();
  summaryInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (summaryInFlight.get(key) === promise) summaryInFlight.delete(key);
  }
}

export function useControlCourses(categoryId = "") {
  const { user, authLoading } = useAuth();
  const [courses, setCourses] = useState<ControlCourse[] | null>(() => {
    const cached = summaryCache.get(categoryId);
    return cached && Date.now() - cached.at < SUMMARY_TTL_MS
      ? cached.courses
      : null;
  });
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(() => {
    const cached = summaryCache.get(categoryId);
    return !(cached && Date.now() - cached.at < SUMMARY_TTL_MS);
  });

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      const cached = summaryCache.get(categoryId);
      if (cached && Date.now() - cached.at < SUMMARY_TTL_MS) {
        setCourses(cached.courses);
        setError(false);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const token = await user.getIdToken();
        const fresh = await fetchSummary(token, categoryId);
        if (fresh === null) {
          // Keep stale data on transient failure; error only when empty.
          setCourses((prev) => {
            if (prev === null) setError(true);
            return prev;
          });
        } else {
          setCourses(fresh);
          setError(false);
        }
      } catch {
        setCourses((prev) => {
          if (prev === null) setError(true);
          return prev;
        });
      } finally {
        setLoading(false);
      }
    },
    [user, categoryId],
  );

  // Refresh every 30s so a new application raises its badge automatically,
  // plus immediately after any accept/reject via the shared event.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
    const interval = setInterval(() => {
      // No work while the tab is hidden — refresh on return instead.
      if (typeof document !== "undefined" && document.hidden) return;
      void load(true);
    }, 30_000);
    const onChanged = () => void load(true);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) void load(true);
    };
    window.addEventListener(ENROLLMENT_CHANGED_EVENT, onChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener(ENROLLMENT_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, load]);

  return { courses, error, loading, authLoading, reload: load };
}

/** Course card with a course-specific pending-applications badge. */
export function ControlCourseCard({
  course,
  kind,
}: {
  course: ControlCourse;
  kind: "free" | "paid";
}) {
  return (
    <Link
      href={`/admin/enrollment-control/course/${encodeURIComponent(course.slug)}?kind=${kind}`}
      className="group flex min-h-[84px] items-center gap-3 rounded-2xl border border-[#dbeafe] bg-white shadow-sm shadow-[#0b1e3a]/5 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] p-4 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-0.5 hover:border-primary-600/60 hover:shadow-primary-900/30 sm:p-5"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600/10 text-xl"
      >
        {kind === "paid" ? "💳" : "🆓"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-[#0b1e3a] transition group-hover:text-[#1a3a78] admin-dark:text-white admin-dark:group-hover:text-[#93c5fd] sm:text-base">
          {course.name}
        </p>
        <p className="truncate text-[11px] text-slate-500 admin-dark:text-slate-400">
          {[course.category, kind === "paid" && course.fee > 0 ? `৳${course.fee}` : "Free"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {course.pendingCount > 0 ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
          </span>
          {course.pendingCount} Pending
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/15 px-2.5 py-1 text-xs font-bold text-blue-400">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_2px_rgba(96,165,250,0.6)]" />
          </span>
          No Pending
        </span>
      )}
    </Link>
  );
}

/** Live aggregated pending counts — sum of every course's pendingCount.
 *  Used by the parent levels (Free/Paid enrollment entries + Admin Home) so
 *  the whole hierarchy glows whenever any higher level has pending work. */
export function useEnrollmentPendingTotals() {
  const { courses, loading } = useControlCourses();
  const freePending = (courses ?? [])
    .filter((course) => course.kind === "free")
    .reduce((sum, course) => sum + course.pendingCount, 0);
  const paidPending = (courses ?? [])
    .filter((course) => course.kind === "paid")
    .reduce((sum, course) => sum + course.pendingCount, 0);
  return {
    freePending,
    paidPending,
    totalPending: freePending + paidPending,
    loading,
  };
}

/** Small glowing "Pending" indicator badge for a parent-level card.
 *  Renders nothing when there are no pending applications. */
export function PendingIndicator({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`absolute flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 shadow-[0_0_10px_2px_rgba(251,191,36,0.35)] ${className}`}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      {count} Pending
    </span>
  );
}
