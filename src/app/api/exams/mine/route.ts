import { NextRequest, NextResponse } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import { fetchExams, hasEnrolledExamAccess } from "@/lib/exams-admin";
import { getEnrolledExamPhase, filterEnrolledExamIds } from "@/lib/enrolled-exam-lifecycle";

export const dynamic = "force-dynamic";

/**
 * GET /api/exams/mine — published enrolled-kind exams the logged-in
 * student may take (enrolled in at least one assigned course).
 *
 * ALL enrolled (private/course) exams use the lifecycle:
 *   UPCOMING → LIVE → PRACTICE
 * After endsAt, the exam is shown as "Practice" and remains accessible.
 */
export async function GET(request: NextRequest) {
  const user = await getFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const exams = await fetchExams("enrolled");
  const enrolledIds = await filterEnrolledExamIds(exams.map((e) => e.id));
  const available = [];
  for (const exam of exams) {
    if (exam.status !== "published") continue;
    if (!(await hasEnrolledExamAccess(exam.id, user.uid))) continue;
    const isEnrolled = enrolledIds.has(exam.id);
    // ALL enrolled exams use UPCOMING→LIVE→PRACTICE lifecycle.
    // Do NOT hide Practice exams — they remain visible after End Time.
    let status: string;
    let phase: string | undefined;
    if (isEnrolled) {
      phase = getEnrolledExamPhase(exam);
      if (phase === "upcoming") status = "Upcoming";
      else if (phase === "live") status = "Live";
      else if (phase === "practice") status = "Practice";
      else status = "Live";
    } else {
      // Non-enrolled exams: skip Expired/Completed (legacy behavior).
      const { deriveStatus } = await import("@/lib/public-exams");
      status = deriveStatus(exam);
      if (status === "Expired" || status === "Completed") continue;
    }
    available.push({
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      courseType: exam.courseType,
      totalMarks: exam.totalMarks,
      durationMinutes: exam.durationMinutes,
      scheduledAt: exam.scheduledAt,
      endsAt: exam.endsAt,
      status,
      phase,
      isEnrolled,
    });
  }

  return NextResponse.json(
    { exams: available },
    { headers: { "Cache-Control": "no-store" } },
  );
}
