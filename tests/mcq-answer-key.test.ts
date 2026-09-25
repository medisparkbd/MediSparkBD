/**
 * MCQ answer-key regression tests — parser → normalization → storage boundary.
 * Run with:  node --test tests/mcq-answer-key.test.ts
 * (Same convention as tests/admin-authorization.test.ts: Node strips types
 * natively; no test framework dependency.)
 *
 * Guarantees:
 *  - "Correct Answer: A/B/C/D" normalize to canonical A/B/C/D
 *  - Bangla "সঠিক উত্তর: ক/খ/গ/ঘ" normalize correctly
 *  - "(x) text" and "X — text" forms resolve to the right option
 *  - malformed/missing answers yield null (unknown) — NEVER "A"/index 0
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePastedMcqs,
  answerIndexToLetter,
  answerLetterToIndex,
  strictAnswerIndex,
} from "../src/lib/paste-mcq-parser.ts";

const OPTS = "A. OptA\nB. OptB\nC. OptC\nD. OptD";

function firstIndex(pasted: string): number | null | "NO-PARSE" {
  const parsed = parsePastedMcqs(pasted);
  if (parsed.length === 0) return "NO-PARSE";
  return parsed[0].correctIndex;
}

describe("inline English answer labels", () => {
  it("Test 1: 'Correct Answer: A' → A (index 0)", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nCorrect Answer: A`), 0);
  });
  it("Test 2: 'Correct Answer: B' → B (index 1)", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nCorrect Answer: B`), 1);
  });
  it("Test 3: 'Correct Answer: C' → C (index 2)", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nCorrect Answer: C`), 2);
  });
  it("Test 4: 'Correct Answer: D' → D (index 3)", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nCorrect Answer: D`), 3);
  });
});

describe("Bangla answer labels", () => {
  it("'সঠিক উত্তর: ক' → A", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nসঠিক উত্তর: ক`), 0);
  });
  it("'সঠিক উত্তর: খ' → B", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nসঠিক উত্তর: খ`), 1);
  });
  it("'সঠিক উত্তর: গ' → C", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nসঠিক উত্তর: গ`), 2);
  });
  it("Test 5: 'সঠিক উত্তর: ঘ' → D", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nসঠিক উত্তর: ঘ`), 3);
  });
});

describe("answer payloads carrying option text", () => {
  it("Test 6: 'Correct Answer: (c) Ascaris lumbricoides' → C", () => {
    const text = `1. Which?\nA. X\nB. Y\nC. Ascaris lumbricoides\nD. Z\nCorrect Answer: (c) Ascaris lumbricoides`;
    assert.equal(firstIndex(text), 2);
  });
  it("'Correct Answer: (d) Shark' → D", () => {
    const text = `1. Which?\nA. W\nB. X\nC. Y\nD. Shark\nCorrect Answer: (d) Shark`;
    assert.equal(firstIndex(text), 3);
  });
  it("'Correct Answer: D — Shark' → D", () => {
    const text = `1. Which?\nA. W\nB. X\nC. Y\nD. Shark\nCorrect Answer: D — Shark`;
    assert.equal(firstIndex(text), 3);
  });
  it("explicit letter is trusted when option text mismatches", () => {
    const text = `1. Which?\nA. W\nB. X\nC. Y\nD. Z\nCorrect Answer: (b) SomethingElse`;
    assert.equal(firstIndex(text), 1);
  });
});

describe("bare answer prefix + next-line payload", () => {
  it("'Correct Answer:' + 'C' → C", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nCorrect Answer:\nC`), 2);
  });
  it("bare prefix never swallows the next question", () => {
    const parsed = parsePastedMcqs(
      `1. Q1?\n${OPTS}\nCorrect Answer:\n2. Q2?\n${OPTS}\nCorrect Answer: B`,
    );
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].correctIndex, null);
    assert.equal(parsed[1].correctIndex, 1);
  });
});

describe("Test 7: malformed/missing answers → null, NEVER A", () => {
  it("malformed payload yields null", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}\nCorrect Answer: ???`), null);
  });
  it("missing answer line yields null", () => {
    assert.equal(firstIndex(`1. Q?\n${OPTS}`), null);
  });
  it("null is flagged for review, not silently accepted", () => {
    const parsed = parsePastedMcqs(`1. Q?\n${OPTS}\nCorrect Answer: ???`);
    assert.equal(parsed[0].correctIndex, null);
    assert.equal(parsed[0].needsReview, true);
    assert.ok(
      parsed[0].issues.some((issue) => issue.includes("confidently detected")),
    );
  });
});

describe("canonical letter converters", () => {
  it("index → letter (0–3 only)", () => {
    assert.equal(answerIndexToLetter(0), "A");
    assert.equal(answerIndexToLetter(1), "B");
    assert.equal(answerIndexToLetter(2), "C");
    assert.equal(answerIndexToLetter(3), "D");
  });
  it("index → letter rejects everything else (never defaults)", () => {
    assert.equal(answerIndexToLetter(null), null);
    assert.equal(answerIndexToLetter(undefined), null);
    assert.equal(answerIndexToLetter(-1), null);
    assert.equal(answerIndexToLetter(4), null);
    assert.equal(answerIndexToLetter(2.5), null);
  });
  it("letter → index (EN + BN)", () => {
    assert.equal(answerLetterToIndex("A"), 0);
    assert.equal(answerLetterToIndex("d"), 3);
    assert.equal(answerLetterToIndex("(c)"), 2);
    assert.equal(answerLetterToIndex("ঘ"), 3);
    assert.equal(answerLetterToIndex("ক"), 0);
  });
  it("letter → index rejects garbage (never defaults)", () => {
    assert.equal(answerLetterToIndex("???"), null);
    assert.equal(answerLetterToIndex(""), null);
    assert.equal(answerLetterToIndex(null), null);
  });
});

describe("strictAnswerIndex storage boundary", () => {
  it("accepts valid indices 0–3 (including 0 = genuine A)", () => {
    assert.equal(strictAnswerIndex(0, 4), 0);
    assert.equal(strictAnswerIndex(1, 4), 1);
    assert.equal(strictAnswerIndex(2, 4), 2);
    assert.equal(strictAnswerIndex(3, 4), 3);
    assert.equal(strictAnswerIndex("2", 4), 2);
  });
  it("rejects missing/malformed input (never stores A)", () => {
    assert.equal(strictAnswerIndex(null, 4), null);
    assert.equal(strictAnswerIndex(undefined, 4), null);
    assert.equal(strictAnswerIndex("", 4), null);
    assert.equal(strictAnswerIndex("   ", 4), null);
    assert.equal(strictAnswerIndex("B", 4), null);
    assert.equal(strictAnswerIndex("D — Shark", 4), null);
    assert.equal(strictAnswerIndex(true, 4), null);
    assert.equal(strictAnswerIndex(NaN, 4), null);
    assert.equal(strictAnswerIndex(2.5, 4), null);
  });
  it("rejects out-of-range indices", () => {
    assert.equal(strictAnswerIndex(-1, 4), null);
    assert.equal(strictAnswerIndex(4, 4), null);
    assert.equal(strictAnswerIndex(5, 4), null);
  });
});
