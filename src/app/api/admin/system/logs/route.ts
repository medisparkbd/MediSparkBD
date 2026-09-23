import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/admin";
import { fetchActivityLogs } from "@/lib/administration";

export const dynamic = "force-dynamic";

/** System → Logs — tail of the admin activity log. */
export async function GET(request: NextRequest) {
  const admin = await requireAnyPermission(request, ["manageSystem", "manageAdmins"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const logs = await fetchActivityLogs(Number.isInteger(limitParam) ? limitParam : 100);
  return NextResponse.json(
    { logs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
