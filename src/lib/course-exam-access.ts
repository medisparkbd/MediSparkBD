import { fetchExams, hasEnrolledExamAccess } from "@/lib/exams-admin";
import { query } from "@/lib/mysql";

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
 * ALL enrolled (private/course) exams follow the lifecycle:
 *   UPCOMING → LIVE → PRACTICE
 * after endsAt, the exam is still accessible as Practice for enrolled students.
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

  // ── Enrolled (Course) Exam Lifecycle ────────────────────────────────
  // Draft → Upcoming → Live → Closed (1 day) → Archived (practice).
  // Closed blocks new official attempts; Archived allows Practice Again
  // (practice attempts never affect official merit/ranking).
  const { getEnrolledExamPhase, isEnrolledExam, isEnrolledPracticePhase } = await import("@/lib/enrolled-exam-lifecycle");
  const enrolled = await isEnrolledExam(normalizedId);

  if (enrolled) {
    const phase = getEnrolledExamPhase(exam);
    if (phase === "upcoming") {
      return { allowed: false, reason: "This exam has not started yet." };
    }
    if (phase === "closed") {
      return { allowed: false, reason: "This exam has ended." };
    }
    if (phase === "no-window") {
      // No schedule set — treat as always Live (legacy) — fall through.
    } else if (isEnrolledPracticePhase(phase)) {
      // Archived practice: require enrollment but allow entry regardless of
      // prior Live attempt. Practice does NOT block on maxAttempts.
      const isEnrolled = await hasEnrolledExamAccess(normalizedId, cleanUid);
      if (!isEnrolled) {
        return {
          allowed: false,
          reason: "You are not enrolled in the course for this exam.",
        };
      }
      return { allowed: true };
    }
    // phase === "live" — fall through to Live gates below (published +
    // enrollment + attempt-limit for live).
  }

  // Course-enrollment gate — delegates to the shared helper which checks
  // exam_courses JOIN enrollments (active/completed). This is the single
  // definition of "enrolled" used by getExamForTaking and /api/exams/mine.
  const isEnrolled = await hasEnrolledExamAccess(normalizedId, cleanUid);
  if (!isEnrolled) {
    return {
      allowed: false,
      reason: "You are not enrolled in the course for this exam.",
    };
  }

  // Attempt limits — same guard as the engine's startExamAttempt.
  // For Practice phase this block is never reached (returned above).
  // For Live phase, enforce maxAttempts counting only live attempts
  // so a prior practice does not block a Live entry, and vice versa.
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
      // For enrolled exams, count only live attempts so a prior practice
      // does not block a Live entry, and vice versa.
      let count = 0;
      try {
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
