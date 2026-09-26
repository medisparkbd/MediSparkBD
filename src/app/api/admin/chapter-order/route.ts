import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { logAdminAction } from "@/lib/administration";
import {
  getChapterUnifiedItems,
  normalizeOrderPayload,
  saveChapterUnifiedOrder,
} from "@/lib/chapter-content-order";

export const dynamic = "force-dynamic";

/** Unified manual order of one chapter: GET ?chapterId=… → { items }. */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, [
    "manageCourses",
    "manageCourseContent",
  ]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const chapterId = request.nextUrl.searchParams.get("chapterId") ?? "";
  if (!chapterId.trim()) {
    return NextResponse.json({ error: "Missing chapter id." }, { status: 400 });
  }
  try {
    const items = await getChapterUnifiedItems(chapterId);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load content order." },
      { status: 500 },
    );
  }
}

/**
 * Persist the full manual order: { chapterId, order: [{ kind, id }, …] }.
 * Positions 1..N are written to each item's own sort_order column only —
 * no content data is modified.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAnyPermission(request, [
    "manageCourses",
    "manageCourseContent",
  ]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const chapterId =
    typeof body?.chapterId === "string" ? body.chapterId.trim() : "";
  if (!body || !chapterId) {
    return NextResponse.json(
      { error: "Missing chapter id." },
      { status: 400 },
    );
  }
  let order;
  try {
    order = normalizeOrderPayload(body.order);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid order." },
      { status: 400 },
    );
  }
  try {
    const items = await saveChapterUnifiedOrder(chapterId, order);
    await logAdminAction(admin, "chapter-order.save", chapterId, request);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save order.";
    const stale = message.includes("out of date");
    return NextResponse.json({ error: message }, { status: stale ? 409 : 400 });
  }
}
