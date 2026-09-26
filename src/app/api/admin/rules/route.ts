import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import {
  RULE_DOC_CATEGORIES,
  RULE_DOC_SECTIONS,
  RULE_DOC_UPDATED,
} from "@/lib/website-rules-doc";

export const dynamic = "force-dynamic";

// Read-only internal reference. Same admin gate as before —
// requireAnyPermission(["manageSystem","manageAdmins"]) — so only signed-in
// admins with the grant can fetch. No content lives in the client bundle;
// the page loads it through this endpoint with a Bearer token.
const RULE_PERMS = ["manageSystem", "manageAdmins"] as const;

/** GET — full reference doc, optionally filtered (?q=, ?category=). */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, RULE_PERMS);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const category = (sp.get("category") ?? "").trim();
  const sections = RULE_DOC_SECTIONS.filter(
    (s) => !category || s.category === category,
  ).map((s) => ({
    ...s,
    items: q
      ? s.items.filter(
          (i) =>
            i.id.toLowerCase().includes(q) ||
            i.title.toLowerCase().includes(q) ||
            i.text.toLowerCase().includes(q) ||
            i.source.toLowerCase().includes(q),
        )
      : s.items,
  })).filter((s) => s.items.length > 0);
  return NextResponse.json(
    { updated: RULE_DOC_UPDATED, categories: RULE_DOC_CATEGORIES, sections },
    { headers: { "Cache-Control": "no-store" } },
  );
}
