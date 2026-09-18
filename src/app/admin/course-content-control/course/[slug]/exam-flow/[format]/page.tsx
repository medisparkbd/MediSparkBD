"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { use } from "react";
import ExamManager from "@/components/admin/ExamManager";
import { FLOW5_FORMATS, isFlow5Format, type Flow5Format } from "@/lib/flow5-shared";

// Admin → Course Content Control → Course → Paper/Subject Final / Final Model → Exam/Content.
// Scoped manager: only this course's exams in this category.
// (Topic-wise branches to the subject picker instead.)
const FINAL_FORMATS: Flow5Format[] = ["paper-final", "subject-final", "final-model"];

export default function FormatExamsPage({
  params,
}: {
  params: Promise<{ slug: string; format: string }>;
}) {
  const { slug, format } = use(params);

  const courseName = decodeURIComponent(slug).replace(/-/g, " ");
  const base = `/admin/course-content-control/course/${encodeURIComponent(slug)}`;

  if (format === "topic-wise") {
    redirect(`${base}/exam-flow/topic-wise`);
  }

  if (!isFlow5Format(format) || !FINAL_FORMATS.includes(format as Flow5Format)) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-600 admin-dark:text-red-400">
          Unknown exam category.
        </p>
      </section>
    );
  }

  const meta = FLOW5_FORMATS.find((f) => f.key === format);

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Link href="/admin/course-content-control" className="font-semibold text-slate-500 transition hover:text-[#1a3a78] admin-dark:text-slate-400 admin-dark:hover:text-white">
          Course Content Control
        </Link>
        <span className="text-slate-400 admin-dark:text-slate-500">/</span>
        <Link href={base} className="font-semibold capitalize text-slate-500 transition hover:text-[#1a3a78] admin-dark:text-slate-400 admin-dark:hover:text-white">
          {courseName}
        </Link>
      </div>
      <ExamManager
        title={meta?.title ?? "Course Exams"}
        description={`Add, edit, delete and manage ${meta?.title ?? "exams"} for ${courseName}. Open an exam's Questions tab to manage its questions, options, answers and images.`}
        kindFilter="enrolled"
        allowEnrolled
        fixedCourse={{ slug, name: courseName }}
        fixedFormat={format as Flow5Format}
      />
    </section>
  );
}
