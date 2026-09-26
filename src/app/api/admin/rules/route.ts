import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { logAdminAction } from "@/lib/administration";
import {
  RULE_CATEGORIES,
  RULE_PRIORITIES,
  RULE_STATUSES,
  createSiteRule,
  fetchSiteRules,
  nextRuleId,
  seedSiteRules,
} from "@/lib/site-rules";

export const dynamic = "force-dynamic";

// Canonical gate for Internal Rules: system operators + admin managers.
// Teacher (no manageSystem/manageAdmins) is denied; non-admins get 401/403
// without any data. UI hiding is NOT the enforcement — this gate is.
const RULE_PERMS = ["manageSystem", "manageAdmins"] as const;

function denied(status: 401 | 403) {
  return NextResponse.json({ error: "Unauthorized." }, { status });
}

/** GET — searchable, filterable rule list. Query: q, category, priority, status, origin, sort, order, limit */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return denied(401);
  const sp = request.nextUrl.searchParams;
  if (sp.get("nextId")) {
    const category = String(sp.get("category") ?? "");
    if (!(RULE_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ error: "A valid category is required." }, { status: 400 });
    }
    const ruleId = await nextRuleId(category as (typeof RULE_CATEGORIES)[number]);
    return NextResponse.json({ ruleId }, { headers: { "Cache-Control": "no-store" } });
  }
  const rules = await fetchSiteRules({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    priority: sp.get("priority") ?? undefined,
    status: sp.get("status") ?? undefined,
    origin: sp.get("origin") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    order: sp.get("order") === "asc" ? "asc" : "desc",
    limit: sp.get("limit") ? Number(sp.get("limit")) : 200,
  });
  return NextResponse.json(
    { rules, meta: { priorities: RULE_PRIORITIES, statuses: RULE_STATUSES, categories: RULE_CATEGORIES } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST — create a rule. Body: { ruleId?, category, title, description, priority, status, sourceRef?, referenceNote?, autoId?: boolean } */
export async function POST(request: NextRequest) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return denied(401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  try {
    if (body.seed === true) {
      const result = await seedSiteRules(admin.email ?? admin.uid);
      await logAdminAction(admin, "site-rules.seed", `inserted=${result.inserted}/${result.total}`, request);
      const rules = await fetchSiteRules({ limit: 500 });
      return NextResponse.json({ rules, seeded: result });
    }
    let payload: Record<string, unknown> = { ...body };
    if (body.autoId === true || !body.ruleId) {
      const category = String(body.category ?? "");
      if (!(RULE_CATEGORIES as readonly string[]).includes(category)) {
        return NextResponse.json({ error: "A valid category is required." }, { status: 400 });
      }
      payload.ruleId = await nextRuleId(category as (typeof RULE_CATEGORIES)[number]);
    }
    const rule = await createSiteRule(payload, { email: admin.email ?? null, uid: admin.uid }, "existing");
    await logAdminAction(admin, "site-rules.create", `rule=${rule.ruleId}`, request);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create the rule.";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
