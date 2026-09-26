import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { fetchFinanceAudit } from "@/lib/finance";

export const dynamic = "force-dynamic";

/** GET /api/finance/audit — admin only. Full modification trail. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 200, 1),
    500,
  );
  const entries = await fetchFinanceAudit(limit);
  return NextResponse.json({ entries });
}
