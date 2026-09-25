import { NextRequest, NextResponse } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import { fetchStudentReview } from "@/lib/reviews-store";

export const dynamic = "force-dynamic";

/** The signed-in student's own review (if any) — for edit-own flows. */
export async function GET(request: NextRequest) {
  const user = await getFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ review: null }, { status: 200 });
  }
  const review = await fetchStudentReview(user.uid);
  return NextResponse.json({ review });
}
