"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAuth, onIdTokenChanged, type User } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";

export type AdminGate = {
  ready: boolean;
  denied: boolean;
  token: string | null;
  /** Auth headers for admin API calls. */
  headers: Record<string, string>;
  /** Current admin's role ("admin", "moderator", "teacher" …) — null while loading. */
  role: string | null;
  /** Permission categories granted by the admin's role. */
  permissions: string[];
};

/** Shared admin access gate — verifies the signed-in user is an admin. */
type GateResult = {
  uid: string;
  isAdmin: boolean;
  role: string;
  permissions: string[];
  token: string | null;
};

// Cross-instance gate cache: every useAdminGate hook (shell + page + widgets)
// shares one in-flight request and one cached result, so client-side
// navigation never refires /api/admin and never flashes a loader.
const GATE_CACHE_TTL_MS = 5 * 60_000;
const GATE_SESSION_PREFIX = "medispark:admin-gate:";

let memoryGate: { uid: string; result: GateResult; at: number } | null = null;
let gateInFlight: { uid: string; promise: Promise<GateResult | null> } | null =
  null;

function readSessionGate(uid: string): GateResult | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(GATE_SESSION_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      at?: number;
      role?: string;
      permissions?: string[];
    };
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > GATE_CACHE_TTL_MS) return null;
    return {
      uid,
      isAdmin: true,
      role: typeof parsed.role === "string" ? parsed.role : "admin",
      permissions: Array.isArray(parsed.permissions)
        ? parsed.permissions.map(String)
        : [],
      token: null,
    };
  } catch {
    return null;
  }
}

function readCachedGate(
  uid: string,
): (GateResult & { fresh: boolean; at: number }) | null {
  if (memoryGate && memoryGate.uid === uid) {
    const fresh = Date.now() - memoryGate.at < GATE_CACHE_TTL_MS;
    if (fresh || Date.now() - memoryGate.at < GATE_CACHE_TTL_MS * 6) {
      return { ...memoryGate.result, fresh, at: memoryGate.at };
    }
    memoryGate = null;
  }
  const session = readSessionGate(uid);
  if (session) {
    memoryGate = { uid, result: session, at: Date.now() };
    return { ...session, fresh: true, at: Date.now() };
  }
  return null;
}

function applyGateResult(uid: string, result: GateResult): void {
  memoryGate = { uid, result, at: Date.now() };
  try {
    if (typeof window !== "undefined" && window.sessionStorage && result.isAdmin) {
      window.sessionStorage.setItem(
        GATE_SESSION_PREFIX + uid,
        JSON.stringify({
          at: Date.now(),
          role: result.role,
          permissions: result.permissions,
        }),
      );
    }
  } catch {
    // Cache is best-effort (private mode etc.).
  }
}

async function fetchSharedGate(user: User): Promise<GateResult | null> {
  const uid = user.uid;
  if (gateInFlight && gateInFlight.uid === uid) return gateInFlight.promise;
  const promise = (async (): Promise<GateResult | null> => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | { isAdmin?: boolean; role?: string; permissions?: string[] }
        | null;
      if (response.ok && data?.isAdmin) {
        return {
          uid,
          isAdmin: true,
          role: data.role ?? "admin",
          permissions: Array.isArray(data.permissions)
            ? data.permissions.map(String)
            : [],
          token: idToken,
        };
      }
      return { uid, isAdmin: false, role: "admin", permissions: [], token: idToken };
    } catch {
      return null;
    }
  })();
  gateInFlight = { uid, promise };
  try {
    return await promise;
  } finally {
    if (gateInFlight?.promise === promise) gateInFlight = null;
  }
}

export function useAdminGate(): AdminGate {
  const { user, authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(() =>
    user ? readCachedGate(user.uid)?.isAdmin ?? null : null,
  );
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(() =>
    user ? (readCachedGate(user.uid)?.role ?? null) : null,
  );
  const [permissions, setPermissions] = useState<string[]>(() =>
    user ? (readCachedGate(user.uid)?.permissions ?? []) : [],
  );

  // Admin check — shared across every hook instance: one network request per
  // user, cached for 5 minutes so page-to-page navigation is instant.
  const lastUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading || !user) return;
    const uid = user.uid;
    // New user (login switch): drop stale state, resolve below.
    if (lastUidRef.current !== null && lastUidRef.current !== uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAdmin(null);
      setRole(null);
      setPermissions([]);
      setToken(null);
    }
    lastUidRef.current = uid;
    let cancelled = false;

    const applyResult = (result: GateResult) => {
      if (result.uid !== uid) return;
      applyGateResult(uid, result);
      if (result.token) {
        setToken((prev) => (prev === result.token ? prev : result.token));
      }
      if (result.isAdmin) {
        setIsAdmin(true);
        setRole(result.role);
        setPermissions(result.permissions);
      } else {
        setIsAdmin(false);
      }
    };

    const cached = readCachedGate(uid);
    if (cached) {
      // Paint instantly from cache.
      setIsAdmin(cached.isAdmin);
      if (cached.isAdmin) {
        setRole(cached.role);
        setPermissions(cached.permissions);
      }
      if (!cached.fresh) {
        // Stale cache: revalidate silently in the background.
        void fetchSharedGate(user).then((result) => {
          if (!cancelled && result) applyResult(result);
        });
      } else if (cached.token) {
        setToken((prev) => (prev === cached.token ? prev : cached.token));
      } else {
        // Fresh role cache but no token yet — mint one silently.
        void user
          .getIdToken()
          .then((t) => {
            if (!cancelled) setToken((prev) => (prev === t ? prev : t));
          })
          .catch(() => undefined);
        // ...and ALWAYS re-check role/permissions server-side so a
        // full-page refresh picks up recent permission changes
        // (grant/revoke, logout/login, another device) instead of trusting
        // the 5-minute session cache blindly. Instant paint is preserved;
        // the UI self-corrects when the fresh result lands. Concurrent
        // hook instances share one in-flight request (see fetchSharedGate).
        if (cached.isAdmin) {
          void fetchSharedGate(user).then((result) => {
            if (!cancelled && result) applyResult(result);
          });
        }
      }
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const result = await fetchSharedGate(user);
      if (cancelled) return;
      if (result) {
        applyResult(result);
      } else {
        // No cache and the check failed — deny like before (next mount retries).
        setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Signed out: drop any previous user's gate state so a stale `ready`
  // can never leak into the logged-out UI.
  useEffect(() => {
    if (!authLoading && !user) {
      lastUidRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAdmin(null);
      setRole(null);
      setPermissions([]);
      setToken(null);
      try {
        if (typeof window !== "undefined" && window.sessionStorage) {
          const keys: string[] = [];
          for (let i = 0; i < window.sessionStorage.length; i += 1) {
            const key = window.sessionStorage.key(i);
            if (key && key.startsWith(GATE_SESSION_PREFIX)) keys.push(key);
          }
          for (const key of keys) window.sessionStorage.removeItem(key);
        }
      } catch {
        // Best-effort.
      }
    }
  }, [authLoading, user]);

  // Keep the token fresh: Firebase rotates ID tokens hourly. A transient
  // refresh failure must NOT clear the stored token — falling back to no
  // Authorization would turn every later admin request (including Refresh)
  // into a 401. Keep the previous token; the next rotation retries.
  useEffect(() => {
    if (!user) return;
    return onIdTokenChanged(getAuth(), (refreshed) => {
      if (refreshed?.uid !== user.uid) return;
      void refreshed
        ?.getIdToken()
        .then((t) => setToken((prev) => (prev === t ? prev : t)))
        .catch(() => undefined);
    });
  }, [user]);

  const denied =
    (!authLoading && !user) || (authLoading === false && isAdmin === false);
  const ready = !authLoading && isAdmin === true;

  const headers = useMemo<Record<string, string>>(
    () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
    [token],
  );

  return {
    ready,
    denied,
    token,
    headers,
    role,
    permissions,
  };
}

/** Client-side convenience: does the current admin's role grant a permission? */
export function hasAdminPermission(
  gate: Pick<AdminGate, "role" | "permissions">,
  permission: string,
): boolean {
  // Admin always has all permissions.
  if (gate.role === "admin") return true;
  return gate.permissions.includes(permission);
}

/**
 * Public Exam Control entry permission — the SAME pair enforced by the
 * backend (requireAnyPermission(["manageExams", "managePublicExam"])) and
 * the ADMIN_CONTROL_PERMISSIONS maps. Category → Exam → Exam Management
 * pages must inherit this parent grant: a manager holding either permission
 * keeps full allowed management access inside the control.
 */
export const PUBLIC_EXAM_PERMISSIONS = [
  "managePublicExam",
  "manageExams",
] as const;

export function hasPublicExamAccess(
  gate: Pick<AdminGate, "role" | "permissions">,
): boolean {
  if (gate.role === "admin") return true;
  return PUBLIC_EXAM_PERMISSIONS.some((perm) =>
    gate.permissions.includes(perm),
  );
}

/**
 * Admin Panel control → required permissions (client-safe mirror of
 * src/lib/administration.ts ADMIN_CONTROL_PERMISSIONS).
 *
 * Subtree inheritance: Category → Exam → Exam Management pages resolve to
 * their parent control via longest-prefix match (see
 * resolveControlPermissions), so a manager holding the parent grant
 * (e.g. managePublicExam) is never denied inside the subtree.
 */
export const ADMIN_CONTROL_PERMISSIONS: Record<string, readonly string[]> = {
  "/admin/website-information": ["manageContent"],
  "/admin/enrollment-control": ["manageStudents", "manageCourses"],
  "/admin/home-control": ["manageContent"],
  "/admin/course-control": ["manageCourses"],
  "/admin/course-content-control": ["manageCourseContent", "manageCourses"],
  "/admin/material-pdf": ["manageCourses", "manageCourseContent", "manageExams"],
  "/admin/public-exam-control": ["managePublicExam", "manageExams"],
  // Canonical Public Exam Control subtree (hub + Category → Exam pages).
  "/admin/public-exam": ["managePublicExam", "manageExams"],
  // Exam Management page (/admin/exams/[id]/manage) belongs to the Public
  // Exam Control flow — inherit the same parent grant.
  "/admin/exams": ["managePublicExam", "manageExams"],
  // Enrolled-exam lists are course-assigned; course managers keep read
  // access here (backend writes still enforce their own permission pairs).
  "/admin/exams/enrolled": ["managePublicExam", "manageExams", "manageCourses"],
  "/admin/qa-control": ["manageQa", "manageContent"],
  "/admin/dashboard-control": ["manageSystem", "manageContent"],
  "/admin/student-control": ["manageStudents"],
  "/admin/result-control": ["manageResults", "manageExams"],
  "/admin/notification-control": ["manageContent", "manageSystem"],
  "/admin/admin-center": ["manageAdmins"],
};

/**
 * Longest-prefix match of a pathname against ADMIN_CONTROL_PERMISSIONS.
 * Returns the matched control href, or null when the path is outside every
 * controlled subtree (unknown routes stay accessible).
 */
export function resolveControlPermissions(pathname: string): {
  control: string;
  required: readonly string[];
} | null {
  let matched: string | null = null;
  for (const href of Object.keys(ADMIN_CONTROL_PERMISSIONS)) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!matched || href.length > matched.length) matched = href;
    }
  }
  if (!matched) return null;
  return { control: matched, required: ADMIN_CONTROL_PERMISSIONS[matched] };
}

/**
 * Client-side control access check with subtree inheritance.
 * Admin always passes; /admin (home) is open to every signed-in admin;
 * unknown routes stay accessible; everything else requires at least one of
 * the resolved control permissions.
 */
export function hasControlAccess(
  role: string | null | undefined,
  permissions: string[],
  href: string,
): boolean {
  if (role === "admin") return true;
  if (href === "/admin") return true;
  const resolved = resolveControlPermissions(href);
  if (!resolved) return true;
  return resolved.required.some((perm) => permissions.includes(perm));
}

export type Notice = { kind: "success" | "error"; text: string };

export const noticeClass = (notice: Notice): string =>
  `mt-6 rounded-xl border px-4 py-3 text-sm font-semibold ${
    notice.kind === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 admin-dark:border-emerald-500/20 admin-dark:bg-emerald-500/10 admin-dark:text-emerald-400"
      : "border-red-500/30 bg-red-500/10 text-red-600 admin-dark:text-red-400"
  }`;

// Unified Premium Navy Smart Card — white surface, subtle blue border/shadow, navy icons
export const cardClass =
  "rounded-2xl border border-[#dbeafe] bg-white shadow-sm shadow-[#1e3a78]/5 transition-all duration-200 hover:border-[#bfdbfe] hover:shadow-md hover:shadow-[#1e3a78]/10 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] admin-dark:shadow-black/20 admin-dark:hover:border-[#2f5aa0]";

export const inputClass =
  "w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f6bce] focus:ring-2 focus:ring-[#2f6bce]/15 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-[#e0e8f8] admin-dark:placeholder:text-slate-500 admin-dark:focus:border-[#3b82f6]";

export const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-500 admin-dark:text-[#8da0c0]";

export const buttonPrimaryClass =
  "rounded-xl bg-[#1a3a78] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0b1e3a]/20 transition hover:bg-[#123060] hover:shadow-lg hover:shadow-[#0b1e3a]/25 active:scale-[0.98] active:bg-[#0e244a] disabled:cursor-not-allowed disabled:opacity-50 admin-dark:bg-[#234e9f] admin-dark:hover:bg-[#2f65c8] admin-dark:shadow-black/30";

export const buttonSecondaryClass =
  "rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 text-xs font-bold text-[#1a3a78] transition hover:border-[#93c5fd] hover:bg-[#dbeafe] hover:text-[#123060] active:bg-[#bfdbfe] admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-[#93c5fd] admin-dark:hover:border-[#2f5aa0] admin-dark:hover:bg-[#132a4f]";

export const buttonDangerClass =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-[#fecaca] bg-[#fef2f2] text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 admin-dark:border-[#7f1d1d]/50 admin-dark:bg-red-500/10 admin-dark:text-red-400 admin-dark:hover:bg-red-500/20";

export const badgeClass =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide";

export const badgeSuccessClass =
  "border-emerald-200 bg-emerald-50 text-emerald-700 admin-dark:border-emerald-500/20 admin-dark:bg-emerald-500/10 admin-dark:text-emerald-400";

export const badgeWarningClass =
  "border-amber-200 bg-amber-50 text-amber-700 admin-dark:border-amber-500/20 admin-dark:bg-amber-500/10 admin-dark:text-amber-400";

export const badgeInfoClass =
  "border-[#bfdbfe] bg-[#eff6ff] text-[#1a3a78] admin-dark:border-[#1e3a65] admin-dark:bg-[#1e3a65]/50 admin-dark:text-[#93c5fd]";

export const badgeDangerClass =
  "border-red-200 bg-red-50 text-red-700 admin-dark:border-red-500/20 admin-dark:bg-red-500/10 admin-dark:text-red-400";

export const tableHeaderClass =
  "bg-[#f8fbff] text-[#1a3a78] admin-dark:bg-[#0f2547] admin-dark:text-[#93c5fd]";

export const tableRowClass =
  "border-b border-[#eef4ff] transition hover:bg-[#f8fbff] admin-dark:border-[#1e3a65]/50 admin-dark:hover:bg-[#132a4f]/50";
