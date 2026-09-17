"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
} from "./admin-ui";
import { parsePastedMcqs } from "@/lib/paste-mcq-parser";

type ExamBrief = {
  id: string;
  title: string;
  subject?: string;
  totalMarks?: number;
  durationMinutes?: number;
  questionCount?: number;
  totalQuestions?: number;
  ruleTemplate?: string | null;
  rule_template?: string | null;
  status?: string;
  marksPerQuestion?: number | null;
};

type ExamQuestion = {
  id: number | null;
  examId: string | null;
  subject: string;
  question: string;
  questionImage?: string | null;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  marks: number;
  isActive?: boolean;
  /** True when this slot already has authored content for the active version/set. */
  hasVariant?: boolean;
};

type LangVersion = "bangla" | "english";
type SetLabel = "A" | "B";

function tabKey(version: LangVersion, set: SetLabel): string {
  return `${version}:${set}`;
}

const EMPTY_OPTIONS = ["", "", "", ""];

/** Unsaved per-slot edits. Nothing reaches the database until Save Questions. */
type SlotDraft = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  questionImage: string | null;
};

function emptyDraft(): SlotDraft {
  return { question: "", options: [...EMPTY_OPTIONS], correctIndex: 0, explanation: "", questionImage: null };
}

function draftFromQuestion(q: ExamQuestion | null | undefined): SlotDraft {
  const opts = q?.options?.length
    ? (q.options.length >= 4 ? q.options.slice(0, 4) : [...q.options, ...EMPTY_OPTIONS.slice(q.options.length)])
    : [...EMPTY_OPTIONS];
  while (opts.length < 4) opts.push("");
  return {
    question: q?.question || "",
    options: opts.slice(0, 4),
    correctIndex: q?.correctIndex ?? 0,
    explanation: q?.explanation ?? "",
    questionImage: q?.questionImage ?? null,
  };
}

/** True when the draft differs from the saved slot (i.e. unsaved changes). */
function isDraftDirty(d: SlotDraft | undefined, q: ExamQuestion | null | undefined): boolean {
  if (!d) return false;
  if ((d.question || "") !== (q?.question || "")) return true;
  const qOpts = q?.options?.slice(0, 4) ?? [];
  for (let i = 0; i < 4; i++) {
    if ((d.options[i] || "") !== (qOpts[i] || "")) return true;
  }
  if ((d.correctIndex ?? 0) !== (q?.correctIndex ?? 0)) return true;
  if ((d.explanation || "") !== (q?.explanation || "")) return true;
  if ((d.questionImage ?? null) !== (q?.questionImage ?? null)) return true;
  return false;
}

function isCompleted(q: ExamQuestion | null | undefined): boolean {
  if (!q || q.id === null) return false;
  if (!q.question || q.question.trim().length < 3) return false;
  const filled = q.options.filter((o) => o && o.trim().length > 0);
  if (filled.length < 2) return false;
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return false;
  if (!q.options[q.correctIndex]?.trim()) return false;
  return true;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ExamPaperEditor({
  exam,
  authHeaders,
  onClose,
  onChanged,
  embedded = false,
}: {
  exam: ExamBrief;
  authHeaders: Record<string, string>;
  onClose: () => void;
  onChanged?: () => void;
  embedded?: boolean;
}) {
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [detectBusy, setDetectBusy] = useState(false);
  // Language Version (Bangla / English) × Set (A / B): four separate
  // workspaces sharing the same permanent Question IDs and slot order.
  // Each workspace has its own paste area — no auto-translation between them.
  const [langVersion, setLangVersion] = useState<LangVersion>("bangla");
  const [setLabel, setSetLabel] = useState<SetLabel>("A");
  const activeTab = tabKey(langVersion, setLabel);
  const [bulkTexts, setBulkTexts] = useState<Record<string, string>>({});
  const bulkText = bulkTexts[activeTab] ?? "";
  const setBulkText = useCallback((value: string) => {
    setBulkTexts((prev) => ({ ...prev, [activeTab]: value }));
  }, [activeTab]);
  const [coverage, setCoverage] = useState<{ totalSlots: number; coverage: Record<string, number>; hasAnyVariant: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [imageUploadingSlot, setImageUploadingSlot] = useState<number | null>(null);
  const [detectWarnings, setDetectWarnings] = useState<Record<number, string[]>>({});
  const [detectExistingMap, setDetectExistingMap] = useState<Record<number, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bearer = useMemo(() => authHeaders["Authorization"] || authHeaders["authorization"] || "", [authHeaders]);
  // Staleness guard: increments on every workspace switch so in-flight fetches
  // from a previous workspace discard their results instead of overwriting the
  // current workspace's questions state.
  const loadVersionRef = useRef(0);
  // Tracks the currently visible workspace so async save continuations never
  // write results into a different workspace the admin switched to mid-save.
  // (No automatic refetch happens on save — the Refresh button is the only
  // manual refresh; saves merge into local state instead.)
  const workspaceRef = useRef<{ v: LangVersion; s: SetLabel }>({ v: langVersion, s: setLabel });
  workspaceRef.current = { v: langVersion, s: setLabel };

  // Merge a successfully saved slot into local state (no refetch, no reload)
  // so typing, edits, drafts and scroll position are never lost on save.
  const applySavedSlot = useCallback((slotIndex: number, saved: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    questionImage?: string | null;
    id?: number | null;
  }) => {
    setQuestions((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      while (next.length <= slotIndex) next.push(null as unknown as ExamQuestion);
      const existing = next[slotIndex];
      const opts = [...saved.options];
      while (opts.length < 4) opts.push("");
      next[slotIndex] = {
        id: saved.id ?? existing?.id ?? null,
        examId: exam.id,
        subject: existing?.subject || exam.subject || "",
        question: saved.question,
        questionImage: saved.questionImage !== undefined ? saved.questionImage : (existing?.questionImage ?? null),
        options: opts.slice(0, 4),
        correctIndex: saved.correctIndex,
        explanation: saved.explanation || existing?.explanation || null,
        marks: (existing?.marks ?? Number(exam.marksPerQuestion ?? 1) ?? 1) || 1,
        isActive: true,
        hasVariant: true,
      };
      return next;
    });
  }, [exam.id, exam.subject, exam.marksPerQuestion]);

  const load = useCallback(async (forVersion?: LangVersion, forSet?: SetLabel) => {
    const v = forVersion ?? langVersion;
    const s = forSet ?? setLabel;
    const version = ++loadVersionRef.current;
    try {
      const res = await fetch(`/api/admin/exams/questions?examId=${encodeURIComponent(exam.id)}&version=${v}&set=${s}`, {
        cache: "no-store",
        headers: authHeaders,
      });
      const data = (await res.json()) as { questions?: ExamQuestion[] };
      if (version === loadVersionRef.current) setQuestions(data.questions ?? []);
    } catch {
      if (version === loadVersionRef.current) setQuestions([]);
    }
  }, [exam.id, authHeaders, langVersion, setLabel]);

  const loadCoverage = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/exams/variants?examId=${encodeURIComponent(exam.id)}`, {
        cache: "no-store",
        headers: authHeaders,
      });
      if (res.ok) {
        const data = (await res.json()) as { totalSlots: number; coverage: Record<string, number>; hasAnyVariant: boolean };
        setCoverage(data);
      }
    } catch {
      // Coverage badges are best-effort.
    }
  }, [exam.id, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCoverage();
  }, [loadCoverage]);

  // Switching version/set workspace resets local state so content from one
  // workspace never leaks into another. questions must be nulled so the UI
  // shows "Loading…" while the new workspace data is fetched.
  useEffect(() => {
    setQuestions(null);
    setDrafts({});
    setDetectWarnings({});
    setDetectExistingMap({});
    setSavingSlot(null);
    setError(null);
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const totalSlots = useMemo(() => {
    const qCount = Number(exam.questionCount ?? exam.totalQuestions ?? 0);
    if (Number.isFinite(qCount) && qCount > 0) return Math.floor(qCount);
    if (questions) return questions.length;
    return 0;
  }, [exam.questionCount, exam.totalQuestions, questions]);

  const completedCount = useMemo(() => {
    if (!questions) return 0;
    return questions.filter(isCompleted).length;
  }, [questions]);

  const displaySlots = useMemo(() => {
    if (!questions) return [];
    const list: Array<{ index: number; q: ExamQuestion | null }> = [];
    for (let i = 0; i < totalSlots; i += 1) {
      const q = i < questions.length ? questions[i] : null;
      list.push({ index: i, q });
    }
    if (totalSlots === 0) {
      return questions.map((q, i) => ({ index: i, q }));
    }
    return list;
  }, [questions, totalSlots]);

  const progressText =
    totalSlots > 0
      ? `${completedCount}/${totalSlots} Questions Completed`
      : `${completedCount} questions`;

  // Local drafts for inline editing — UNSAVED until "Save Questions" is clicked.
  // Typing, detecting, answering and image uploads only touch these drafts.
  const [drafts, setDrafts] = useState<Record<number, SlotDraft>>({});

  useEffect(() => {
    // Seed drafts from saved questions when they load (never overwrite edits in progress)
    if (!questions) return;
    setDrafts((prev) => {
      const merged: Record<number, SlotDraft> = { ...prev };
      for (let i = 0; i < totalSlots; i++) {
        if (!merged[i]) {
          const q = i < questions.length ? questions[i] : null;
          merged[i] = draftFromQuestion(q);
        }
      }
      // Remove extra indices beyond totalSlots
      Object.keys(merged).forEach((k) => {
        if (Number(k) >= totalSlots) delete merged[Number(k)];
      });
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, totalSlots]);

  // Number of slots with unsaved changes (powers the Save button label).
  const dirtyCount = useMemo(() => {
    if (!questions) return 0;
    let n = 0;
    for (const k of Object.keys(drafts)) {
      const i = Number(k);
      if (i >= totalSlots) continue;
      const q = i < questions.length ? questions[i] : null;
      if (isDraftDirty(drafts[i], q)) n += 1;
    }
    return n;
  }, [drafts, questions, totalSlots]);

  // NOTE: there is intentionally NO blur auto-save. All edits stay in `drafts`
  // until the admin explicitly clicks "Save Questions".

  async function handleDetect() {
    setError(null);
    setNotice(null);
    setDetectWarnings({});
    setDetectExistingMap({});
    // Capture workspace at call time for the status message below.
    // Detection never refetches — saves merge into local state instead.
    const detectVersion = langVersion;
    const detectSet = setLabel;
    if (!bulkText.trim()) {
      setError("Paste your questions first.");
      return;
    }
    const parsed = parsePastedMcqs(bulkText);
    // Filter out totally invalid blocks (no question and <2 options) but keep those with warnings (partial)
    const validParsed = parsed.filter((p) => p.question.trim().length >= 2 && p.options.filter((o) => o.trim()).length >= 2);
    const hasAnyValid = validParsed.length > 0 ? validParsed : parsed;
    const useParsed = hasAnyValid.length > 0 ? hasAnyValid : parsed;
    if (useParsed.length === 0 || useParsed.every((p) => p.options.filter((o) => o.trim()).length < 2 && p.question.trim().length < 3)) {
      setError("No questions detected. Check the format (numbered questions with A–D options).");
      return;
    }
    if (totalSlots === 0) {
      setError("Set Total Questions on the exam first.");
      return;
    }
    setDetectBusy(true);
    try {
      const count = Math.min(useParsed.length, totalSlots);
      const extra = useParsed.length - totalSlots;

      // Track which slots already had content (questions added before detection)
      const existingMap: Record<number, boolean> = {};
      for (let i = 0; i < count; i++) {
        const slot = displaySlots[i];
        const hadContent = slot?.q?.id !== null && slot?.q?.id !== undefined &&
          (slot?.q?.question?.trim().length ?? 0) >= 3;
        if (hadContent) existingMap[i] = true;
      }
      setDetectExistingMap(existingMap);

      // Build warnings per slot (for those with issues)
      const warnings: Record<number, string[]> = {};
      for (let i = 0; i < count; i++) {
        const p = useParsed[i];
        if (p.issues.length > 0) warnings[i] = p.issues;
        // special: if correctIndex null, issue already includes verification warning
      }
      setDetectWarnings(warnings);

      // Detected questions stay UNSAVED drafts until "Save Questions" is clicked.
      // Fully replace drafts — clear ALL old drafts first, then set only the newly detected ones.
      // Saved images on overwritten slots are preserved in the drafts.
      const newDrafts: Record<number, SlotDraft> = {};
      for (let i = 0; i < count; i++) {
        const p = useParsed[i];
        const ci = p.correctIndex !== null && p.correctIndex >= 0 && p.correctIndex < 4 ? p.correctIndex : -1;
        newDrafts[i] = {
          question: p.question,
          options: p.options.slice(0, 4) as string[],
          correctIndex: ci >= 0 ? ci : -1,
          explanation: p.explanation ?? "",
          questionImage: displaySlots[i]?.q?.questionImage ?? null,
        };
      }
      setDrafts(newDrafts);

      // No database writes here — the admin reviews and clicks Save Questions.
      let msg = `Detected ${useParsed.length} question${useParsed.length === 1 ? "" : "s"} — filled Q01–Q${pad(count)} in ${detectVersion} Set ${detectSet} (unsaved — review, then click Save Questions).`;
      if (extra > 0) msg += ` Warning: ${extra} extra question${extra === 1 ? "" : "s"} detected beyond ${totalSlots} slots (not included).`;
      const noAnswerCount = useParsed.slice(0, count).filter((p) => p.correctIndex === null).length;
      if (noAnswerCount > 0) msg += ` ${noAnswerCount} question${noAnswerCount === 1 ? "" : "s"} have no confident answer — please verify before saving.`;
      const reviewCount = Object.keys(warnings).length;
      if (reviewCount > 0) msg += ` ${reviewCount} need review.`;
      const existingCount = Object.keys(existingMap).length;
      if (existingCount > 0) msg += ` ${existingCount} already had saved content — saving will overwrite those slots.`;
      setNotice(msg);
      setTimeout(() => setNotice(null), 8000);
      // Auto-scroll question list to top so detected questions are visible
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed.");
    } finally {
      setDetectBusy(false);
    }
  }

  async function persistSlotWithData(slotIndex: number, draft: SlotDraft) {
    const slot = displaySlots[slotIndex];
    const existing = slot?.q;
    const order = slotIndex + 1;
    const marksPerQ = Number((exam.marksPerQuestion ?? 1) as number) || 1;
    const finalOptions = [...draft.options];
    while (finalOptions.length < 4) finalOptions.push("");
    // Capture workspace at call time — the admin may switch tabs mid-save.
    const saveVersion = langVersion;
    const saveSet = setLabel;
    const body: Record<string, unknown> = {
      ...(existing && existing.id !== null ? { id: existing.id } : {}),
      examId: exam.id,
      version: saveVersion,
      set: saveSet,
      subject: existing?.subject || exam.subject || "",
      question: draft.question.trim(),
      questionImage: draft.questionImage ?? existing?.questionImage ?? null,
      question_image: draft.questionImage ?? existing?.questionImage ?? null,
      options: finalOptions.slice(0, 4),
      correctIndex: draft.correctIndex,
      explanation: draft.explanation || null,
      marks: (existing?.marks ?? marksPerQ) as number,
      isActive: true,
      order,
    };
    const res = await fetch("/api/admin/exams/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { error?: string; id?: number } | null;
    if (!res.ok) throw new Error(data?.error ?? "Failed to save detected question.");
    // Sync local state only — no refetch, so the page never reloads on save.
    // Skip if the admin already switched to another workspace mid-save.
    if (workspaceRef.current.v === saveVersion && workspaceRef.current.s === saveSet) {
      applySavedSlot(slotIndex, {
        question: draft.question.trim(),
        options: finalOptions.slice(0, 4),
        correctIndex: draft.correctIndex,
        explanation: draft.explanation || "",
        questionImage: draft.questionImage ?? existing?.questionImage ?? null,
        id: typeof data?.id === "number" ? data.id : (existing?.id ?? null),
      });
    }
  }

  /**
   * Explicit "Save Questions" — the ONLY writer to the database on this page.
   * Saves every draft with valid content sequentially; invalid/empty slots are
   * skipped and reported, never written.
   */
  const [saveAllBusy, setSaveAllBusy] = useState(false);

  async function handleSaveAll() {
    setError(null);
    setNotice(null);
    const saveVersion = langVersion;
    const saveSet = setLabel;
    const indices = Object.keys(drafts).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    if (indices.length === 0) {
      setError("Nothing to save — detect or type questions first.");
      return;
    }
    setSaveAllBusy(true);
    try {
      let saved = 0;
      const skipped: string[] = [];
      let failed = 0;
      for (const i of indices) {
        const d = drafts[i];
        if (!d) continue;
        const qText = d.question.trim();
        const filledOpts = d.options.filter((o) => o.trim()).length;
        const hasAny = qText.length > 0 || d.options.some((o) => o.trim()) || !!d.questionImage;
        if (!hasAny) continue; // blank slot — leave saved data (if any) untouched
        if (qText.length < 3 || filledOpts < 2 || d.correctIndex < 0 || d.correctIndex > 3 || !d.options[d.correctIndex]?.trim()) {
          skipped.push(`Q${pad(i + 1)}`);
          continue;
        }
        setSavingSlot(i);
        try {
          // eslint-disable-next-line no-await-in-loop
          await persistSlotWithData(i, d);
          saved += 1;
        } catch {
          failed += 1;
          skipped.push(`Q${pad(i + 1)}`);
        }
        // Stop touching another workspace if the admin switched tabs mid-save.
        if (workspaceRef.current.v !== saveVersion || workspaceRef.current.s !== saveSet) break;
      }
      void loadCoverage();
      onChanged?.();
      let msg = `Saved ${saved} question${saved === 1 ? "" : "s"} to ${saveVersion} Set ${saveSet}.`;
      if (skipped.length > 0) msg += ` Skipped (need review): ${skipped.join(", ")}${failed > 0 ? " — some saves failed, please retry." : "."}`;
      setNotice(msg);
      setTimeout(() => setNotice(null), 8000);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingSlot(null);
      setSaveAllBusy(false);
    }
  }

  /**
   * "Remove All" — clears the current detection state only (drafts, warnings,
   * paste area). Never touches the database; previously saved questions stay.
   */
  function handleRemoveAll() {
    setError(null);
    setDetectWarnings({});
    setDetectExistingMap({});
    setDrafts({});
    setBulkTexts((prev) => ({ ...prev, [activeTab]: "" }));
    setNotice("Detection cleared — paste a new question set, then Detect.");
    setTimeout(() => setNotice(null), 5000);
  }

  /** Global Refresh (existing button) — reload saved data, discard unsaved drafts. */
  function handleRefresh() {
    setDrafts({});
    setDetectWarnings({});
    setDetectExistingMap({});
    setError(null);
    setNotice(null);
    void load();
    void loadCoverage();
  }

  /** Per-question Refresh — reload one saved slot, leave every other slot untouched. */
  const [refreshingSlot, setRefreshingSlot] = useState<number | null>(null);

  async function refreshSlot(slotIndex: number) {
    const rv = langVersion;
    const rs = setLabel;
    setRefreshingSlot(slotIndex);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/questions?examId=${encodeURIComponent(exam.id)}&version=${rv}&set=${rs}`, {
        cache: "no-store",
        headers: authHeaders,
      });
      const data = (await res.json()) as { questions?: ExamQuestion[] };
      if (workspaceRef.current.v !== rv || workspaceRef.current.s !== rs) return;
      const fresh = (data.questions ?? [])[slotIndex] ?? null;
      setQuestions((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        while (next.length <= slotIndex) next.push(null as unknown as ExamQuestion);
        next[slotIndex] = fresh;
        return next;
      });
      setDrafts((prev) => ({ ...prev, [slotIndex]: draftFromQuestion(fresh) }));
      setDetectWarnings((prev) => {
        const next = { ...prev };
        delete next[slotIndex];
        return next;
      });
    } catch {
      setError("Refresh failed — please try again.");
    } finally {
      setRefreshingSlot(null);
    }
  }

  async function handleCorrectChange(slotIndex: number, newIdx: number) {
    // Draft-only: selecting an answer never writes to the database and never
    // reloads anything. It is saved when "Save Questions" is clicked.
    setDrafts((prev) => {
      const cur = prev[slotIndex];
      if (!cur) return prev;
      return { ...prev, [slotIndex]: { ...cur, correctIndex: newIdx } };
    });
    setDetectWarnings((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  }

  async function handleImageUpload(file: File, slotIndex: number) {
    // Draft-only: the file is uploaded to storage for preview, but the URL is
    // kept in the unsaved draft. It reaches the database via Save Questions.
    if (!bearer) {
      setError("Not authorized — sign in as admin.");
      return;
    }
    setImageUploadingSlot(slotIndex);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dir", "exams");
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: bearer as string },
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
      const url = data.url;
      setDrafts((prev) => {
        const cur = prev[slotIndex] ?? emptyDraft();
        return { ...prev, [slotIndex]: { ...cur, questionImage: url } };
      });
      setNotice("Image attached (unsaved — click Save Questions to keep it).");
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setImageUploadingSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Remove the attached image from the unsaved draft (saved data untouched until Save). */
  function handleRemoveImage(slotIndex: number) {
    setDrafts((prev) => {
      const cur = prev[slotIndex];
      if (!cur) return prev;
      return { ...prev, [slotIndex]: { ...cur, questionImage: null } };
    });
  }

  const headerBlock = (
    <div className={embedded ? "rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-sm admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] sm:p-5" : "border-b border-[#dbeafe] bg-white shadow-sm admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547]"}>
      <div className={embedded ? "flex flex-col gap-3" : "mx-auto max-w-4xl flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5"}>
        {!embedded && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-extrabold leading-tight text-[#0b1e3a] admin-dark:text-white sm:text-xl">{exam.title}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500 admin-dark:text-slate-400">Question Management</p>
            </div>
            <button type="button" onClick={onClose} className={buttonSecondaryClass} aria-label="Close">Close</button>
          </div>
        )}

        {/* Language Version × Set workspaces — same permanent IDs and slot order in all four */}
        <div className="space-y-2 rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3 admin-dark:border-[#1e3a65] admin-dark:bg-[#0b1e3a]/40">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#0b1e3a] admin-dark:text-white">Question Version</p>
          <div className="grid grid-cols-2 gap-2">
            {(["bangla", "english"] as LangVersion[]).map((v) => {
              const count = coverage?.coverage[`${v}:${setLabel}`];
              const active = langVersion === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLangVersion(v)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-[#1a3a78] bg-[#1a3a78] text-white shadow-md" : "border-[#dbeafe] bg-white text-[#0b1e3a] hover:border-[#93c5fd] admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100"}`}
                >
                  <span className="block text-sm font-extrabold capitalize">{v} Version</span>
                  <span className={`mt-0.5 block text-[11px] font-semibold ${active ? "text-white/80" : "text-slate-500"}`}>
                    {v === "bangla" ? "Bangla / English / mixed content" : "English content only"}
                    {typeof count === "number" && coverage ? ` · ${count}/${coverage.totalSlots} filled` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#0b1e3a] admin-dark:text-white">Set</p>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as SetLabel[]).map((s) => {
              const count = coverage?.coverage[`${langVersion}:${s}`];
              const active = setLabel === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSetLabel(s)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-emerald-600 bg-emerald-600 text-white shadow-md" : "border-[#dbeafe] bg-white text-[#0b1e3a] hover:border-emerald-400 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100"}`}
                >
                  <span className="block text-sm font-extrabold">Set {s}</span>
                  <span className={`mt-0.5 block text-[11px] font-semibold ${active ? "text-white/80" : "text-slate-500"}`}>
                    {typeof count === "number" && coverage ? `${count}/${coverage.totalSlots} filled` : "Separate question source"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 admin-dark:text-slate-400">
            Editing <span className="font-extrabold capitalize">{langVersion} Version · Set {setLabel}</span> — same permanent Question IDs (Q01..Q{String(totalSlots).padStart(2, "0")}) and order in all four workspaces. No auto-translation between versions. Students are auto-assigned Set A or B server-side and see a randomized order.
          </p>
        </div>

        {/* Paste area — separate per version/set workspace */}
        <div className="space-y-2">
          <p className="text-sm font-extrabold text-[#0b1e3a] admin-dark:text-white">Paste your questions — <span className="capitalize">{langVersion} Version · Set {setLabel}</span></p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Paste ${langVersion === "bangla" ? "Bangla / English / mixed" : "English"} questions for Set ${setLabel}`}
            rows={6}
            className="max-h-[40vh] min-h-[100px] w-full resize-y rounded-xl border border-[#dbeafe] bg-[#f8fbff] p-3.5 text-sm leading-relaxed text-[#0b1e3a] placeholder:text-slate-400 focus:border-[#93c5fd] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100 admin-dark:placeholder:text-slate-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={detectBusy || busy || saveAllBusy}
              onClick={() => void handleDetect()}
              className={`${buttonPrimaryClass} w-full sm:w-auto`}
            >
              {detectBusy ? "Detecting…" : `Detect Questions → ${langVersion === "bangla" ? "Bangla" : "English"} Set ${setLabel}`}
            </button>
            <button
              type="button"
              disabled={detectBusy || busy || saveAllBusy}
              onClick={() => void handleSaveAll()}
              className="w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow hover:bg-emerald-700 disabled:opacity-40 sm:w-auto"
              title="Permanently save all detected/edited questions, answers and images"
            >
              {saveAllBusy ? "Saving…" : `Save Questions${dirtyCount > 0 ? ` (${dirtyCount} unsaved)` : ""}`}
            </button>
            <button
              type="button"
              disabled={detectBusy || busy || saveAllBusy}
              onClick={handleRemoveAll}
              className="w-full rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-40 sm:w-auto admin-dark:border-red-900/40 admin-dark:bg-transparent admin-dark:text-red-300 admin-dark:hover:bg-red-500/10"
              title="Clear detected questions from this page only (saved questions are not deleted)"
            >
              Remove All
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Detected questions stay unsaved until <span className="font-bold">Save Questions</span> is clicked. Leaving this page without saving discards them.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#eef4ff] pt-3 admin-dark:border-[#1e3a65]/60">
          <p className="text-xs font-extrabold text-slate-600 admin-dark:text-slate-300">{progressText} <span className="font-semibold capitalize">({langVersion} Set {setLabel})</span></p>
          <button type="button" disabled={busy} onClick={handleRefresh} className={buttonSecondaryClass} title="Refresh">↻ Refresh</button>
        </div>
      </div>
    </div>
  );

  const innerPaper = (
    <div className="mt-4">
      {/* Detection banner for embedded mode */}
      {(error || notice) && (
        <div className="mb-4 space-y-2">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 admin-dark:border-red-900/40 admin-dark:bg-red-500/10 admin-dark:text-red-300">{error}</p>}
          {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 admin-dark:border-emerald-900/30 admin-dark:bg-emerald-500/10 admin-dark:text-emerald-300">{notice}</p>}
          {Object.keys(detectExistingMap).length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-tight text-amber-700 admin-dark:border-amber-800/50 admin-dark:bg-amber-900/20 admin-dark:text-amber-300">
              ⚠ Already-added questions overwritten: {Object.keys(detectExistingMap).map((k) => `Q${pad(Number(k) + 1)}`).join(", ")}
            </div>
          )}
        </div>
      )}
      <div className={embedded ? "" : "mx-auto max-w-4xl px-3 py-6 sm:px-6"}>
        {questions === null ? (
          <p className={`${cardClass} p-6 text-center text-sm text-slate-500`}>Loading paper…</p>
        ) : totalSlots === 0 ? (
          <div className={`${cardClass} p-6 text-center`}>
            <p className="text-sm font-bold text-[#0b1e3a] admin-dark:text-zinc-100">No slots configured.</p>
            <p className="mt-1 text-xs text-slate-500">Set Total Questions on the exam to generate Q01..QNN slots.</p>
          </div>
        ) : (
          <ol className="space-y-4">
            {displaySlots.map(({ index, q }) => {
              const slotNumber = index + 1;
              const draft = drafts[index] ?? draftFromQuestion(q);
              // Ensure 4 options
              const opts = [...draft.options];
              while (opts.length < 4) opts.push("");
              const isSaving = savingSlot === index;
              const isRefreshing = refreshingSlot === index;
              const warnings = detectWarnings[index];
              const imageUrl = draft.questionImage ?? q?.questionImage ?? null;

              return (
                <li
                  key={q?.id ?? `slot-${index}`}
                  className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${warnings && warnings.length > 0 ? "border-amber-300 admin-dark:border-amber-700" : "border-[#dbeafe] admin-dark:border-[#1e3a65]"} admin-dark:bg-[#112544]`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold tracking-widest text-[#0b1e3a] admin-dark:text-zinc-100">
                      Q{pad(slotNumber)}
                      {q?.id !== null && q?.id !== undefined && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-normal text-slate-500 admin-dark:bg-[#0f2547] admin-dark:text-slate-400" title="Permanent Question ID — identical across versions, sets and students">
                          ID {q.id}
                        </span>
                      )}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {warnings && warnings.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 admin-dark:bg-amber-900/30 admin-dark:text-amber-300">Needs review</span>
                      )}
                      <button
                        type="button"
                        disabled={isRefreshing}
                        onClick={() => void refreshSlot(index)}
                        className="rounded-lg border border-[#dbeafe] bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-[#eff6ff] disabled:opacity-40 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-slate-300"
                        title={`Reload saved Q${pad(slotNumber)} (discards unsaved edits for this question only)`}
                      >
                        {isRefreshing ? "…" : "↻ Refresh"}
                      </button>
                    </div>
                  </div>

                  {/* Question text — edits stay unsaved until Save Questions */}
                  <div className="mt-2">
                    <textarea
                      value={draft.question}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [index]: { ...draft, question: e.target.value, options: opts.slice(0, 4) } }))}
                      placeholder=""
                      rows={2}
                      className="min-h-[48px] w-full resize-y rounded-xl border border-transparent bg-[#f8fbff] p-3 text-sm font-semibold leading-relaxed text-[#0b1e3a] placeholder:text-slate-400 hover:border-[#dbeafe] focus:border-[#93c5fd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100 admin-dark:placeholder:text-slate-500 admin-dark:focus:bg-[#0f2547]"
                    />
                    {imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="Question image" className="mt-3 max-h-48 w-auto rounded-xl border border-neutral-200 object-contain admin-dark:border-zinc-700" />
                    )}
                    {isSaving && <p className="mt-1 text-[11px] font-bold text-slate-400">Saving…</p>}
                  </div>

                  {/* Options — directly editable */}
                  <div className="mt-3 space-y-2">
                    {opts.slice(0, 4).map((opt, oi) => {
                      const isCorrect = draft.correctIndex === oi;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${isCorrect ? "border-[#2f6bce] bg-[#eff6ff] admin-dark:border-[#2f6bce] admin-dark:bg-[#1a3a78]/30" : "border-[#e2e8f0] bg-[#f8fbff] hover:border-[#93c5fd] admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547]"}`}
                        >
                          <button
                            type="button"
                            aria-label={`Mark option ${String.fromCharCode(65 + oi)} as correct`}
                            onClick={() => void handleCorrectChange(index, oi)}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-extrabold ${isCorrect ? "border-[#1a3a78] bg-[#1a3a78] text-white admin-dark:border-[#3b82f6] admin-dark:bg-[#3b82f6]" : "border-slate-300 bg-white text-slate-500 admin-dark:border-zinc-600 admin-dark:bg-[#112544]"}`}
                          >
                            {isCorrect ? "●" : "○"}
                          </button>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${isCorrect ? "bg-[#1a3a78] text-white admin-dark:bg-[#3b82f6]" : "bg-white text-slate-500 border border-slate-200 admin-dark:bg-[#1e3a65] admin-dark:text-slate-300"}`}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const nextOpts = [...opts];
                              nextOpts[oi] = e.target.value;
                              setDrafts((prev) => ({ ...prev, [index]: { ...draft, options: nextOpts.slice(0, 4) } }));
                            }}
                            placeholder=""
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none admin-dark:text-zinc-200 admin-dark:placeholder:text-slate-500"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {warnings && warnings.length > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 admin-dark:border-amber-800/50 admin-dark:bg-amber-900/20">
                      {warnings.map((w, wi) => (
                        <p key={wi} className="text-[11px] font-bold leading-tight text-amber-700 admin-dark:text-amber-300">
                          ⚠ {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Explanation — editable per question */}
                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-500 admin-dark:text-slate-400">
                      Explanation / ব্যাখ্যা
                    </label>
                    <textarea
                      rows={2}
                      value={draft.explanation}
                      onChange={(e) => {
                        setDrafts((prev) => ({ ...prev, [index]: { ...draft, explanation: e.target.value } }));
                      }}
                      placeholder="ব্যাখ্যা বা Explanation লিখুন (ঐচ্ছিক)"
                      className="w-full rounded-lg border border-[#dbeafe] bg-[#f8fbff] px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#2f6bce] focus:ring-2 focus:ring-[#2f6bce]/10 admin-dark:border-[#1e3a65] admin-dark:bg-[#132a4f] admin-dark:text-slate-200 admin-dark:placeholder:text-slate-500 admin-dark:focus:border-[#2f5aa0]"
                    />
                  </div>

                  {/* Image upload — per question (unsaved until Save Questions) */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={imageUploadingSlot === index}
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute("data-slot", String(index));
                          fileInputRef.current.click();
                        }
                      }}
                      className="rounded-lg border border-[#dbeafe] bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-[#eff6ff] disabled:opacity-40 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-slate-300"
                    >
                      {imageUploadingSlot === index ? "Uploading…" : imageUrl ? "Replace Image" : "Image Upload"}
                    </button>
                    {imageUrl && (
                      <>
                        <span className="max-w-[220px] truncate text-xs text-slate-500 admin-dark:text-slate-400">{imageUrl.slice(0, 40)}…</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 admin-dark:border-red-900/40 admin-dark:bg-transparent admin-dark:text-red-300"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );

  const hiddenFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        const slotAttr = e.target.getAttribute("data-slot");
        const slotIndex = slotAttr ? Number(slotAttr) : -1;
        if (file && slotIndex >= 0) void handleImageUpload(file, slotIndex);
      }}
    />
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        {hiddenFileInput}
        {headerBlock}
        {innerPaper}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f1f5f9] admin-dark:bg-[#0b1628]" role="dialog" aria-modal="true">
      {/* Single scroll container — headerBlock scrolls away, detection banner sticks */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain">
        {hiddenFileInput}
        {headerBlock}

        {/* Sticky detection banner — stays visible while scrolling questions */}
        {(error || notice) && (
          <div className="sticky top-0 z-20 space-y-2 bg-[#f1f5f9] px-4 pt-3 sm:px-6 admin-dark:bg-[#0b1628]">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 shadow-md admin-dark:border-red-900/40 admin-dark:bg-red-500/10 admin-dark:text-red-300">{error}</p>}
            {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 shadow-md admin-dark:border-emerald-900/30 admin-dark:bg-emerald-500/10 admin-dark:text-emerald-300">{notice}</p>}
            {Object.keys(detectExistingMap).length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-tight text-amber-700 shadow-md admin-dark:border-amber-800/50 admin-dark:bg-amber-900/20 admin-dark:text-amber-300">
                ⚠ Already-added questions overwritten: {Object.keys(detectExistingMap).map((k) => `Q${pad(Number(k) + 1)}`).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Questions list */}
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          {questions === null ? (
            <p className={`${cardClass} p-6 text-center text-sm text-slate-500`}>Loading paper…</p>
          ) : totalSlots === 0 ? (
            <div className={`${cardClass} p-6 text-center`}>
              <p className="text-sm font-bold text-[#0b1e3a] admin-dark:text-zinc-100">No slots configured.</p>
              <p className="mt-1 text-xs text-slate-500">Set Total Questions on the exam to generate Q01..QNN slots.</p>
            </div>
          ) : (
            <ol className="space-y-4">
              {displaySlots.map(({ index, q }) => {
                const slotNumber = index + 1;
                const draft = drafts[index] ?? draftFromQuestion(q);
                const opts = [...draft.options];
                while (opts.length < 4) opts.push("");
                const isSaving = savingSlot === index;
                const isRefreshing = refreshingSlot === index;
                const warnings = detectWarnings[index];
                const imageUrl = draft.questionImage ?? q?.questionImage ?? null;

                return (
                  <li
                    key={q?.id ?? `slot-${index}`}
                    className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${warnings && warnings.length > 0 ? "border-amber-300 admin-dark:border-amber-700" : "border-[#dbeafe] admin-dark:border-[#1e3a65]"} admin-dark:bg-[#112544]`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-extrabold tracking-widest text-[#0b1e3a] admin-dark:text-zinc-100">
                        Q{pad(slotNumber)}
                        {q?.id !== null && q?.id !== undefined && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-normal text-slate-500 admin-dark:bg-[#0f2547] admin-dark:text-slate-400" title="Permanent Question ID — identical across versions, sets and students">
                            ID {q.id}
                          </span>
                        )}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        {warnings && warnings.length > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 admin-dark:bg-amber-900/30 admin-dark:text-amber-300">Needs review</span>
                        )}
                        <button
                          type="button"
                          disabled={isRefreshing}
                          onClick={() => void refreshSlot(index)}
                          className="rounded-lg border border-[#dbeafe] bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-[#eff6ff] disabled:opacity-40 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-slate-300"
                          title={`Reload saved Q${pad(slotNumber)} (discards unsaved edits for this question only)`}
                        >
                          {isRefreshing ? "…" : "↻ Refresh"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2">
                      <textarea
                        value={draft.question}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [index]: { ...draft, question: e.target.value, options: opts.slice(0, 4) } }))}
                        placeholder=""
                        rows={2}
                        className="min-h-[48px] w-full resize-y rounded-xl border border-transparent bg-[#f8fbff] p-3 text-sm font-semibold leading-relaxed text-[#0b1e3a] placeholder:text-slate-400 hover:border-[#dbeafe] focus:border-[#93c5fd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100 admin-dark:placeholder:text-slate-500 admin-dark:focus:bg-[#0f2547]"
                      />
                      {imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="Question image" className="mt-3 max-h-48 w-auto rounded-xl border border-neutral-200 object-contain admin-dark:border-zinc-700" />
                      )}
                      {isSaving && <p className="mt-1 text-[11px] font-bold text-slate-400">Saving…</p>}
                    </div>

                    <div className="mt-3 space-y-2">
                      {opts.slice(0, 4).map((opt, oi) => {
                        const isCorrect = draft.correctIndex === oi;
                        return (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${isCorrect ? "border-[#2f6bce] bg-[#eff6ff] admin-dark:border-[#2f6bce] admin-dark:bg-[#1a3a78]/30" : "border-[#e2e8f0] bg-[#f8fbff] hover:border-[#93c5fd] admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547]"}`}
                          >
                            <button
                              type="button"
                              aria-label={`Mark option ${String.fromCharCode(65 + oi)} as correct`}
                              onClick={() => void handleCorrectChange(index, oi)}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-extrabold ${isCorrect ? "border-[#1a3a78] bg-[#1a3a78] text-white admin-dark:border-[#3b82f6] admin-dark:bg-[#3b82f6]" : "border-slate-300 bg-white text-slate-500 admin-dark:border-zinc-600 admin-dark:bg-[#112544]"}`}
                            >
                              {isCorrect ? "●" : "○"}
                            </button>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${isCorrect ? "bg-[#1a3a78] text-white admin-dark:bg-[#3b82f6]" : "bg-white text-slate-500 border border-slate-200 admin-dark:bg-[#1e3a65] admin-dark:text-slate-300"}`}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <input
                              value={opt}
                              onChange={(e) => {
                                const nextOpts = [...opts];
                                nextOpts[oi] = e.target.value;
                                setDrafts((prev) => ({ ...prev, [index]: { ...draft, options: nextOpts.slice(0, 4) } }));
                              }}
                              placeholder=""
                              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none admin-dark:text-zinc-200 admin-dark:placeholder:text-slate-500"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {warnings && warnings.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 admin-dark:border-amber-800/50 admin-dark:bg-amber-900/20">
                        {warnings.map((w, wi) => (
                          <p key={wi} className="text-[11px] font-bold leading-tight text-amber-700 admin-dark:text-amber-300">
                            ⚠ {w}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Image upload — per question (unsaved until Save Questions) */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={imageUploadingSlot === index}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.setAttribute("data-slot", String(index));
                            fileInputRef.current.click();
                          }
                        }}
                        className="rounded-lg border border-[#dbeafe] bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-[#eff6ff] disabled:opacity-40 admin-dark:border-[#1e3a65] admin-dark:bg-[#0f2547] admin-dark:text-slate-300"
                      >
                        {imageUploadingSlot === index ? "Uploading…" : imageUrl ? "Replace Image" : "Image Upload"}
                      </button>
                      {imageUrl && (
                        <>
                          <span className="max-w-[220px] truncate text-xs text-slate-500 admin-dark:text-slate-400">{imageUrl.slice(0, 40)}…</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 admin-dark:border-red-900/40 admin-dark:bg-transparent admin-dark:text-red-300"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-[#dbeafe] bg-white p-3 text-center admin-dark:border-[#1e3a65] admin-dark:bg-[#112544]">
        <button type="button" onClick={onClose} className={buttonSecondaryClass}>Close</button>
      </div>
    </div>
  );
}
