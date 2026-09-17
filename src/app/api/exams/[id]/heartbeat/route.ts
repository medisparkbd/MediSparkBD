import { NextRequest, NextResponse } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import { updateHeartbeat } from "@/lib/exam-taking";

export const dynamic = "force-dynamic";

/**
 * POST /api/exams/[id]/heartbeat — client presence ping during an active exam.
 * Refreshes last_seen; auto-finalizes the attempt when the session has gone
 * stale (tab closed / app switched away); reports already-submitted sessions.
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
