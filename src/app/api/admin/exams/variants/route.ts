import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { variantCoverage } from "@/lib/exam-variants";

export const dynamic = "force-dynamic";

/** GET ?examId=... — variant coverage per version/set (admin only). */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageExams", "managePublicExam"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const examId = (request.nextUrl.searchParams.get("examId") ?? "").trim();
  if (!examId) {
    return NextResponse.json({ error: "Missing exam id." }, { status: 400 });
  }
  const data = await variantCoverage(examId);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
