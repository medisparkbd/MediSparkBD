import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { exec } from "@/lib/mysql";
import { isValidHomepageSectionKey } from "@/lib/homepage-sections-constants";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const admin = await requirePermission(request, "manageContent");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { key } = await params;

  if (!isValidHomepageSectionKey(key)) {
    return NextResponse.json(
      { error: "Unknown homepage section key." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    isActive?: unknown;
  } | null;

  if (!body || typeof body.isActive !== "boolean") {
    return NextResponse.json(
      { error: "Missing or invalid isActive field." },
      { status: 400 },
    );
  }

  const isActive = body.isActive;

  try {
    await exec(
      `INSERT INTO homepage_sections (section_key, is_active, sort_order, updated_by)
       VALUES (?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), updated_by = VALUES(updated_by)`,
      [key, isActive ? 1 : 0, admin.uid],
    );

    return NextResponse.json({ key, isActive });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update section visibility.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
