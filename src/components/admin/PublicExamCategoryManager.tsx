"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import ExamManager, {
  type Exam,
  type FixedCategory,
} from "@/components/admin/ExamManager";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import {
  useAdminGate,
  hasPublicExamAccess,
} from "@/components/admin/admin-ui";
import { examCategoryLabel, type ExamCategory } from "@/lib/public-exams";
import {
  distinctSubjects,
  matchMedicalPracticeSubject,
  MEDICAL_PRACTICE_SUBJECTS,
  medicalPracticeSubjectTitle,
  OTHER_PRACTICE_SUBJECT_KEY,
  practiceUsesSubjectCards,
  resolvePublicCategoryKey,
} from "@/lib/public-exam-structure";

type ModeTab = "live" | "practice";

/**
 * One Public Exam category's exam list (Category → Exam, no Course layer).
 * SAME information architecture as the Main Website:
 * Category → [ Live Exam | Practice Exam ] (default: Live), with the same
 * category-specific Practice subject navigation.
 *
 * Reuses the SAME ExamManager card/edit/question system — all management
 * controls (Add/Edit/Delete/Questions/Publish) stay intact; this only
 * organizes how the existing exams are displayed and managed.
 */
export default function PublicExamCategoryManager({
  category,
}: {
  category: FixedCategory & { slug?: string };
}) {
  const gate = useAdminGate();
  const label = examCategoryLabel(category);
  const [tab, setTab] = useState<ModeTab>("live");
  const [subject, setSubject] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Exam[]>([]);

  const handleExams = useCallback((list: Exam[]) => {
    setSnapshot(list);
  }, []);

  const categoryKey: ExamCategory | null = useMemo(
    () =>
      resolvePublicCategoryKey({
        slug: category.slug ?? null,
        name: category.name,
        id: category.id,
      }),
    [category.slug, category.name, category.id],
  );

  const practiceExams = useMemo(
    () =>
      snapshot.filter(
        (exam) => exam.examMode === "practice" || exam.kind === "practice",
      ),
    [snapshot],
  );

  // Same subject-layer rule as the Main Website — only Medical Admission
  // gets the fixed 8 subject cards; all other categories show exams directly.
  const useSubjectCards = categoryKey
    ? practiceUsesSubjectCards(categoryKey, practiceExams)
    : false;
  const isMedical = categoryKey === "medical-admission";

  const practiceSubjects = useMemo(() => {
    if (!useSubjectCards) return [];
    if (isMedical) {
      const counts = new Map<string, number>();
      let other = 0;
      for (const exam of practiceExams) {
        const key = matchMedicalPracticeSubject(exam.subject);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
        else other += 1;
      }
      const cards: { key: string; title: string; count: number }[] =
        MEDICAL_PRACTICE_SUBJECTS.map((item) => ({
        key: item.key,
        title: item.title,
        count: counts.get(item.key) ?? 0,
      }));
      if (other > 0) {
        cards.push({
          key: OTHER_PRACTICE_SUBJECT_KEY,
          title: medicalPracticeSubjectTitle(OTHER_PRACTICE_SUBJECT_KEY),
          count: other,
        });
      }
      return cards;
    }
    return distinctSubjects(practiceExams).map((title) => ({
      key: title,
      title,
      count: practiceExams.filter((exam) => exam.subject === title).length,
    }));
  }, [useSubjectCards, isMedical, practiceExams]);

  function selectTab(next: ModeTab) {
    setTab(next);
    setSubject(null);
  }

  if (!gate.ready) {
    return gate.denied ? (
      <AccessMessage title="Administrators only" message="Exam management is restricted to authorized administrators." actionLabel="Back to Admin Home" actionHref="/admin" />
    ) : (
      <AccessLoading label="Loading exams…" />
    );
  }

  if (!hasPublicExamAccess(gate)) {
    return (
      <AccessMessage
        title="No Permission"
        message="Public Exam Control access is required to manage this category's exams. Contact an Admin to grant it."
        actionLabel="Back to Admin Home"
        actionHref="/admin"
      />
    );
  }

  const showSubjectCards =
    tab === "practice" && useSubjectCards && !subject;
  // When a subject layer exists and nothing is selected yet, show the
  // subject cards instead of the full management list.
  const listVisible = !showSubjectCards;

  return (
    <div>
      <nav className="mx-auto flex max-w-4xl items-center gap-2 px-4 pt-6 text-xs font-semibold text-slate-500 sm:px-6">
        <Link href="/admin/public-exam" className="transition hover:text-[#1a3a78]">
          Public Exam Control
        </Link>
        <span aria-hidden="true">→</span>
        <span className="text-[#0b1e3a] admin-dark:text-zinc-100">{label}</span>
      </nav>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Live Exam | Practice Exam — one segmented filter row (default: Live) */}
        <div
          role="tablist"
          aria-label="Exam type"
          className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-[#dbeafe] admin-dark:bg-[#112544] admin-dark:ring-[#1e3a65]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "live"}
            onClick={() => selectTab("live")}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide transition sm:text-sm ${
              tab === "live"
                ? "bg-[#0b1e3a] text-white shadow admin-dark:bg-white admin-dark:text-[#0b1e3a]"
                : "text-slate-500 hover:bg-[#f1f5f9] hover:text-[#0b1e3a] admin-dark:text-slate-400 admin-dark:hover:bg-white/5 admin-dark:hover:text-white"
            }`}
          >
            Live Exam
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "practice"}
            onClick={() => selectTab("practice")}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide transition sm:text-sm ${
              tab === "practice"
                ? "bg-[#0b1e3a] text-white shadow admin-dark:bg-white admin-dark:text-[#0b1e3a]"
                : "text-slate-500 hover:bg-[#f1f5f9] hover:text-[#0b1e3a] admin-dark:text-slate-400 admin-dark:hover:bg-white/5 admin-dark:hover:text-white"
            }`}
          >
            Practice Exam
          </button>
        </div>

        {showSubjectCards && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {practiceSubjects.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSubject(item.key)}
                className="group flex items-center gap-3 rounded-2xl border border-[#dbeafe] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2f6bce]/50 hover:shadow admin-dark:border-[#1e3a65] admin-dark:bg-[#112544]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0b1e3a]/5 text-[#0b1e3a] transition group-hover:bg-[#0b1e3a] group-hover:text-white admin-dark:bg-white/10 admin-dark:text-white admin-dark:group-hover:bg-white admin-dark:group-hover:text-[#0b1e3a]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#0b1e3a] admin-dark:text-zinc-100">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500 admin-dark:text-slate-400">
                    {item.count} practice exam{item.count === 1 ? "" : "s"}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0b1e3a] admin-dark:group-hover:text-white">
                  →
                </span>
              </button>
            ))}
          </div>
        )}

      </div>

      {listVisible && (
        <ExamManager
          title={`${label} — Public Exams`}
          description={`Only the public exams belonging to “${label}” are listed here. Every exam created with + New Exam automatically receives this category and appears under it on the Main Website.`}
          fixedCategory={category}
          controlledMode={tab}
          controlledSubjectKey={useSubjectCards ? subject : null}
          publicCategoryKey={categoryKey}
          hideModeTabs
          onExamsChange={handleExams}
        />
      )}
    </div>
  );
}
