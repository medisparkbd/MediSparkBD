/**
 * MCQ PDF pagination regression tests — fill behaviour + height estimates.
 * Run with:  node --test tests/mcq-pagination.test.ts
 * (Same convention as tests/mcq-answer-key.test.ts: Node strips types
 * natively; no test framework dependency.)
 *
 * Guarantees:
 *  - estimateQuestionHeight matches the preview render metrics (11px type,
 *    real line-heights) instead of the old ~1.5x generous constants
 *  - pages fill to actual capacity (full pages >= 70% fill, no early breaks
 *    leaving half-empty pages while questions remain)
 *  - every page-break decision is logged with available/used/remaining/next
 *  - a single oversize block still gets its own page (never dropped)
 *  - empty input yields one empty page (preview invariant)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  paginateQuestions,
  paginateQuestionsDebug,
  estimateQuestionHeight,
  estimateAnswerBoxHeight,
  columnBudgetFor,
} from "../src/components/admin/MaterialPdf/pagination.ts";

function mcq(i, qLen = 60, optLen = 12, topic = "") {
  return {
    id: `q-${i}`,
    qNumber: i + 1,
    question: "Q".repeat(qLen),
    options: ["A".repeat(optLen), "B".repeat(optLen), "C".repeat(optLen), "D".repeat(optLen)],
    answer: "A",
    needsReview: false,
    issues: [],
    image: null,
    isStandaloneImage: false,
    topic: topic || undefined,
  };
}

describe("estimateQuestionHeight matches render metrics", () => {
  it("short question estimates near its true DOM height, not 1.5x", () => {
    // 1-line stem (11px * 1.35 * 1.1 ≈ 16.3) + 4 one-line options
    // (4 * 11 * 1.35 + gaps 6 + mt 6) + block extras 20 ≈ 108px.
    const h = estimateQuestionHeight(mcq(0, 40, 10));
    assert.ok(h > 90 && h < 130, `expected ~108px, got ${h}`);
  });

  it("longer questions estimate proportionally more (no fixed per-page count)", () => {
    const shortH = estimateQuestionHeight(mcq(0, 40, 10));
    const longH = estimateQuestionHeight(mcq(1, 200, 40));
    assert.ok(longH > shortH * 1.5, `long (${longH}) should exceed short (${shortH}) by 1.5x+`);
  });

  it("answer-box height grows only when rows wrap (~17 items/row)", () => {
    const one = estimateAnswerBoxHeight(5);
    const full = estimateAnswerBoxHeight(17);
    const wrapped = estimateAnswerBoxHeight(18);
    assert.equal(one, full);
    assert.ok(wrapped > full, `wrapped (${wrapped}) should exceed single-row (${full})`);
  });

  it("column budget accounts title + answer box instead of fixed 740", () => {
    const noTitle = columnBudgetFor(10, false);
    const withTitle = columnBudgetFor(10, true);
    assert.ok(noTitle > 800, `budget (${noTitle}) should exceed old fixed 740`);
    assert.ok(noTitle - withTitle === 46, "title reserves exactly 46px");
  });
});

describe("paginateQuestions fills pages to capacity", () => {
  it("30 short questions fit in 2 full pages (no early breaks)", () => {
    const qs = Array.from({ length: 30 }, (_, i) => mcq(i, 40, 10));
    const { pages, debug } = paginateQuestionsDebug(qs, undefined, "normal", true, {});
    assert.equal(pages.length, 2);
    assert.ok(debug.pages[0].fillRatio >= 0.7, `page 1 fill ${debug.pages[0].fillRatio} < 0.7`);
    // Every break records available / used / remaining / next heights.
    for (const b of debug.breaks) {
      assert.ok(b.capacityH > 0 && b.remainingH >= 0 && b.nextH > 0, JSON.stringify(b));
      assert.ok(b.reason.length > 0);
    }
  });

  it("100 mixed-length questions leave no half-empty non-final page", () => {
    const qs = Array.from({ length: 100 }, (_, i) =>
      mcq(i, 40 + ((i * 37) % 160), 8 + ((i * 13) % 40)),
    );
    const { pages, debug } = paginateQuestionsDebug(qs, undefined, "normal", true, {});
    assert.ok(pages.length >= 4, `expected 4+ pages, got ${pages.length}`);
    for (let p = 0; p < debug.pages.length - 1; p++) {
      assert.ok(
        debug.pages[p].fillRatio >= 0.7,
        `page ${p + 1} fill ${debug.pages[p].fillRatio} < 0.7 (early break)`,
      );
    }
    // Total placed blocks == input blocks (nothing dropped/duplicated).
    const placed = pages.reduce((n, pg) => n + pg.questions.length, 0);
    assert.equal(placed, 100);
  });

  it("topic headers reserve height without breaking the fill", () => {
    const qs = Array.from({ length: 30 }, (_, i) => mcq(i, 60, 12, `Topic ${Math.floor(i / 10)}`));
    const { pages, debug } = paginateQuestionsDebug(qs, undefined, "normal", true, {});
    const withHeader = debug.pages.flatMap((p) => p.items).filter((it) => it.topicHeader);
    assert.ok(withHeader.length >= 3, "each topic group head reserves a header");
    assert.ok(pages.length <= 3, `expected <= 3 pages, got ${pages.length}`);
  });

  it("single oversize question gets its own page and is never dropped", () => {
    const qs = [mcq(0, 40, 10), mcq(1, 5000, 200), mcq(2, 40, 10)];
    const pages = paginateQuestions(qs, undefined, "normal", true, {});
    assert.equal(pages.reduce((n, p) => n + p.questions.length, 0), 3);
    assert.ok(pages.some((p) => p.questions.length === 1), "oversize block isolated alone");
  });

  it("empty input yields one empty page (preview invariant)", () => {
    const pages = paginateQuestions([], undefined, "normal", true, {});
    assert.equal(pages.length, 1);
    assert.equal(pages[0].questions.length, 0);
  });

  it("relaxed spacing fits fewer per page than compact (spacing respected)", () => {
    const qs = Array.from({ length: 40 }, (_, i) => mcq(i));
    const compact = paginateQuestions(qs, undefined, "compact", true, {}).length;
    const relaxed = paginateQuestions(qs, undefined, "relaxed", true, {}).length;
    assert.ok(relaxed > compact, `relaxed (${relaxed}) should paginate more than compact (${compact})`);
  });
});
