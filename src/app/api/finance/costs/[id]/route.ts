import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/administration";
import {
  fetchCostById,
  softDeleteManualCost,
  updateManualCost,
  validateCostInput,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

function idFrom(request: NextRequest): number | null {
  const parts = new URL(request.url).pathname.split("/");
  const id = Number(parts[parts.length - 1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** PATCH /api/finance/costs/[id] — admin only. Whitelisted fields only. */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = idFrom(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  }
  const existing = await fetchCostById(id);
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = validateCostInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  // created_by / ids can never be changed — validateCostInput strips them,
  // and updateManualCost only writes the whitelisted columns.
  const updated = await updateManualCost(
    id,
    parsed.value,
    { uid: admin.uid, email: admin.email ?? null },
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Failed to update the record." },
      { status: 500 },
    );
  }
  await logAdminAction(
    { uid: admin.uid, email: admin.email },
    "finance.update",
    `#${id} ${existing.itemName} ৳${existing.amount} → ৳${updated.amount}`,
    request,
  );
  return NextResponse.json({ cost: updated });
}

/** DELETE /api/finance/costs/[id] — admin only, SOFT delete. */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = idFrom(request);
  if (!id) {
    return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  }
  const existing = await fetchCostById(id);
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }
  const ok = await softDeleteManualCost(id, {
    uid: admin.uid,
    email: admin.email ?? null,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to delete the record." },
      { status: 500 },
    );
  }
  await logAdminAction(
    { uid: admin.uid, email: admin.email },
    "finance.delete",
    `#${id} ${existing.itemName} soft-deleted`,
    request,
  );
  return NextResponse.json({ message: "Record moved to history." });
}
