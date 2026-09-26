/**
 * Finance validation regression tests.
 * Run with:  node --test tests/finance-validation.test.ts
 * (Node 22.6+ strips types natively; no test framework dependency.)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FINANCE_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  FINANCE_STATUSES,
  formatBDT,
  isSafeUrl,
  isValidDateOnly,
  normalizeRange,
  validateCostInput,
} from "../src/lib/finance-validation.ts";

const validBody = () => ({
  costDate: "2026-09-26",
  category: "Equipment",
  itemName: "Sony Camera",
  description: "Camera purchased for video production.",
  amount: 85000,
  paidBy: "Siam",
  paymentMethod: "Cash",
  status: "paid",
  receiptUrl: null,
  note: null,
});

describe("finance constants", () => {
  it("covers the required categories", () => {
    for (const c of ["Equipment", "Facebook Boost", "Google Ads", "Printing", "Travel", "Office"]) {
      assert.ok((FINANCE_CATEGORIES as readonly string[]).includes(c), `missing ${c}`);
    }
  });

  it("supports Cash/Bank/Card/Mobile Banking/Other methods", () => {
    assert.deepEqual([...FINANCE_PAYMENT_METHODS], ["Cash", "Bank", "Card", "Mobile Banking", "Other"]);
  });

  it("supports paid/pending/cancelled statuses", () => {
    assert.deepEqual([...FINANCE_STATUSES], ["paid", "pending", "cancelled"]);
  });
});

describe("validateCostInput", () => {
  it("accepts a valid physical-cost body", () => {
    const r = validateCostInput(validBody());
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.amount, 85000);
      assert.equal(r.value.itemName, "Sony Camera");
    }
  });

  it("rejects zero and negative amounts", () => {
    assert.equal(validateCostInput({ ...validBody(), amount: 0 }).ok, false);
    assert.equal(validateCostInput({ ...validBody(), amount: -5 }).ok, false);
    assert.equal(validateCostInput({ ...validBody(), amount: "abc" }).ok, false);
  });

  it("rejects bad dates", () => {
    assert.equal(validateCostInput({ ...validBody(), costDate: "26-09-2026" }).ok, false);
    assert.equal(validateCostInput({ ...validBody(), costDate: "" }).ok, false);
  });

  it("rejects unknown payment methods and statuses", () => {
    assert.equal(validateCostInput({ ...validBody(), paymentMethod: "Crypto" }).ok, false);
    assert.equal(validateCostInput({ ...validBody(), status: "approved" }).ok, false);
  });

  it("ignores mass-assignment fields (id, created_by, deleted_at)", () => {
    const r = validateCostInput({
      ...validBody(),
      id: 999,
      created_by_uid: "attacker",
      created_by_email: "attacker@evil.com",
      deleted_at: "2026-01-01",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(!("id" in r.value));
      assert.ok(!("created_by_uid" in r.value));
      assert.ok(!("deleted_at" in r.value));
    }
  });

  it("rejects javascript: receipt URLs", () => {
    assert.equal(
      validateCostInput({ ...validBody(), receiptUrl: "javascript:alert(1)" }).ok,
      false,
    );
    assert.equal(
      validateCostInput({ ...validBody(), receiptUrl: "https://example.com/r.pdf" }).ok,
      true,
    );
  });

  it("requires item name and paid-by", () => {
    assert.equal(validateCostInput({ ...validBody(), itemName: "  " }).ok, false);
    assert.equal(validateCostInput({ ...validBody(), paidBy: "" }).ok, false);
  });
});

describe("normalizeRange", () => {
  it("keeps valid YYYY-MM-DD bounds", () => {
    assert.deepEqual(normalizeRange("2026-09-01", "2026-09-30"), {
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("drops SQL-injection style input", () => {
    assert.deepEqual(normalizeRange("2026-09-01' OR '1'='1", null), {
      from: null,
      to: null,
    });
  });
});

describe("helpers", () => {
  it("isValidDateOnly rejects non-dates", () => {
    assert.equal(isValidDateOnly("2026-09-26"), true);
    assert.equal(isValidDateOnly("not-a-date"), false);
    assert.equal(isValidDateOnly(null), false);
  });

  it("isSafeUrl allows https and relative paths only", () => {
    assert.equal(isSafeUrl("https://example.com/a.pdf"), true);
    assert.equal(isSafeUrl("/receipts/a.pdf"), true);
    assert.equal(isSafeUrl("javascript:alert(1)"), false);
    assert.equal(isSafeUrl("//evil.com/x"), false);
  });

  it("formatBDT prefixes with ৳", () => {
    assert.ok(formatBDT(85000).startsWith("৳"));
    assert.ok(formatBDT(85000).includes("85,000"));
  });
});
