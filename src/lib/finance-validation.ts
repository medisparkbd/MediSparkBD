/**
 * Finance validation & constants — dependency-free (no database, no Firebase,
 * no Next.js imports) so it can be safely imported from server code, client
 * components, and `node --test` regression tests. Do NOT add server-only
 * imports here.
 */

export const FINANCE_CATEGORIES = [
  "Equipment",
  "Marketing",
  "Facebook Boost",
  "Google Ads",
  "Printing",
  "Travel",
  "Office",
  "Software",
  "Internet",
  "Content Production",
  "Maintenance",
  "Other",
] as const;

export const FINANCE_PAYMENT_METHODS = [
  "Cash",
  "Bank",
  "Card",
  "Mobile Banking",
  "Other",
] as const;

export const FINANCE_STATUSES = ["paid", "pending", "cancelled"] as const;

export type FinanceCostStatus = (typeof FINANCE_STATUSES)[number];

export type CostInput = {
  costDate: string;
  category: string;
  itemName: string;
  description?: string | null;
  amount: number;
  paidBy: string;
  paymentMethod: string;
  status: FinanceCostStatus;
  receiptUrl?: string | null;
  note?: string | null;
};

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function isSafeUrl(value: string): boolean {
  if (value.length === 0 || value.length > 512) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Strict whitelist validation for manual-cost bodies. Unknown client fields
 * (id, created_by, deleted_at, …) are ignored — never written.
 */
export function validateCostInput(body: unknown):
  | { ok: true; value: CostInput }
  | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isValidDateOnly(b.costDate)) {
    return { ok: false, error: "Invalid date (expected YYYY-MM-DD)." };
  }
  const category = typeof b.category === "string" ? b.category.trim() : "";
  if (category.length < 2 || category.length > 64) {
    return { ok: false, error: "Category must be 2–64 characters." };
  }
  const itemName = typeof b.itemName === "string" ? b.itemName.trim() : "";
  if (itemName.length < 1 || itemName.length > 255) {
    return { ok: false, error: "Item / purpose is required (max 255 characters)." };
  }
  const description =
    b.description === null || b.description === undefined
      ? null
      : String(b.description).slice(0, 2000) || null;
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  const paidBy = typeof b.paidBy === "string" ? b.paidBy.trim() : "";
  if (paidBy.length < 1 || paidBy.length > 191) {
    return { ok: false, error: "Paid By is required." };
  }
  const paymentMethod =
    typeof b.paymentMethod === "string" ? b.paymentMethod.trim() : "";
  if (
    !(FINANCE_PAYMENT_METHODS as readonly string[]).includes(paymentMethod) &&
    paymentMethod !== ""
  ) {
    return { ok: false, error: "Invalid payment method." };
  }
  const status = typeof b.status === "string" ? b.status : "paid";
  if (!(FINANCE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const receiptRaw =
    b.receiptUrl === null || b.receiptUrl === undefined
      ? null
      : String(b.receiptUrl).trim() || null;
  if (receiptRaw && !isSafeUrl(receiptRaw)) {
    return { ok: false, error: "Invalid receipt URL." };
  }
  const note =
    b.note === null || b.note === undefined
      ? null
      : String(b.note).slice(0, 2000) || null;
  return {
    ok: true,
    value: {
      costDate: b.costDate as string,
      category,
      itemName,
      description,
      amount: Math.round(amount * 100) / 100,
      paidBy,
      paymentMethod: paymentMethod || "Cash",
      status: status as FinanceCostStatus,
      receiptUrl: receiptRaw,
      note,
    },
  };
}

export function normalizeRange(
  from: string | null,
  to: string | null,
): { from: string | null; to: string | null } {
  const clean = (v: string | null) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  return { from: clean(from), to: clean(to) };
}

export function formatBDT(amount: number): string {
  const n = Number(amount) || 0;
  return `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
