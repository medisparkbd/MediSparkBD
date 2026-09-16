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

  // Local draft for inline editing — mirrors DB but allows immediate typing before save
  const [drafts, setDrafts] = useState<Record<number, { question: string; options: string[]; correctIndex: number; explanation: string }>>({});

  useEffect(() => {
    // Sync drafts when questions load (keep user edits if already drafting)
    if (!questions) return;
    const next: Record<number, { question: string; options: string[]; correctIndex: number; explanation: string }> = {};
    for (let i = 0; i < totalSlots; i++) {
      const q = i < questions.length ? questions[i] : null;
      if (q && q.id !== null) {
        // Preserve existing draft if user is mid-edit (has unsaved changes) — only fill if missing
        if (drafts[i]) {
          next[i] = drafts[i];
        } else {
          const opts = q.options.length >= 4 ? q.options.slice(0, 4) : [...q.options, ...EMPTY_OPTIONS.slice(q.options.length)];
          while (opts.length < 4) opts.push("");
          next[i] = { question: q.question || "", options: opts.slice(0, 4), correctIndex: q.correctIndex ?? 0, explanation: q.explanation ?? "" };
        }
      } else {
        if (drafts[i]) {
          next[i] = drafts[i];
        } else {
          next[i] = { question: q?.question || "", options: q?.options?.slice(0, 4) ?? [...EMPTY_OPTIONS], correctIndex: q?.correctIndex ?? 0, explanation: q?.explanation ?? "" };
          while (next[i].options.length < 4) next[i].options.push("");
          next[i].options = next[i].options.slice(0, 4);
        }
      }
    }
    // Only update if drafts empty or totalSlots changed; avoid overwriting active edits on every load
    // We merge: keep existing drafts for slots that already have draft
    setDrafts((prev) => {
      const merged: Record<number, { question: string; options: string[]; correctIndex: number; explanation: string }> = { ...prev };
      for (let i = 0; i < totalSlots; i++) {
        if (!merged[i]) merged[i] = next[i];
      }
      // Remove extra indices beyond totalSlots
      Object.keys(merged).forEach((k) => {
        if (Number(k) >= totalSlots) delete merged[Number(k)];
      });
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, totalSlots]);

  async function persistSlot(slotIndex: number) {
    const draft = drafts[slotIndex];
    if (!draft) return;
    const slot = displaySlots[slotIndex];
    const existing = slot?.q;

    const qText = draft.question.trim();
    const opts = draft.options.map((o) => o.trim());

    // Allow saving incomplete slots as draft — but require at least question or any option to avoid blank saves
    // For blank slots the admin can just type and we save on blur; skip if completely empty
    const anyOption = opts.some((o) => o.length > 0);
    if (!qText && !anyOption) return;
    // Enforce minimal validation only when both present; let backend handle full validation
    // We save even if only question typed (will be incomplete but stored)

    // Prepare options padded to 4
    const saveOptions = [...opts];
    while (saveOptions.length < 4) saveOptions.push("");
    const finalOptions = saveOptions.slice(0, 4);

    // Ensure correctIndex points to non-empty option if possible
    let ci = draft.correctIndex;
    if (ci < 0 || ci >= 4) ci = 0;
    // Don't auto-correct here — allow saving even if correct points to empty (backend will reject)
    // But we keep as is

    setSavingSlot(slotIndex);
    setError(null);
    try {      const order = slotIndex + 1;
      const marksPerQ = Number((exam.marksPerQuestion ?? 1) as number) || 1;
      const body: Record<string, unknown> = {
        ...(existing && existing.id !== null ? { id: existing.id } : {}),
        examId: exam.id,
        // Version/Set cell — the permanent slot ID stays the same.
        version: langVersion,
        set: setLabel,
        subject: existing?.subject || exam.subject || "",
        question: qText || " ",
        questionImage: existing?.questionImage || null,
        question_image: existing?.questionImage || null,
        options: finalOptions,
        correctIndex: ci,
      explanation: draft.explanation || existing?.explanation || null,
        marks: (existing?.marks ?? marksPerQ) as number,
        isActive: true,
        order,
      };
      // If question is blank placeholder, use " " to pass server min length; but we already early-returned if empty
      if (!qText) body.question = finalOptions.find((o) => o) ? `Question ${pad(slotIndex + 1)}` : qText;
      // If still empty, skip save
      if (!String(body.question).trim() || String(body.question).trim().length < 1) return;
      // Server requires >=3 chars and 2 options; if not met, still try but handle error quietly
      const res = await fetch("/api/admin/exams/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        // Only surface error if slot has meaningful content
        if (qText.length >= 2 || anyOption) setError(data?.error ?? "Failed to save.");
        return;
      }
      await load();
      void loadCoverage();
      onChanged?.();
    } finally {
      setSavingSlot(null);
    }
  }

  async function handleDetect() {
    setError(null);
    setNotice(null);
    setDetectWarnings({});
    setDetectExistingMap({});
    // Capture workspace at call time — if user switches tabs mid-detect,
    // the final load() still refreshes the correct workspace.
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

      // Fully replace drafts — clear ALL old drafts first, then set only the newly detected ones
      const newDrafts: Record<number, { question: string; options: string[]; correctIndex: number; explanation: string }> = {};
      for (let i = 0; i < count; i++) {
        const p = useParsed[i];
        const ci = p.correctIndex !== null && p.correctIndex >= 0 && p.correctIndex < 4 ? p.correctIndex : -1;
        newDrafts[i] = {
          question: p.question,
          options: p.options.slice(0, 4) as string[],
          correctIndex: ci >= 0 ? ci : -1,
          explanation: p.explanation ?? "",
        };
      }
      setDrafts(newDrafts);

      // Persist sequentially to preserve order
      let persisted = 0;
      let skippedDueToMissingAnswer = 0;
      for (let i = 0; i < count; i++) {
        const p = useParsed[i];
        // If correctIndex is null, we persist with fallback 0 but keep warning; admin must verify
        // To avoid backend rejection, map -1 to 0 on persist but retain warning state
        const ciPersist = p.correctIndex !== null && p.correctIndex >= 0 && p.correctIndex < 4 ? p.correctIndex : 0;
        const hasMissingAnswer = p.correctIndex === null;
        if (hasMissingAnswer) skippedDueToMissingAnswer += 1;
        const draft = { question: p.question, options: p.options.slice(0, 4) as string[], correctIndex: ciPersist, explanation: p.explanation ?? "" };
        // Validate before persist: need at least question and 2 options
        const qTrim = draft.question.trim();
        const filledOpts = draft.options.filter((o) => o.trim()).length;
        if (qTrim.length < 3 || filledOpts < 2) continue;
        // eslint-disable-next-line no-await-in-loop
        await persistSlotWithData(i, draft);
        persisted += 1;
      }
      await load(detectVersion, detectSet);
      onChanged?.();
      void loadCoverage();
      let msg = `Detected ${useParsed.length} question${useParsed.length === 1 ? "" : "s"} — filled Q01–Q${pad(count)} in ${detectVersion} Set ${detectSet}.`;
      if (extra > 0) msg += ` Warning: ${extra} extra question${extra === 1 ? "" : "s"} detected beyond ${totalSlots} slots (not saved).`;
      if (skippedDueToMissingAnswer > 0) msg += ` ${skippedDueToMissingAnswer} question${skippedDueToMissingAnswer === 1 ? "" : "s"} have no confident answer — please verify.`;
      const reviewCount = Object.keys(warnings).length;
      if (reviewCount > 0) msg += ` ${reviewCount} need review.`;
      const existingCount = Object.keys(existingMap).length;
      if (existingCount > 0) msg += ` ${existingCount} already had content — overwritten.`;
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

  async function persistSlotWithData(slotIndex: number, draft: { question: string; options: string[]; correctIndex: number; explanation: string }) {
    const slot = displaySlots[slotIndex];
    const existing = slot?.q;
    const order = slotIndex + 1;
    const marksPerQ = Number((exam.marksPerQuestion ?? 1) as number) || 1;
    const finalOptions = [...draft.options];
    while (finalOptions.length < 4) finalOptions.push("");
    const body: Record<string, unknown> = {
      ...(existing && existing.id !== null ? { id: existing.id } : {}),
      examId: exam.id,
      version: langVersion,
      set: setLabel,
      subject: existing?.subject || exam.subject || "",
      question: draft.question.trim(),
      questionImage: null,
      question_image: null,
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
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new Error(data?.error ?? "Failed to save detected question.");
  }

  async function handleCorrectChange(slotIndex: number, newIdx: number) {
    setDrafts((prev) => ({ ...prev, [slotIndex]: { ...prev[slotIndex], correctIndex: newIdx } }));
    setDetectWarnings((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
    // Persist immediately
    const draft = drafts[slotIndex];
    if (!draft) return;
    const updated = { ...draft, correctIndex: newIdx };
    setDrafts((prev) => ({ ...prev, [slotIndex]: updated }));
    // Capture workspace — setTimeout runs async, user may have switched tabs
    const cv = langVersion;
    const cs = setLabel;
    // slight delay to ensure state, then persist
    setTimeout(() => {
      setDrafts((curr) => {
        const cur = curr[slotIndex];
        if (cur) void persistSlotWithData(slotIndex, cur).then(() => {
          void load(cv, cs);
          void loadCoverage();
          onChanged?.();
        }).catch(() => setError("Failed to update correct answer."));
        return curr;
      });
    }, 0);
  }

  async function handleImageUpload(file: File, slotIndex: number) {
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
      // Save image to question
      const slot = displaySlots[slotIndex];
      const q = slot?.q;
      const draft = drafts[slotIndex];
      // Use existing or draft data
      const body: Record<string, unknown> = {
        ...(q && q.id !== null ? { id: q.id } : {}),
        examId: exam.id,
        version: langVersion,
        set: setLabel,
        subject: q?.subject || exam.subject || "",
        question: draft?.question?.trim() || q?.question || `Question ${pad(slotIndex + 1)}`,
        questionImage: data.url,
        question_image: data.url,
        options: draft ? draft.options.map((o) => o.trim()).slice(0, 4) : q?.options ?? [...EMPTY_OPTIONS],
        correctIndex: draft?.correctIndex ?? q?.correctIndex ?? 0,
        explanation: q?.explanation || null,
        marks: (q?.marks ?? Number(exam.marksPerQuestion ?? 1) ?? 1) || 1,
        isActive: true,
        order: slotIndex + 1,
      };
      // Ensure options valid
      while ((body.options as string[]).length < 4) (body.options as string[]).push("");
      if (!(body.options as string[]).some((o) => String(o).trim())) {
        (body.options as string[]) = [...EMPTY_OPTIONS];
      }
      // If question still empty, provide placeholder to allow image-only save
      if (!String(body.question).trim()) body.question = `Question ${pad(slotIndex + 1)}`;
      // Server requires at least 3 chars and 2 options — if slot is empty we still save with placeholder options
      // Fill placeholder options if empty
      const opts = body.options as string[];
      if (opts.filter((o) => String(o).trim()).length < 2) {
        // Keep empty will fail; show error instead of saving
        setError("Add question text and at least two options before attaching an image.");
        return;
      }
      const saveRes = await fetch("/api/admin/exams/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
      });
      const saveData = (await saveRes.json().catch(() => null)) as { error?: string } | null;
      if (!saveRes.ok) throw new Error(saveData?.error || "Failed to save image.");
      await load();
      void loadCoverage();
      onChanged?.();
      setNotice("Image uploaded.");
      setTimeout(() => setNotice(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setImageUploadingSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          <button
            type="button"
            disabled={detectBusy || busy}
            onClick={() => void handleDetect()}
            className={`${buttonPrimaryClass} w-full sm:w-auto`}
          >
            {detectBusy ? "Detecting…" : `Detect Questions → ${langVersion === "bangla" ? "Bangla" : "English"} Set ${setLabel}`}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#eef4ff] pt-3 admin-dark:border-[#1e3a65]/60">
          <p className="text-xs font-extrabold text-slate-600 admin-dark:text-slate-300">{progressText} <span className="font-semibold capitalize">({langVersion} Set {setLabel})</span></p>
          <button type="button" disabled={busy} onClick={() => { void load(); void loadCoverage(); }} className={buttonSecondaryClass} title="Refresh">↻ Refresh</button>
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
              const draft = drafts[index] ?? { question: q?.question || "", options: (q?.options?.slice(0, 4) ?? [...EMPTY_OPTIONS]), correctIndex: (q?.correctIndex ?? 0) };
              // Ensure 4 options
              const opts = [...draft.options];
              while (opts.length < 4) opts.push("");
              const isSaving = savingSlot === index;
              const warnings = detectWarnings[index];

              return (
                <li
                  key={q?.id ?? `slot-${index}`}
                  className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${warnings && warnings.length > 0 ? "border-amber-300 admin-dark:border-amber-700" : "border-[#dbeafe] admin-dark:border-[#1e3a65]"} admin-dark:bg-[#112544]`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold tracking-widest text-[#0b1e3a] admin-dark:text-zinc-100">
                      Q{pad(slotNumber)}
                      {q?.id !== null && q?.id !== undefined && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-normal text-slate-500 admin-dark:bg-[#0f2547] admin-dark:text-slate-400" title="Permanent Question ID — identical across versions, sets and students">
                          ID {q.id}
                        </span>
                      )}
                    </p>
                    {warnings && warnings.length > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 admin-dark:bg-amber-900/30 admin-dark:text-amber-300">Needs review</span>
                    )}
                  </div>

                  {/* Question text — click to edit */}
                  <div className="mt-2">
                    <textarea
                      value={draft.question}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [index]: { ...draft, question: e.target.value, options: opts.slice(0, 4) } }))}
                      onBlur={() => void persistSlot(index)}
                      placeholder=""
                      rows={2}
                      className="min-h-[48px] w-full resize-y rounded-xl border border-transparent bg-[#f8fbff] p-3 text-sm font-semibold leading-relaxed text-[#0b1e3a] placeholder:text-slate-400 hover:border-[#dbeafe] focus:border-[#93c5fd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100 admin-dark:placeholder:text-slate-500 admin-dark:focus:bg-[#0f2547]"
                    />
                    {q?.questionImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.questionImage} alt="Question image" className="mt-3 max-h-48 w-auto rounded-xl border border-neutral-200 object-contain admin-dark:border-zinc-700" />
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
                            onBlur={() => void persistSlot(index)}
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

                  {/* Image upload — small, per question */}
                  <div className="mt-3 flex items-center gap-2">
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
                      {imageUploadingSlot === index ? "Uploading…" : "Image Upload"}
                    </button>
                    {q?.questionImage && (
                      <span className="truncate text-xs text-slate-500 admin-dark:text-slate-400">{q.questionImage.slice(0, 32)}…</span>
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
                const draft = drafts[index] ?? { question: q?.question || "", options: (q?.options?.slice(0, 4) ?? [...EMPTY_OPTIONS]), correctIndex: (q?.correctIndex ?? 0) };
                const opts = [...draft.options];
                while (opts.length < 4) opts.push("");
                const isSaving = savingSlot === index;
                const warnings = detectWarnings[index];

                return (
                  <li
                    key={q?.id ?? `slot-${index}`}
                    className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${warnings && warnings.length > 0 ? "border-amber-300 admin-dark:border-amber-700" : "border-[#dbeafe] admin-dark:border-[#1e3a65]"} admin-dark:bg-[#112544]`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold tracking-widest text-[#0b1e3a] admin-dark:text-zinc-100">
                        Q{pad(slotNumber)}
                        {q?.id !== null && q?.id !== undefined && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-normal text-slate-500 admin-dark:bg-[#0f2547] admin-dark:text-slate-400" title="Permanent Question ID — identical across versions, sets and students">
                            ID {q.id}
                          </span>
                        )}
                      </p>
                      {warnings && warnings.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 admin-dark:bg-amber-900/30 admin-dark:text-amber-300">Needs review</span>
                      )}
                    </div>

                    <div className="mt-2">
                      <textarea
                        value={draft.question}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [index]: { ...draft, question: e.target.value, options: opts.slice(0, 4) } }))}
                        onBlur={() => void persistSlot(index)}
                        placeholder=""
                        rows={2}
                        className="min-h-[48px] w-full resize-y rounded-xl border border-transparent bg-[#f8fbff] p-3 text-sm font-semibold leading-relaxed text-[#0b1e3a] placeholder:text-slate-400 hover:border-[#dbeafe] focus:border-[#93c5fd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] admin-dark:bg-[#0f2547] admin-dark:text-zinc-100 admin-dark:placeholder:text-slate-500 admin-dark:focus:bg-[#0f2547]"
                      />
                      {q?.questionImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.questionImage} alt="Question image" className="mt-3 max-h-48 w-auto rounded-xl border border-neutral-200 object-contain admin-dark:border-zinc-700" />
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
                              onBlur={() => void persistSlot(index)}
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
