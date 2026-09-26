import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { sweepLiveCourseExams } from "@/lib/notification-events";

export const dynamic = "force-dynamic";

/**
 * Admin → Notification Control → live-exam sweeper.
 * Runs the "Exam Is Live Now" check on demand (also runs automatically on
 * student exam views). Each (exam, course) fires at most once via the
 * event ledger, so calling this repeatedly never duplicates.
 */
export async function POST(request: NextRequest) {
  const admin = await requirePermission(request, "manageContent");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const fired = await sweepLiveCourseExams();
  return NextResponse.json({ fired });
}
