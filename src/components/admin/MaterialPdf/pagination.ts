import type { PdfMaterialQuestion } from "@/lib/pdf-materials";

// A4 dimensions: 210mm x 297mm = 794 x 1123 px @ 96dpi
// Page padding: 10mm top/bottom, 12mm left/right => content height ~1047px
// The question area is whatever is left after the fixed header, the optional
// material-name title, and the per-page answer-key box — all measured from the
// A4 preview DOM (CSS px @96dpi, 1:1 with the html2canvas capture).
export const A4_CONTENT_WIDTH_PX = 682;
export const A4_USABLE_HEIGHT_PX = 820; // legacy fixed budget (kept for back-compat)

/** Full A4 page height in CSS px (297mm @96dpi). */
export const A4_PAGE_HEIGHT_PX = 1123;
/** Vertical page padding (10mm top + 10mm bottom). */
export const A4_PAGE_V_PADDING_PX = 76;
/**
 * Fixed per-page overhead inside the content box, measured from the preview:
 * top header row (~22) + dotted divider (~8) + column margin (~12) +
 * answer-box top offset pt-4 (16) + rounding slack (~18).
 */
export const A4_PAGE_OVERHEAD_PX = 76;
/** Material-name title block (mt-3 + 13px bold line) when a name is set. */
export const A4_TITLE_RESERVE_PX = 46;
/** Topic-group header chip (mb-2 + py-1 + 11px line + border). */
export const TOPIC_HEADER_HEIGHT_PX = 34;

// ── Render metrics (must match the preview DOM in
//    src/app/admin/material-pdf/page.tsx) ──
// Question stem: text-[11px] font-bold, lineHeight = spacing * 1.1
const Q_FONT_PX = 11;
const Q_LINE_FACTOR = 1.1;
// Options: text-[11px], lineHeight = spacing; grid gap-0.5 (2px) + mt-1.5 (6px)
const OPT_FONT_PX = 11;
const OPT_GAP_PX = 2;
const OPT_TOP_MARGIN_PX = 6;
// Question block: mb-3 (12) + p-1 vertical padding (8)
const BLOCK_EXTRAS_PX = 20;
// Usable text width per column (~342px) minus the number gutter (~40px) for
// the stem and minus pl-5 (20px) for options; Hind Siliguri 11px averages
// ~6px/char (Bangla) and ~5.5px/char (English) — 48/44 splits the difference.
const CHARS_PER_LINE_Q = 48;
const CHARS_PER_LINE_OPT = 44;
// Answer-key box: two wrapped rows (numbers + answers) of min-w-[24px] items
// at gap-x-4 (16px) => 40px pitch over ~687px => ~17 items per row.
const ANSWER_ITEMS_PER_ROW = 17;
const ANSWER_ROW_HEIGHT_PX = 18;
/** Base answer-box chrome: border + "উত্তরমালা" header + p-2 + dashed divider. */
const ANSWER_BOX_BASE_PX = 62;

/**
 * Estimated height of the per-page answer-key box for `answerCount`
 * (non-image) questions on that page. It grows only when a row wraps, so the
 * pagination loop can account for it exactly as it fills each page.
 */
export function estimateAnswerBoxHeight(answerCount: number): number {
  const rows = Math.max(1, Math.ceil(Math.max(answerCount, 1) / ANSWER_ITEMS_PER_ROW));
  // Two sections (numbers row + answers row), each wrapping into `rows` lines.
  return ANSWER_BOX_BASE_PX + 2 * rows * ANSWER_ROW_HEIGHT_PX;
}

export type LineSpacing = "compact" | "normal" | "relaxed" | number;
export function lineSpacingFactor(v: LineSpacing): number {
  if (typeof v === "number") return v;
  switch (v) {
    case "compact":
      return 1.0;
    case "normal":
      return 1.35;
    case "relaxed":
      return 1.7;
    default:
      return 1.35;
  }
}

function estimateImageHeight(q: PdfMaterialQuestion, maxHeight: number): number {
  if (!q.image?.dataUrl) return 0;
  // Standalone image block: no question/options, only image
  const w = q.image.widthPercent ?? 100;
  // Estimate height: base on width percent, preserve aspect ~4:3 typical diagram
  // 100% ~ 160px, 70% ~ 120px, 50% ~ 90px, 30% ~ 60px in column width.
  // Capped at the render's maxHeight so large images never under-reserve.
  const base = 160;
  const h = Math.min(maxHeight, Math.round((base * w) / 100));
  // Add padding/margin around image
  return h + 12;
}

export function estimateQuestionHeight(q: PdfMaterialQuestion, spacing: LineSpacing = "normal"): number {
  const factor = lineSpacingFactor(spacing);
  if (q.isStandaloneImage) {
    // Render cap: maxHeight 280px (standalone block).
    return estimateImageHeight(q, 280) + 8;
  }
  const charsPerLineQ = CHARS_PER_LINE_Q;
  const charsPerLineOpt = CHARS_PER_LINE_OPT;
  // Support statement-type MCQs: question contains statements separated by \n (main Q + 1. 2. 3.)
  // Each explicit line should count as at least one typographic line, plus wrapping for long lines
  const qText = q.question || "";
  const qSegments = qText.split("\n");
  let linesQ = 0;
  for (const seg of qSegments) {
    const segTrim = seg.trim();
    // Even empty segment after \n is a line break; count as 1
    if (segTrim.length === 0) {
      linesQ += 1;
      continue;
    }
    linesQ += Math.max(1, Math.ceil(segTrim.length / charsPerLineQ));
  }
  if (linesQ === 0) linesQ = 1;
  // 11px stem at lineHeight spacing*1.1 (matches the preview span style).
  const qHeight = linesQ * (Q_FONT_PX * factor * Q_LINE_FACTOR);
  let optsHeight = OPT_TOP_MARGIN_PX;
  const optLineH = OPT_FONT_PX * factor;
  q.options.forEach((opt, i) => {
    const len = (opt || "").length;
    const lines = Math.max(1, Math.ceil(Math.max(len, 1) / charsPerLineOpt));
    optsHeight += lines * optLineH;
    if (i < q.options.length - 1) optsHeight += OPT_GAP_PX;
  });
  // Render cap: maxHeight 260px (question-attached image).
  const imgH = estimateImageHeight(q, 260);
  // Block chrome: mb-3 + p-1 vertical padding.
  return qHeight + optsHeight + imgH + BLOCK_EXTRAS_PX;
}

export type PaginatedPage = {
  pageNumber: number;
  questions: PdfMaterialQuestion[];
  startQ: number;
  endQ: number;
};

export type PaginateOptions = {
  /** True when the material-name title block is rendered (reserves 46px). */
  titleReserve?: boolean;
  /**
   * Fixed per-column budget (legacy behaviour, e.g. 740). When omitted the
   * budget is derived from the real page geometry: content height minus
   * header/title overhead minus the page's own answer-box height.
   */
  fixedColumnHeight?: number;
};

export type PageBreakDecision = {
  page: number;
  /** Index of the question that triggered the break. */
  atQuestion: number;
  usedH: number;
  capacityH: number;
  remainingH: number;
  nextH: number;
  reason: string;
};

export type PaginateDebugItem = {
  id: string;
  qNumber: number | null;
  height: number;
  topicHeader: boolean;
};

export type PaginateDebugPage = {
  page: number;
  capacityH: number;
  usedH: number;
  remainingH: number;
  fillRatio: number;
  items: PaginateDebugItem[];
};

export type PaginateDebugInfo = {
  /** Page geometry the budgets were derived from. */
  availablePageH: number;
  overheadH: number;
  titleReserveH: number;
  breaks: PageBreakDecision[];
  pages: PaginateDebugPage[];
};

export type PaginateResult = {
  pages: PaginatedPage[];
  debug: PaginateDebugInfo;
};

/**
 * Column budget for a page holding `answerCount` (non-image) questions.
 * The answer-key box height is a function of that count, so the budget is
 * exact for the page being filled — no fixed over-reservation.
 */
export function columnBudgetFor(answerCount: number, titleReserve: boolean): number {
  const contentH = A4_PAGE_HEIGHT_PX - A4_PAGE_V_PADDING_PX;
  const titleH = titleReserve ? A4_TITLE_RESERVE_PX : 0;
  return contentH - A4_PAGE_OVERHEAD_PX - titleH - estimateAnswerBoxHeight(answerCount);
}

function topicOf(block: PdfMaterialQuestion): string {
  return block.isStandaloneImage ? "" : (block.topic ?? "").trim();
}

export function paginateQuestionsDebug(
  questions: PdfMaterialQuestion[],
  usableHeight: number = A4_USABLE_HEIGHT_PX,
  spacing: LineSpacing = "normal",
  twoColumn: boolean = true,
  opts: PaginateOptions = {},
): PaginateResult {
  const titleReserve = opts.titleReserve ?? false;
  const fixed = opts.fixedColumnHeight ?? usableHeight;
  const contentH = A4_PAGE_HEIGHT_PX - A4_PAGE_V_PADDING_PX;
  const overheadH = A4_PAGE_OVERHEAD_PX;
  const titleReserveH = titleReserve ? A4_TITLE_RESERVE_PX : 0;
  const debug: PaginateDebugInfo = {
    availablePageH: contentH,
    overheadH,
    titleReserveH,
    breaks: [],
    pages: [],
  };
  if (questions.length === 0) {
    return {
      pages: [{ pageNumber: 1, questions: [], startQ: 1, endQ: 0 }],
      debug: {
        ...debug,
        pages: [{ page: 1, capacityH: 0, usedH: 0, remainingH: 0, fillRatio: 0, items: [] }],
      },
    };
  }
  const capacityFor = (answerCount: number): number => {
    if (opts.fixedColumnHeight !== undefined) {
      return twoColumn ? fixed * 2 : fixed;
    }
    const col = columnBudgetFor(answerCount, titleReserve);
    return twoColumn ? col * 2 : col;
  };
  const pages: PaginatedPage[] = [];
  let current: PdfMaterialQuestion[] = [];
  let currentItems: PaginateDebugItem[] = [];
  let curH = 0;
  let curAnswers = 0;
  let lastTopic = "";
  let firstOnPage = true;

  const flushDebugPage = (pageNo: number, capacityH: number) => {
    debug.pages.push({
      page: pageNo,
      capacityH,
      usedH: curH,
      remainingH: Math.max(0, capacityH - curH),
      fillRatio: capacityH > 0 ? curH / capacityH : 0,
      items: currentItems,
    });
  };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const topic = topicOf(q);
    const baseH = estimateQuestionHeight(q, spacing);
    // Topic-group header chip renders above the first question of each topic
    // on a page (matches showTopic in the preview) — reserve its height too.
    const headerIfStays = !q.isStandaloneImage && topic !== "" && (firstOnPage || topic !== lastTopic);
    // On a fresh page the chip shows whenever the block has a topic (qi === 0).
    const headerIfMoves = !q.isStandaloneImage && topic !== "";
    const nextAnswers = curAnswers + (q.isStandaloneImage ? 0 : 1);
    const capacityH = capacityFor(nextAnswers);
    // Never split: if overflow, move entire block to next page/column
    if (curH + baseH + (headerIfStays ? TOPIC_HEADER_HEIGHT_PX : 0) > capacityH && current.length > 0) {
      const h = baseH + (headerIfMoves ? TOPIC_HEADER_HEIGHT_PX : 0);
      debug.breaks.push({
        page: pages.length + 1,
        atQuestion: i,
        usedH: curH,
        capacityH: capacityFor(curAnswers),
        remainingH: capacityFor(curAnswers) - curH,
        nextH: h,
        reason: `next block (${Math.round(h)}px) exceeds remaining ${Math.round(capacityFor(curAnswers) - curH)}px`,
      });
      const start = pages.reduce((acc, p) => acc + p.questions.length, 0) + 1;
      flushDebugPage(pages.length + 1, capacityFor(curAnswers));
      pages.push({
        pageNumber: pages.length + 1,
        questions: current,
        startQ: start,
        endQ: start + current.length - 1,
      });
      current = [q];
      currentItems = [{ id: q.id, qNumber: q.isStandaloneImage ? null : (q.qNumber ?? null), height: h, topicHeader: headerIfMoves }];
      curH = h;
      curAnswers = q.isStandaloneImage ? 0 : 1;
      firstOnPage = false;
    } else {
      const h = baseH + (headerIfStays ? TOPIC_HEADER_HEIGHT_PX : 0);
      current.push(q);
      currentItems.push({ id: q.id, qNumber: q.isStandaloneImage ? null : (q.qNumber ?? null), height: h, topicHeader: headerIfStays });
      curH += h;
      curAnswers = nextAnswers;
      firstOnPage = false;
    }
    lastTopic = topic;
    // If single question taller than pageCapacity, still keep alone (will overflow gracefully)
    if (baseH > capacityH && current.length === 1) {
      // already handled, will be pushed next iter
    }
  }
  if (current.length > 0) {
    const start = pages.reduce((acc, p) => acc + p.questions.length, 0) + 1;
    flushDebugPage(pages.length + 1, capacityFor(curAnswers));
    pages.push({
      pageNumber: pages.length + 1,
      questions: current,
      startQ: start,
      endQ: start + current.length - 1,
    });
  }
  return { pages, debug };
}

export function paginateQuestions(
  questions: PdfMaterialQuestion[],
  usableHeight: number = A4_USABLE_HEIGHT_PX,
  spacing: LineSpacing = "normal",
  twoColumn: boolean = true,
  opts: PaginateOptions = {},
): PaginatedPage[] {
  return paginateQuestionsDebug(questions, usableHeight, spacing, twoColumn, opts).pages;
}

/** Console report: available height, per-question heights, break decisions. */
export function logPaginateDebug(debug: PaginateDebugInfo): void {
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `[pdf-paginate] page content ${debug.availablePageH}px − overhead ${debug.overheadH}px − title ${debug.titleReserveH}px`,
  );
  for (const p of debug.pages) {
    // eslint-disable-next-line no-console
    console.log(
      `page ${p.page}: capacity ${Math.round(p.capacityH)}px, used ${Math.round(p.usedH)}px, ` +
        `remaining ${Math.round(p.remainingH)}px, fill ${(p.fillRatio * 100).toFixed(1)}%`,
    );
  }
  if (debug.breaks.length > 0) {
    // eslint-disable-next-line no-console
    console.table(
      debug.breaks.map((b) => ({
        page: b.page,
        atQuestion: b.atQuestion,
        used: Math.round(b.usedH),
        capacity: Math.round(b.capacityH),
        remaining: Math.round(b.remainingH),
        next: Math.round(b.nextH),
        reason: b.reason,
      })),
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

export const ANSWER_LABELS = {
  en: ["A", "B", "C", "D"] as const,
  bn: ["ক", "খ", "গ", "ঘ"] as const,
};

export function normalizeAnswer(ans: string): string {
  const t = ans.trim();
  if (["A", "B", "C", "D", "a", "b", "c", "d"].includes(t)) return t.toUpperCase();
  if (["ক", "খ", "গ", "ঘ"].includes(t)) return t;
  // also accept 1-4
  if (["1", "2", "3", "4"].includes(t)) return String.fromCharCode(64 + Number(t));
  return t;
}

export function answerToDisplay(ans: string, preferBn: boolean): string {
  if (!ans) return "—";
  const up = ans.toUpperCase();
  if (["A", "B", "C", "D"].includes(up)) {
    if (preferBn) {
      const map: Record<string, string> = { A: "ক", B: "খ", C: "গ", D: "ঘ" };
      return map[up] ?? up;
    }
    return up;
  }
  if (["ক", "খ", "গ", "ঘ"].includes(ans)) {
    if (!preferBn) {
      const map: Record<string, string> = { ক: "A", খ: "B", গ: "C", ঘ: "D" };
      return map[ans] ?? ans;
    }
    return ans;
  }
  return ans;
}
