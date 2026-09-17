"use client";

import Link from "next/link";
import ExamManager, { type FixedCategory } from "@/components/admin/ExamManager";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import {
  useAdminGate,
  hasPublicExamAccess,
} from "@/components/admin/admin-ui";
import { examCategoryLabel } from "@/lib/public-exams";

/**
 * One Public Exam category's exam list (Category → Exam, no Course layer).
 * Reuses the SAME ExamManager card/edit/question system for every category
 * — nothing is duplicated per category and no category management appears
 * here. The exam label never uses the word "Course".
 *
 * Permission inheritance: same entry check as the parent Public Exam
 * Control AND the exam APIs (managePublicExam | manageExams). A manager
 * holding either permission keeps full allowed management access inside
 * the category; anyone without both is denied here instead of hitting
 * confusing per-action failures deeper in the flow.
 */
export default function PublicExamCategoryManager({
  category,
}: {
  category: FixedCategory;
}) {
  const gate = useAdminGate();
  const label = examCategoryLabel(category);

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

  return (
    <div>
      <nav className="mx-auto flex max-w-4xl items-center gap-2 px-4 pt-6 text-xs font-semibold text-slate-500 sm:px-6">
        <Link href="/admin/public-exam" className="transition hover:text-[#1a3a78]">
          Public Exam Control
        </Link>
        <span aria-hidden="true">→</span>
        <span className="text-[#0b1e3a] admin-dark:text-zinc-100">{label}</span>
      </nav>
      <ExamManager
        title={`${label} — Public Exams`}
        description={`Only the public exams belonging to “${label}” are listed here. Every exam created with + New Exam automatically receives this category and appears under it on the Main Website.`}
        fixedCategory={category}
      />
    </div>
  );
}
