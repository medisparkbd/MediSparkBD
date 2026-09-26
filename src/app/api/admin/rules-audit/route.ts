import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { fetchRecentRuleAudit } from "@/lib/site-rules";

export const dynamic = "force-dynamic";

const RULE_PERMS = ["manageSystem", "manageAdmins"] as const;

/** GET /api/admin/rules-audit?limit=200 — recent rule audit trail (admin-only). */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 200);
  const logs = await fetchRecentRuleAudit(Number.isFinite(limit) ? limit : 200);
  return NextResponse.json({ logs }, { headers: { "Cache-Control": "no-store" } });
}
