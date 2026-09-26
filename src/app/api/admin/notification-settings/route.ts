import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { logAdminAction } from "@/lib/administration";
import {
  AUTO_EVENT_DEFS,
  getAutoNotificationSettings,
  saveAutoNotificationSetting,
} from "@/lib/notification-events";

export const dynamic = "force-dynamic";

/**
 * Admin → Notification Control → Automatic section config.
 * GET returns the event definitions merged with stored overrides
 * (toggles + title/message templates). PUT updates one event.
 */
export async function GET(request: NextRequest) {
  const admin = await requirePermission(request, "manageContent");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const settings = await getAutoNotificationSettings();
  return NextResponse.json(
    { events: AUTO_EVENT_DEFS, settings },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: NextRequest) {
  const admin = await requirePermission(request, "manageContent");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    enabled?: unknown;
    title?: unknown;
    message?: unknown;
  } | null;
  if (typeof body?.key !== "string" || !body.key) {
    return NextResponse.json({ error: "Missing event key." }, { status: 400 });
  }
  try {
    const settings = await saveAutoNotificationSetting({
      key: body.key,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
    });
    await logAdminAction(
      admin,
      "notification.auto-settings",
      body.key,
      request,
    );
    return NextResponse.json({ settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save the setting.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
