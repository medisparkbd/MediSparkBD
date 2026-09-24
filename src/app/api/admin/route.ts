import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, fetchAdminAccount } from "@/lib/admin";
import { recordAdminLogin, resolveAdminPermissions } from "@/lib/administration";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
  // Account + role lookups are independent — run concurrently. The login
  // audit write is fire-and-forget so it never delays the gate response.
  // Pass UID for fail-closed resolution and UID→email fallback (verified email mismatch).
  const [account, resolved] = await Promise.all([
    fetchAdminAccount(user.uid),
    resolveAdminPermissions(user.email, user.uid),
  ]);
  const email = account?.email ?? user.email ?? null;
  // If the stored account email differs from the token email (e.g. Firebase
  // project changed, UID re-linked), prefer the account email for the role
  // lookup so explicit role assignments keep applying.
  const { role, permissions } =
    account?.email && account.email.toLowerCase() !== (user.email ?? "").toLowerCase()
      ? await resolveAdminPermissions(account.email, user.uid)
      : resolved;
  void recordAdminLogin({ uid: user.uid, email }).catch(() => undefined);
  return NextResponse.json({
    isAdmin: true,
    admin: {
      uid: user.uid,
      email,
      displayName: account?.displayName ?? user.displayName ?? null,
    },
    role,
    permissions,
  });
}