import type { Exam } from "@/lib/exams-admin";

/**
 * Shared exam lifecycle — single source of truth for time-based status.
 * Pure + client-safe (no DB). All server code must compute status from the
 * stored Start/End date-time with the server clock — never a frontend-only
 * timer — so refresh / restart / late-open all resolve correctly.
 *
 * Public Live Exam:  Upcoming → Live → Closed (12h visible) → Hidden
 * Public Practice:   always Available (never time-gated)
 * Course Exam:       Draft → Upcoming → Live → Closed (1 day) → Archived
 */

export const PUBLIC_LIVE_CLOSED_VISIBLE_MS = 12 * 60 * 60 * 1000;
export const COURSE_CLOSED_VISIBLE_MS = 24 * 60 * 60 * 1000;

export type PublicLiveState = "draft" | "upcoming" | "live" | "closed" | "hidden" | "practice";
export type CourseState = "draft" | "upcoming" | "live" | "closed" | "archived";

type ExamTime = Pick<Exam, "kind" | "examMode" | "status" | "scheduledAt" | "endsAt">;

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** PUBLIC scope + practice mode = always-available practice exam. */
export function isPublicPracticeExam(exam: Pick<ExamTime, "kind" | "examMode">): boolean {
  if ((exam as { kind?: string }).kind === "enrolled") return false;
  return (exam as { examMode?: string }).examMode === "practice";
}

/** PUBLIC scope + live mode = scheduled live exam with Upcoming/Live/Closed/Hidden. */
export function isPublicLiveExam(exam: Pick<ExamTime, "kind" | "examMode">): boolean {
  if ((exam as { kind?: string }).kind === "enrolled") return false;
  return (exam as { examMode?: string }).examMode !== "practice";
}

export function getPublicLiveState(
  exam: ExamTime,
  nowMs: number = Date.now(),
): PublicLiveState {
  if (exam.status === "draft") return "draft";
  if (isPublicPracticeExam(exam)) return "practice";
  // Stored admin-closed behaves as Closed (never moves to Practice).
  const startMs = toMs(exam.scheduledAt);
  const endMs = toMs(exam.endsAt);
  if (exam.status === "closed") {
    if (endMs !== null && nowMs - endMs > PUBLIC_LIVE_CLOSED_VISIBLE_MS) return "hidden";
    return "closed";
  }
  if (startMs !== null && nowMs < startMs) return "upcoming";
  if (endMs !== null && nowMs >= endMs) {
    if (nowMs - endMs > PUBLIC_LIVE_CLOSED_VISIBLE_MS) return "hidden";
    return "closed";
  }
  return "live";
}

/** True when a Public Live Exam must disappear from the Main Website list (12h after End). */
export function isPublicLiveHidden(exam: ExamTime, nowMs: number = Date.now()): boolean {
  if (!isPublicLiveExam(exam)) return false;
  return getPublicLiveState(exam, nowMs) === "hidden";
}

/** True when a Public Live Exam card stays visible on the website (Upcoming/Live/Closed≤12h). */
export function isPublicLiveVisible(exam: ExamTime, nowMs: number = Date.now()): boolean {
  if (!isPublicLiveExam(exam)) return false;
  const state = getPublicLiveState(exam, nowMs);
  return state === "upcoming" || state === "live" || state === "closed";
}

export function getCourseState(exam: ExamTime, nowMs: number = Date.now()): CourseState {
  if (exam.status === "draft") return "draft";
  const startMs = toMs(exam.scheduledAt);
  const endMs = toMs(exam.endsAt);
  if (exam.status === "closed") {
    // Admin-closed: honor the 1-day Closed → Archived window when End is set.
    if (endMs !== null && nowMs - endMs > COURSE_CLOSED_VISIBLE_MS) return "archived";
    return "closed";
  }
  if (startMs !== null && nowMs < startMs) return "upcoming";
  if (endMs !== null && nowMs >= endMs) {
    if (nowMs - endMs > COURSE_CLOSED_VISIBLE_MS) return "archived";
    return "closed";
  }
  return "live";
}

/** Archived practice attempts must NOT affect official merit/ranking. */
export function isCoursePracticePhase(phase: string | null | undefined): boolean {
  return phase === "archived" || phase === "practice";
}
