import { NextRequest, NextResponse } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import { updateHeartbeat } from "@/lib/exam-taking";

export const dynamic = "force-dynamic";

/**
 * POST /api/exams/[id]/heartbeat — client presence ping during an active exam.
 * Records last_seen; finalizes ONLY when now >= server-side expires_at.
 * Silence / offline / hidden tab NEVER submits.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  const result = await updateHeartbeat(
    id,
    user.uid,
    user.name || user.email || "Student",
  );
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
