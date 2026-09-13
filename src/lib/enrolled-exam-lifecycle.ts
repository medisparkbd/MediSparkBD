// Enrolled Exam lifecycle (Live-to-Practice)
// Pure + server helpers. This file is the canonical definition of the
// enrolled (private/course) exam lifecycle. Public Exam lifecycle stays in deriveStatus().
//
// Lifecycle for ALL enrolled exams (private/course exams):
//   UPCOMING → LIVE → PRACTICE
//   Upcoming: before scheduledAt
//   Live:     scheduledAt ≤ now ≤ endsAt  (no endsAt → stays Live)
//   Practice: now > endsAt
// Transition LIVE→PRACTICE is automatic, server-time based, no deletion.
// PRACTICE preserves question paper; attempts are not ranked.
//
import { query } from "@/lib/mysql";
import type { Exam } from "@/lib/exams-admin";

export type EnrolledExamPhase = "upcoming" | "live" | "practice" | "no-window";

export function getEnrolledExamPhase(exam: Pick<Exam, "scheduledAt" | "endsAt">): EnrolledExamPhase {
  const now = Date.now();
  const start = exam.scheduledAt ? new Date(exam.scheduledAt).getTime() : NaN;
  const end = exam.endsAt ? new Date(exam.endsAt).getTime() : NaN;
  const hasStart = Number.isFinite(start);
  const hasEnd = Number.isFinite(end);
  if (!hasStart && !hasEnd) return "no-window";
  if (hasStart && now < start) return "upcoming";
  if (hasEnd && now > end) return "practice";
  // inside window or no window → live
  return "live";
}

export function enrolledExamPhaseLabel(phase: EnrolledExamPhase): string {
  if (phase === "upcoming") return "Upcoming";
  if (phase === "live") return "Live";
  if (phase === "practice") return "Practice";
  return "Live";
}

// Server-side check whether an exam is an enrolled (private/course) exam.
// Simple check: exams.kind = 'enrolled'.
export async function isEnrolledExam(examId: string): Promise<boolean> {
  const nid = examId?.trim();
  if (!nid) return false;
  try {
    const rows = await query<{ kind: string }[]>(
      `SELECT kind FROM exams WHERE id = ? LIMIT 1`,
      [nid],
    );
    return rows.length > 0 && rows[0].kind === "enrolled";
  } catch {
    return false;
  }
}

// Batch helper for list views — returns ids that are enrolled (private/course) exams.
export async function filterEnrolledExamIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const out = new Set<string>();
  try {
    const ph = ids.map(() => "?").join(",");
    const rows = await query<{ id: string }[]>(
      `SELECT id FROM exams WHERE id IN (${ph}) AND kind = 'enrolled'`,
      ids,
    );
    for (const r of rows) out.add(r.id);
  } catch {
    // empty
  }
  return out;
}

// ── Backward-compat re-exports (Flow-4 names → Enrolled names) ──────────
// Keeps existing callers working during the transition.
export type Flow4Phase = EnrolledExamPhase;
export const getFlow4Phase = getEnrolledExamPhase;
export const flow4PhaseLabel = enrolledExamPhaseLabel;
export const isFlow4Exam = isEnrolledExam;
export const filterFlow4ExamIds = filterEnrolledExamIds;
