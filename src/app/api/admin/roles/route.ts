import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import {
  logAdminAction,
  fetchRoleAssignments,
  saveRoleAssignments,
  fetchRolePermissions,
  saveRolePermissions,
  ROLE_LABELS,
} from "@/lib/administration";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requirePermission(request, "manageAdmins");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [assignments, permissions] = await Promise.all([
    fetchRoleAssignments(),
    fetchRolePermissions(),
  ]);
  return NextResponse.json(
    { assignments, rolePermissions: permissions, roleLabels: ROLE_LABELS },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Bulk-save role assignments and/or the permission matrix.
 * Accepts { assignments: [{ email, role }] } and/or
 * { rolePermissions: { moderator: [...], teacher: [...] } }.
 * Either key may be sent alone: the Moderator/Teacher Roles pages persist
 * only the matrix, while Staff Roles persists both. Keys that are absent
 * are left untouched (never wiped). */
export async function PUT(request: NextRequest) {
  const admin = await requirePermission(request, "manageAdmins");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { assignments?: unknown; rolePermissions?: unknown }
    | null;
  const hasAssignments = body !== null && body.assignments !== undefined;
  const hasMatrix = body !== null && body.rolePermissions !== undefined;
  if (
    !body ||
    (!hasAssignments && !hasMatrix) ||
    (hasAssignments && !Array.isArray(body.assignments)) ||
    (hasMatrix &&
      (typeof body.rolePermissions !== "object" ||
        body.rolePermissions === null))
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  try {
    // Optional permission-matrix update in the same request.
    if (hasMatrix && typeof body.rolePermissions === "object") {
      await saveRolePermissions(
        body.rolePermissions as Record<string, unknown>,
        admin.uid,
      );
      await logAdminAction(admin, "role.permissions.save", "", request);
    }
    const assignments = hasAssignments
      ? await (async () => {
          const saved = await saveRoleAssignments(
            body.assignments as Array<Record<string, unknown>>,
            admin.uid,
          );
          await logAdminAction(admin, "roles.save", `count=${saved.length}`, request);
          return saved;
        })()
      : await fetchRoleAssignments();
    return NextResponse.json({
      assignments,
      rolePermissions: await fetchRolePermissions(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save role assignments.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
