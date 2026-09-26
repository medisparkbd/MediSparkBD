import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { fetchEnrollmentsAdmin } from "@/lib/enrollments-admin";
import { fetchCatalogCourse } from "@/lib/courses-admin";

export const dynamic = "force-dynamic";

/**
 * Admin → Notification Control → Enrolled Students helper.
 * GET ?courseId=<slug> returns the course plus its actively enrolled
 * students (uid, name, email) — the exact manual-send target list.
 * No enrollment data is modified.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, [
    "manageContent",
    "manageStudents",
    "manageCourses",
  ]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const courseId = request.nextUrl.searchParams.get("courseId")?.trim() ?? "";
  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId." }, { status: 400 });
  }
  const course = await fetchCatalogCourse(courseId).catch(() => null);
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }
  const enrollments = await fetchEnrollmentsAdmin({
    courseId,
    status: "active",
  });
  return NextResponse.json(
    {
      course: {
        slug: course.slug,
        name: course.name,
        category: course.category,
        status: course.status,
      },
      students: enrollments.map((enrollment) => ({
        uid: enrollment.studentUid,
        name: enrollment.studentName,
        email: enrollment.studentEmail,
        studentId: enrollment.studentId,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
