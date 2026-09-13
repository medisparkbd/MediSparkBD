import { fetchExams, hasEnrolledExamAccess } from "@/lib/exams-admin";
import { query } from "@/lib/mysql";
import { deriveStatus } from "@/lib/public-exams";

/**
 * Course (enrolled) exam access — thin wrapper over the shared exam engine.
 *
 * MASTER PROMPT §50 — "DO NOT build separate exam engines" rule:
 * There is a SINGLE engine (`getExamForTaking` / `fetchExams` +
 * `hasEnrolledExamAccess`) and TWO distinct access services that guard it.
 * This file is the COURSE-ENROLLED path. It reuses `fetchExams` as the
 * single source of truth for exam rows and `hasEnrolledExamAccess` for the
 * canonical course-enrollment check (exam_courses JOIN enrollments).
 *
 * Distinct validation path from `checkPublicExamAccess`:
 *  - requires authentication (uid is mandatory)
 *  - requires active/completed enrollment in at least one assigned course
 *  - then enforces the same published/live and attempt-limit guards
 *
 * @param examId - Exam id (e.g. "enrolled-physics-ch01-01")
 * @param uid - Firebase uid of the student (required for enrolled exams)
 */
export async function checkCourseExamAccess(
  examId: string,
  uid: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const normalizedId = examId?.trim();
  if (!normalizedId) {
    return { allowed: false, reason: "Invalid exam id." };
  }

  // Authenticated check — enrolled exams cannot be viewed or started anonymously.
  if (!uid || !uid.trim()) {
    return { allowed: false, reason: "You must be signed in to access this exam." };
  }
  const cleanUid = uid.trim();

  // Reuse the common engine as the single source of truth for exam rows.
  const exams = await fetchExams();
  const exam = exams.find((e) => e.id === normalizedId);

  if (!exam) {
    return { allowed: false, reason: "Exam not found." };
  }

  // Although this service is intended for enrolled-kind exams, it still
  // defensively handles any kind by applying the same published/live gates.
  if (exam.status !== "published") {
    const reason =
      exam.status === "closed"
        ? "This exam is closed."
        : "This exam is not published yet.";
    return { allowed: false, reason };
  }

  // ── Flow 4 Exam Batch — LIVE → PRACTICE lifecycle ───────────────
  // Public Exam keeps deriveStatus() unchanged. Flow-4 enrolled exams use
  // UPCOMING → LIVE → PRACTICE based on server time (getFlow4Phase).
  // After End Time, the exam remains visible for Practice but Live
  // leaderboard is frozen.
  let isFlow4 = false;
  try {
    const { isFlow4Exam } = await import("@/lib/flow4-exam-lifecycle");
    isFlow4 = await isFlow4Exam(normalizedId);
  } catch {
    isFlow4 = false;
  }

  if (isFlow4) {
    const { getFlow4Phase } = await import("@/lib/flow4-exam-lifecycle");
    const phase = getFlow4Phase(exam);
    if (phase === "upcoming") {
      return { allowed: false, reason: "This exam has not started yet." };
    }
    if (phase === "no-window") {
      // No schedule set — treat as always Live (legacy) — fall through.
    } else if (phase === "practice") {
      // Practice after Live ends: require enrollment but allow entry
      // regardless of prior Live attempt. Practice does NOT block on
      // maxAttempts — spec §6: "enrolled students can still open and attempt
      // it as a Practice Exam. The same question paper remains available."
      const enrolled = await hasEnrolledExamAccess(normalizedId, cleanUid);
      if (!enrolled) {
        return {
          allowed: false,
          reason: "You are not enrolled in the course for this exam.",
        };
      }
      // Strict one-live-attempt check does NOT apply to practice.
      // Practice can be retaken according to course-exam rules — do not
      // enforce maxAttempts here; startExamAttempt handles practice bypass.
      return { allowed: true };
    }
    // phase === "live" — fall through to Live gates below (published +
    // enrollment + attempt-limit for live).
  } else {
    // Non-Flow4 course exams — keep existing deriveStatus lifecycle (Live
    // only within window; Expired remains ended). This preserves Flows 1-3
    // and Public Exam behavior exactly.
    const status = deriveStatus(exam);
    if (status !== "Live") {
      if (status === "Upcoming") {
        return { allowed: false, reason: "This exam has not started yet." };
      }
      return { allowed: false, reason: "This exam has ended." };
    }
  }

  // Course-enrollment gate — delegates to the shared helper which checks
  // exam_courses JOIN enrollments (active/completed). This is the single
  // definition of "enrolled" used by getExamForTaking and /api/exams/mine.
  const enrolled = await hasEnrolledExamAccess(normalizedId, cleanUid);
  if (!enrolled) {
    return {
      allowed: false,
      reason: "You are not enrolled in the course for this exam.",
    };
  }

  // Attempt limits — same guard as the engine's startExamAttempt.
  // For Flow-4 Practice this block is never reached (returned above).
  // For Flow-4 Live and non-Flow4 exams, enforce maxAttempts.
  try {
    const settingsRows = await query<
      { max_attempts: number | string | null }[]
    >(`SELECT max_attempts FROM exam_settings WHERE id = 'active' LIMIT 1`);
    const raw = settingsRows[0]?.max_attempts;
    const maxAttempts =
      raw !== null && raw !== undefined ? Number(raw) : null;
    if (
      maxAttempts !== null &&
      Number.isFinite(maxAttempts) &&
      maxAttempts > 0
    ) {
      // For Flow-4 Live, count only live attempts so a prior practice does
      // not block a Live entry, and vice versa. For non-Flow4, count all.
      let count = 0;
      if (isFlow4) {
        try {
          // Count live attempts only when checking Live access.
          const liveRows = await query<{ n: number }[]>(
            `SELECT COUNT(*) AS n FROM exam_results WHERE exam_id = ? AND student_uid = ? AND (attempt_type = 'live' OR attempt_type IS NULL)`,
            [normalizedId, cleanUid],
          );
          count = liveRows[0]?.n ?? 0;
        } catch {
          const fallback = await query<{ n: number }[]>(
            `SELECT COUNT(*) AS n FROM exam_results WHERE exam_id = ? AND student_uid = ?`,
            [normalizedId, cleanUid],
          );
          count = fallback[0]?.n ?? 0;
        }
      } else {
        const countRows = await query<{ n: number }[]>(
          `SELECT COUNT(*) AS n FROM exam_results WHERE exam_id = ? AND student_uid = ?`,
          [normalizedId, cleanUid],
        );
        count = countRows[0]?.n ?? 0;
      }
      if (count >= maxAttempts) {
        return {
          allowed: false,
          reason: `Maximum attempts (${maxAttempts}) reached for this exam.`,
        };
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Maximum attempts")
    ) {
      throw error;
    }
    // Fail open for attempt-limit DB errors — enrollment/published/live
    // checks above remain enforced.
  }

  return { allowed: true };
}
