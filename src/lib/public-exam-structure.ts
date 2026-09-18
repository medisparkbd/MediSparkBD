// Shared Public Exam information architecture — PURE logic only (no server
// imports) so BOTH the Main Website and the Admin Panel use the SAME
// structure with their own styling:
//
//   Public Exam → Category → [ Live Exam | Practice Exam ] (default: Live)
//
// Live Exam lifecycle (unchanged): Upcoming → Live → Closed → 12 hours after
// closing → Hidden from the Main Website (Admin Panel keeps access).
// Practice Exams stay continuously available while published/active.

import type { ExamCategory } from "@/lib/public-exams";
import {
  getPublicLiveState,
  PUBLIC_LIVE_CLOSED_VISIBLE_MS,
} from "@/lib/exam-lifecycle";

/** A Closed live exam stays visible on the Main Website for exactly 12h. */
export const PUBLIC_CLOSED_VISIBLE_MS = PUBLIC_LIVE_CLOSED_VISIBLE_MS;

export type PublicLivePhase = "upcoming" | "live" | "closed" | "hidden";

export type PhaseInput = {
  /** Display status (e.g. deriveStatus output: Upcoming/Live/Completed/Expired). */
  status: string;
  scheduledAt: string | null;
  endsAt: string | null;
  published?: boolean;
  examMode?: string | null;
  kind?: string | null;
};

/**
 * Live lifecycle phase for a PUBLIC live-mode exam — delegates to the
 * canonical `getPublicLiveState` in `@/lib/exam-lifecycle` (single source
 * of truth): Upcoming → Live → Closed → 12h after closing → Hidden from
 * the Main Website (Admin Panel keeps the exam, nothing is deleted or
 * moved to Practice).
 */
export function getPublicLivePhase(
  exam: PhaseInput,
  nowMs: number = Date.now(),
): PublicLivePhase {
  if (exam.published === false) return "hidden";
  const state = getPublicLiveState(
    {
      // Display status back to stored status: Completed ⟺ admin-closed.
      status:
        exam.status === "Completed"
          ? "closed"
          : exam.status === "Unpublished" || exam.status === "Inactive"
            ? "draft"
            : "published",
      scheduledAt: exam.scheduledAt,
      endsAt: exam.endsAt,
      examMode: exam.examMode === "practice" ? "practice" : "live",
      kind: (exam.kind ?? "public") as "public" | "practice" | "enrolled",
    },
    nowMs,
  );
  if (state === "upcoming") return "upcoming";
  if (state === "live") return "live";
  if (state === "closed") return "closed";
  return "hidden";
}

/** True when the exam must disappear from the Main Website Live Exam list. */
export function isHiddenFromWebsiteLive(
  exam: PhaseInput,
  nowMs: number = Date.now(),
): boolean {
  return getPublicLivePhase(exam, nowMs) === "hidden";
}

/** Static Live vs Practice mode — legacy `kind = "practice"` rows count as practice. */
export function isPracticeMode(
  exam: { examMode?: string | null; kind?: string | null },
): boolean {
  return exam.examMode === "practice" || exam.kind === "practice";
}

export function isLiveMode(
  exam: { examMode?: string | null; kind?: string | null },
): boolean {
  return !isPracticeMode(exam);
}

// ── Category resolution ────────────────────────────────────────────────

/** Resolve a Course Control category (slug/name) to its Public Exam key. */
export function resolvePublicCategoryKey(category: {
  slug?: string | null;
  name?: string | null;
  id?: string | null;
}): ExamCategory | null {
  const token = `${category.slug ?? ""} ${category.name ?? ""} ${category.id ?? ""}`.toLowerCase();
  if (/varsity|universit/.test(token)) return "varsity-admission";
  if (/medical/.test(token)) return "medical-admission";
  if (/ssc/.test(token)) return "ssc-academic";
  if (/hsc/.test(token)) return "hsc-academic";
  return null;
}

// ── Practice subject layer ─────────────────────────────────────────────

export type MedicalPracticeSubjectKey =
  | "bio1"
  | "bio2"
  | "chem1"
  | "chem2"
  | "phy1"
  | "phy2"
  | "english"
  | "gk";

/** The fixed 8 Medical Admission practice subject cards (in order). */
export const MEDICAL_PRACTICE_SUBJECTS: Array<{
  key: MedicalPracticeSubjectKey;
  title: string;
}> = [
  { key: "bio1", title: "Biology 1st Paper" },
  { key: "bio2", title: "Biology 2nd Paper" },
  { key: "chem1", title: "Chemistry 1st Paper" },
  { key: "chem2", title: "Chemistry 2nd Paper" },
  { key: "phy1", title: "Physics 1st Paper" },
  { key: "phy2", title: "Physics 2nd Paper" },
  { key: "english", title: "English" },
  { key: "gk", title: "GK" },
];

/** Bucket for practice exams whose subject matches none of the fixed cards. */
export const OTHER_PRACTICE_SUBJECT_KEY = "other";

export function normalizeSubject(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Map a free-text exam subject onto one of the 8 fixed Medical practice
 * cards. Returns null when it matches nothing (caller buckets it as Other).
 */
export function matchMedicalPracticeSubject(
  subject: unknown,
): MedicalPracticeSubjectKey | null {
  const token = normalizeSubject(subject).replace(/[–—]/g, "-");
  if (!token) return null;
  const has = (...needles: string[]) => needles.some((n) => token.includes(n));
  if (has("general knowledge") || /(^|[^a-z])gk([^a-z]|$)/.test(token)) return "gk";
  if (has("english")) return "english";
  const paper2 = has("2nd", "2nd paper", "paper 2", "paper-2", "zoology", "paper ii");
  const paper1 = has("1st", "1st paper", "paper 1", "paper-1", "botany", "paper i");
  if (has("bio", "zoolog", "botan")) return paper2 && !paper1 ? "bio2" : "bio1";
  if (has("chem")) return paper2 && !paper1 ? "chem2" : "chem1";
  if (has("phy")) return paper2 && !paper1 ? "phy2" : "phy1";
  return null;
}

export function medicalPracticeSubjectTitle(key: string): string {
  if (key === OTHER_PRACTICE_SUBJECT_KEY) return "General";
  return (
    MEDICAL_PRACTICE_SUBJECTS.find((item) => item.key === key)?.title ?? key
  );
}

/** Distinct non-empty subjects in encounter order. */
export function distinctSubjects<T extends { subject: unknown }>(
  exams: T[],
): string[] {
  const seen = new Map<string, string>();
  for (const exam of exams) {
    const raw = String(exam.subject ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!seen.has(key)) seen.set(key, raw);
  }
  return [...seen.values()];
}

/**
 * Whether a category's Practice view uses a subject-card layer:
 * - SSC: never (Biology-only → exams directly).
 * - HSC: subject cards (navigation/filter layer over existing subjects).
 * - Medical: the fixed 8 subject cards.
 * - Varsity: cards only when the existing data already has a meaningful
 *   subject structure (2+ distinct subjects), otherwise exams directly.
 */
export function practiceUsesSubjectCards(
  categoryKey: ExamCategory,
  practiceExams: Array<{ subject: unknown }>,
): boolean {
  if (categoryKey === "ssc-academic") return false;
  if (categoryKey === "hsc-academic") return true;
  if (categoryKey === "medical-admission") return true;
  return distinctSubjects(practiceExams).length >= 2;
}
