import { NextRequest } from "next/server";
import { getFirebaseUser } from "@/lib/auth-api";
import { query, isMysqlConfigured } from "@/lib/mysql";
import { resolveAdminPermissions, type AdminPermission } from "@/lib/administration";
import type { DecodedIdToken } from "firebase-admin/auth";

export type AdminAccount = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

/**
 * Checks whether the given Firebase UID is an authorized admin.
 * Admin accounts are stored in the `admins` table — see
 * src/sql/logo-admin-migration.sql. Writes to website settings are
 * rejected unless the caller resolves to an admin here.
 *
 * Falls back to matching by verified email so accounts keep their access
 * even when the underlying Firebase project (and therefore UID) changes.
 */
export async function isAdminUid(
  uid: string | null,
  email?: string | null,
): Promise<boolean> {
  if (!isMysqlConfigured) return false;

  // Single round-trip: match by uid OR verified email in one query instead
  // of two sequential lookups.
  const hasUid = typeof uid === "string" && uid.length > 0;
  const cleanEmail = typeof email === "string" && email.length > 0 ? email : null;
  if (!hasUid && !cleanEmail) return false;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (hasUid) {
    conditions.push("uid = ?");
    params.push(uid);
  }
  if (cleanEmail) {
    conditions.push("LOWER(email) = LOWER(?)");
    params.push(cleanEmail);
  }
  try {
    // Inactive admins are no longer authorized — see Admin Management.
    const rows = await query<{ uid: string }[]>(
      `SELECT uid FROM admins WHERE is_active = 1 AND (${conditions.join(" OR ")}) LIMIT 1`,
      params,
    );
    if (rows.length > 0) return true;
    // No active match — still check plain lookup? No: inactive must stay
    // denied. Only fall through to the legacy (pre-migration) lookup on
    // query failure below.
    return false;
  } catch {
    // Migration (src/sql/admins-management-migration.sql) may not be
    // applied yet — fall back to plain lookup so nobody gets locked out.
    try {
      const rows = await query<{ uid: string }[]>(
        `SELECT uid FROM admins WHERE ${conditions.join(" OR ")} LIMIT 1`,
        params,
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }
}

export async function fetchAdminAccount(
  uid: string,
): Promise<AdminAccount | null> {
  if (!isMysqlConfigured) return null;
  try {
    const rows = await query<
      { uid: string; email: string | null; display_name: string | null }[]
    >("SELECT uid, email, display_name FROM admins WHERE uid = ? LIMIT 1", [
      uid,
    ]);
    const row = rows[0];
    if (!row) return null;
    return {
      uid: row.uid,
      email: row.email,
      displayName: row.display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the caller is an authenticated, authorized admin.
 * Returns the decoded token on success, null otherwise.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<DecodedIdToken | null> {
  const user = await getFirebaseUser(request);
  if (!user) return null;
  // Email fallback keeps access working even when the underlying Firebase
  // project (and therefore UID) changes. Only verified emails are trusted.
  const email = user.email_verified === true ? (user.email ?? null) : null;
  const authorized = await isAdminUid(user.uid, email);
  return authorized ? user : null;
}

/**
 * Role-based gate: like requireAdmin, but additionally enforces that the
 * admin's role grants the requested permission. Returns null when the
 * caller is not an admin or lacks the permission.
 */
export async function requirePermission(
  request: NextRequest,
  permission: AdminPermission,
): Promise<DecodedIdToken | null> {
  const user = await getFirebaseUser(request);
  if (!user) return null;
  const email = user.email_verified === true ? (user.email ?? null) : null;
  const [authorized, { role, permissions }] = await Promise.all([
    isAdminUid(user.uid, email),
    resolveAdminPermissions(user.email),
  ]);
  if (!authorized) return null;
  // Admin always passes; other roles must have the specific permission.
  if (role === "admin") return user;
  if (permissions.includes(permission)) return user;
  return null;
}

/**
 * Flexible gate: succeeds if the admin has ANY of the listed permissions.
 * Admin always passes. Used for Teacher-scoped controls where either
 * the granular or the legacy broad permission should grant access.
 */
export async function requireAnyPermission(
  request: NextRequest,
  permissions: readonly AdminPermission[],
): Promise<DecodedIdToken | null> {
  const user = await getFirebaseUser(request);
  if (!user) return null;
  const email = user.email_verified === true ? (user.email ?? null) : null;
  const [authorized, resolved] = await Promise.all([
    isAdminUid(user.uid, email),
    resolveAdminPermissions(user.email),
  ]);
  if (!authorized) return null;
  // Admin always passes.
  if (resolved.role === "admin") return user;
  // Other roles need at least one matching permission.
  if (permissions.some((p) => resolved.permissions.includes(p))) return user;
  return null;
}