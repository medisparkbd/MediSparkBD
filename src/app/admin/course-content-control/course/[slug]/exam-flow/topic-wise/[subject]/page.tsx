"use client";

import Link from "next/link";
import { use } from "react";
import ExamManager from "@/components/admin/ExamManager";
import { flow5SubjectTitle, isFlow5SubjectKey } from "@/lib/flow5-shared";

// Admin → Course Content Control → Course → Topic-wise → Subject → Exam/Content.
// Scoped manager: only this course's topic-wise exams for this subject.
// Questions are managed from each exam's Questions tab (same editor as elsewhere).
export default function TopicSubjectExamsPage({
  params,
}: {
  params: Promise<{ slug: string; subject: string }>;
}) {
  const { slug, subject } = use(params);

  const courseName = decodeURIComponent(slug).replace(/-/g, " ");
  const base = `/admin/course-content-control/course/${encodeURIComponent(slug)}`;

  if (!isFlow5SubjectKey(subject)) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`${base}/exam-flow/topic-wise`} className="text-sm font-semibold text-neutral-400 hover:text-[#1a3a78]">
          ← Subjects
        </Link>
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-400">
          Unknown subject.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Link href="/admin/course-content-control" className="font-semibold text-neutral-400 hover:text-[#1a3a78]">
          Course Content Control
        </Link>
        <span className="text-neutral-600">/</span>
        <Link href={base} className="font-semibold capitalize text-neutral-400 hover:text-[#1a3a78]">
          {courseName}
        </Link>
        <span className="text-neutral-600">/</span>
        <Link href={`${base}/exam-flow/topic-wise`} className="font-semibold text-neutral-400 hover:text-[#1a3a78]">
          Topic-wise Exam
        </Link>
      </div>
      <ExamManager
        title={`Topic-wise · ${flow5SubjectTitle(subject)}`}
        description={`Add, edit, delete and manage topic-wise exams for ${courseName} — ${flow5SubjectTitle(subject)}. Open an exam's Questions tab to manage its questions, options, answers and images.`}
        kindFilter="enrolled"
        allowEnrolled
        fixedCourse={{ slug, name: courseName }}
        fixedFormat="topic-wise"
        fixedTopicSubject={subject}
      />
    </section>
  );
}
