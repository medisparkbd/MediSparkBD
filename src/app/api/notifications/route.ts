import { NextRequest, NextResponse } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import {
  fetchStudentNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/content-admin";

export const dynamic = "force-dynamic";

/**
 * Notifications for the logged-in student — active broadcasts ("all"),
 * enrolled-only notifications and ones targeted at this student.
 * Each item carries its persisted read state (`isRead`); `unreadCount`
 * drives the header indicator. Targeting/delivery logic is unchanged.
 *
 * GET ?count=1 → { unreadCount } only (lightweight header-indicator poll).
 */
export async function GET(request: NextRequest) {
  const user = await getFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (request.nextUrl.searchParams.get("count") === "1") {
    const unreadCount = await fetchUnreadNotificationCount(user.uid);
    return NextResponse.json(
      { unreadCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const notifications = await fetchStudentNotifications(user.uid);
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Persist read state (database-backed, survives refresh/devices):
 * POST { id } → mark one notification read (only when visible to the student).
 * POST { all: true } → mark every visible notification read.
 */
export async function POST(request: NextRequest) {
  const user = await getFirebaseUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    all?: unknown;
  } | null;
  if (body?.all === true) {
    await markAllNotificationsRead(user.uid);
    const unreadCount = await fetchUnreadNotificationCount(user.uid);
    return NextResponse.json({ ok: true, unreadCount });
  }
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Missing notification id." }, { status: 400 });
  }
  // Only a notification actually targeted at this student may be marked —
  // never another audience's item, never an inactive one.
  const visible = await fetchStudentNotifications(user.uid);
  if (!visible.some((item) => item.id === id)) {
    return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  }
  await markNotificationRead(id, user.uid);
  const unreadCount = await fetchUnreadNotificationCount(user.uid);
  return NextResponse.json({ ok: true, unreadCount });
}
