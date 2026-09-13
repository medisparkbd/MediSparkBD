// Flow 4 — Exam Batch lifecycle (Live-to-Practice)
// Pure + server helpers. This file is the canonical definition of the
// Flow-4 exam lifecycle. Public Exam lifecycle stays in deriveStatus().
//
// Lifecycle for Flow-4 enrolled exams (Exam Batch):
//   UPCOMING → LIVE → PRACTICE
//   Upcoming: before scheduledAt
//   Live:     scheduledAt ≤ now ≤ endsAt  (no endsAt → stays Live)
//   Practice: now > endsAt
// Transition LIVE→PRACTICE is automatic, server-time based, no deletion.
// PRACTICE preserves question paper; attempts are not ranked.
//
import { query } from "@/lib/mysql";
import type { Exam } from "@/lib/exams-admin";

export type Flow4Phase = "upcoming" | "live" | "practice" | "no-window";

export function getFlow4Phase(exam: Pick<Exam, "scheduledAt" | "endsAt">): Flow4Phase {
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

export function flow4PhaseLabel(phase: Flow4Phase): string {
  if (phase === "upcoming") return "Upcoming";
  if (phase === "live") return "Live";
  if (phase === "practice") return "Practice";
  return "Live";
}

// Server-side check whether an exam belongs to a Flow-4 course.
// Uses exam_courses OR chapter→subject→course chain against catalog_courses.content_layout.
export async function isFlow4Exam(examId: string): Promise<boolean> {
  const nid = examId?.trim();
  if (!nid) return false;
  try {
    // Direct course assignment via exam_courses
    const direct = await query<{ layout: string }[]>(
      `SELECT c.content_layout AS layout FROM exam_courses ec
        JOIN catalog_courses c ON c.slug = ec.course_id
       WHERE ec.exam_id = ? AND c.content_layout = 'flow-4' LIMIT 1`,
      [nid],
    );
    if (direct.length > 0) return true;
    // Chapter-scoped course exam (exam.chapter_id → course_chapters → assignments)
    const viaChapter = await query<{ layout: string }[]>(
      `SELECT c.content_layout AS layout FROM exams ex
        JOIN course_chapters ch ON ch.id = ex.chapter_id
        JOIN course_subject_assignments a ON a.subject_id = ch.subject_id
        JOIN catalog_courses c ON c.slug = a.course_slug
       WHERE ex.id = ? AND c.content_layout = 'flow-4' LIMIT 1`,
      [nid],
    );
    if (viaChapter.length > 0) return true;
    // Direct chapter with course_slug on chapter itself
    const viaDirectChapter = await query<{ layout: string }[]>(
      `SELECT c.content_layout AS layout FROM exams ex
        JOIN course_chapters ch ON ch.id = ex.chapter_id
        JOIN catalog_courses c ON c.slug = ch.course_slug
       WHERE ex.id = ? AND c.content_layout = 'flow-4'
         AND COALESCE(ch.subject_id,'') = '' LIMIT 1`,
      [nid],
    );
    return viaDirectChapter.length > 0;
  } catch {
    return false;
  }
}

// Batch helper for list views — returns ids that are Flow-4.
export async function filterFlow4ExamIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const out = new Set<string>();
  try {
    const ph = ids.map(() => "?").join(",");
    const rows = await query<{ exam_id: string }[]>(
      `SELECT DISTINCT ec.exam_id AS exam_id FROM exam_courses ec
        JOIN catalog_courses c ON c.slug = ec.course_id
       WHERE ec.exam_id IN (${ph}) AND c.content_layout = 'flow-4'`,
      ids,
    );
    for (const r of rows) out.add(r.exam_id);
    const chapRows = await query<{ id: string }[]>(
      `SELECT ex.id AS id FROM exams ex
        JOIN course_chapters ch ON ch.id = ex.chapter_id
        JOIN course_subject_assignments a ON a.subject_id = ch.subject_id
        JOIN catalog_courses c ON c.slug = a.course_slug
       WHERE ex.id IN (${ph}) AND c.content_layout = 'flow-4'`,
      ids,
    );
    for (const r of chapRows) out.add(r.id);
    const directChap = await query<{ id: string }[]>(
      `SELECT ex.id AS id FROM exams ex
        JOIN course_chapters ch ON ch.id = ex.chapter_id
        JOIN catalog_courses c ON c.slug = ch.course_slug
       WHERE ex.id IN (${ph}) AND c.content_layout = 'flow-4' AND COALESCE(ch.subject_id,'')=''`,
      ids,
    );
    for (const r of directChap) out.add(r.id);
  } catch {
    // empty
  }
  return out;
}
