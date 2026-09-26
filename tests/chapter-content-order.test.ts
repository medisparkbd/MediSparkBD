/**
 * Unified chapter content ordering — pure-function regression tests.
 * Run with:  node --test tests/chapter-content-order.test.ts
 * (Node 22.6+ strips types natively; no test framework dependency.)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeAndSortUnified,
  normalizeOrderPayload,
} from "../src/lib/chapter-content-order.ts";

describe("mergeAndSortUnified", () => {
  it("keeps a cross-type manual sequence (Class → Material → Exam → Class → Material)", () => {
    const merged = mergeAndSortUnified([
      { kind: "exam", id: "e1", title: "Exam", subtitle: "Exam", sortOrder: 3 },
      { kind: "class", id: "c1", title: "Class 1", subtitle: "Class", sortOrder: 1 },
      { kind: "material", id: "5", title: "Material 2", subtitle: "PDF", sortOrder: 5 },
      { kind: "material", id: "2", title: "Material 1", subtitle: "PDF", sortOrder: 2 },
      { kind: "class", id: "c2", title: "Class 2", subtitle: "Class", sortOrder: 4 },
    ]);
    // Serial = position in the merged list.
    assert.deepEqual(
      merged.map((m) => `${m.kind}:${m.id}`),
      ["class:c1", "material:2", "exam:e1", "class:c2", "material:5"],
    );
  });

  it("sorts legacy unordered items (sort_order <= 0) after ordered ones, deterministically", () => {
    const first = mergeAndSortUnified([
      { kind: "material", id: "9", title: "M", subtitle: "PDF", sortOrder: 0 },
      { kind: "class", id: "c1", title: "C", subtitle: "Class", sortOrder: 1 },
      { kind: "exam", id: "e1", title: "E", subtitle: "Exam", sortOrder: 0 },
    ]);
    const second = mergeAndSortUnified([
      { kind: "exam", id: "e1", title: "E", subtitle: "Exam", sortOrder: 0 },
      { kind: "class", id: "c1", title: "C", subtitle: "Class", sortOrder: 1 },
      { kind: "material", id: "9", title: "M", subtitle: "PDF", sortOrder: 0 },
    ]);
    assert.equal(first[0]?.id, "c1");
    // Same set in different input order → identical output (refresh-stable).
    assert.deepEqual(
      first.map((m) => `${m.kind}:${m.id}`),
      second.map((m) => `${m.kind}:${m.id}`),
    );
  });

  it("never mutates content fields — only ordering is derived", () => {
    const merged = mergeAndSortUnified([
      { kind: "class", id: "c1", title: "Keep Me", subtitle: "Class", sortOrder: 2 },
      { kind: "class", id: "c2", title: "Keep Me Too", subtitle: "Class", sortOrder: 1 },
    ]);
    assert.equal(merged[0]?.title, "Keep Me Too");
    assert.equal(merged[1]?.title, "Keep Me");
  });
});

describe("normalizeOrderPayload", () => {
  it("accepts a valid cross-type order list", () => {
    const order = normalizeOrderPayload([
      { kind: "class", id: "c1" },
      { kind: "material", id: 7 },
      { kind: "exam", id: "e1" },
    ]);
    assert.deepEqual(order, [
      { kind: "class", id: "c1" },
      { kind: "material", id: "7" },
      { kind: "exam", id: "e1" },
    ]);
  });

  it("rejects unknown kinds, empty ids and non-lists", () => {
    assert.throws(() => normalizeOrderPayload([{ kind: "quiz", id: "q1" }]), /Invalid order entry/);
    assert.throws(() => normalizeOrderPayload([{ kind: "class", id: "  " }]), /Invalid order entry/);
    assert.throws(() => normalizeOrderPayload("nope"), /expected a list/);
  });
});
