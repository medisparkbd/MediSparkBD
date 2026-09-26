import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { logAdminAction } from "@/lib/administration";
import {
  fetchRuleAudit,
  fetchRuleVersions,
  fetchSiteRuleByRuleId,
  setRuleArchived,
  updateSiteRule,
} from "@/lib/site-rules";

export const dynamic = "force-dynamic";

const RULE_PERMS = ["manageSystem", "manageAdmins"] as const;

function denied() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function ruleIdFrom(request: NextRequest, params: { ruleId?: string }): string {
  const raw = params.ruleId ?? request.nextUrl.searchParams.get("ruleId") ?? "";
  return decodeURIComponent(raw).trim().toUpperCase();
}

/** GET /api/admin/rules/[ruleId]?include=versions,audit — detail + history */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return denied();
  const ruleId = ruleIdFrom(request, await params);
  if (!ruleId) return NextResponse.json({ error: "Rule ID is required." }, { status: 400 });
  const rule = await fetchSiteRuleByRuleId(ruleId);
  if (!rule) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  const include = (request.nextUrl.searchParams.get("include") ?? "").split(",");
  const versions = include.includes("versions") ? await fetchRuleVersions(ruleId) : undefined;
  const audit = include.includes("audit") ? await fetchRuleAudit(ruleId) : undefined;
  return NextResponse.json({ rule, versions, audit }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT /api/admin/rules/[ruleId] — edit (validates, versions, audits) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return denied();
  const ruleId = ruleIdFrom(request, await params);
  if (!ruleId) return NextResponse.json({ error: "Rule ID is required." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  try {
    const rule = await updateSiteRule(ruleId, body, { email: admin.email ?? null, uid: admin.uid });
    await logAdminAction(admin, "site-rules.update", `rule=${ruleId}`, request);
    return NextResponse.json({ rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update the rule.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** PATCH /api/admin/rules/[ruleId] — { action: "archive" | "restore" } */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return denied();
  const ruleId = ruleIdFrom(request, await params);
  if (!ruleId) return NextResponse.json({ error: "Rule ID is required." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action === "restore" ? "restore" : body?.action === "archive" ? "archive" : null;
  if (!action) return NextResponse.json({ error: "Action must be archive or restore." }, { status: 400 });
  try {
    const rule = await setRuleArchived(ruleId, action === "archive", {
      email: admin.email ?? null,
      uid: admin.uid,
    });
    await logAdminAction(admin, `site-rules.${action}`, `rule=${ruleId}`, request);
    return NextResponse.json({ rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update the rule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
