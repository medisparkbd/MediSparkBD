import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/mysql";
import { logAdminAction } from "@/lib/administration";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/accounts/resign
 * Allows the currently logged-in Admin to voluntarily resign from the Admin role.
 * Only affects the current user's own account — cannot target other users.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = admin.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Cannot identify your account email." }, { status: 400 });
  }

  try {
    // Check if this is the last active admin
    const rows = await query<{ active: number }[]>(
      `SELECT COUNT(*) AS active FROM admins WHERE is_active = 1 AND role = 'admin'`,
    );
    const activeCount = rows[0]?.active ?? 0;
    if (activeCount <= 1) {
      return NextResponse.json(
        { error: "Cannot resign — you are the last active Admin. Transfer the Admin role to another user first." },
        { status: 400 },
      );
    }

    // Remove the current user's admin role — set to moderator as a safe fallback
    // (a full DELETE would lock out the account entirely; demoting to moderator
    // keeps the account active while removing Admin privileges)
    await query(
      `UPDATE admins SET role = 'moderator' WHERE LOWER(email) = ? AND role = 'admin'`,
      [email],
    );

    // Also update the admin_roles table if it exists
    try {
      await query(
        `UPDATE admin_roles SET role = 'moderator' WHERE LOWER(email) = ? AND role = 'admin'`,
        [email],
      );
    } catch {
      // admin_roles table may not exist — ignore
    }

    await logAdminAction(admin, "admin.resign", `email=${email}`, request);

    return NextResponse.json({ ok: true, message: "Admin role removed. You are now a Moderator." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resign.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
