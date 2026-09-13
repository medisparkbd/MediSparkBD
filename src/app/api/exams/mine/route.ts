import { NextRequest, NextResponse } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import { fetchExams, hasEnrolledExamAccess } from "@/lib/exams-admin";
import { deriveStatus } from "@/lib/public-exams";
import { getFlow4Phase, filterFlow4ExamIds } from "@/lib/flow4-exam-lifecycle";

export const dynamic = "force-dynamic";

/**
 * GET /api/exams/mine — published enrolled-kind exams the logged-in
 * student may take (enrolled in at least one assigned course).
 */
export async function GET(request: NextRequest) {
  const user = await getFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const exams = await fetchExams("enrolled");
  const flow4Ids = await filterFlow4ExamIds(exams.map((e) => e.id));
  const available = [];
  for (const exam of exams) {
    if (exam.status !== "published") continue;
    if (!(await hasEnrolledExamAccess(exam.id, user.uid))) continue;
    const isFlow4 = flow4Ids.has(exam.id);
    // Public lifecycle uses deriveStatus; Flow-4 uses UPCOMING→LIVE→PRACTICE.
    // Do NOT hide Practice exams — they remain visible after End Time.
    let status: string;
    let phase: string | undefined;
    if (isFlow4) {
      phase = getFlow4Phase(exam);
      if (phase === "upcoming") status = "Upcoming";
      else if (phase === "live") status = "Live";
      else if (phase === "practice") status = "Practice";
      else status = "Live";
    } else {
      status = deriveStatus(exam);
      // Non-Flow4 enrolled exams still respect Live window — skip Expired.
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
      isFlow4,
    });
  }

  return NextResponse.json(
    { exams: available },
    { headers: { "Cache-Control": "no-store" } },
  );
}
