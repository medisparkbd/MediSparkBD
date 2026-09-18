"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading } from "@/components/auth/AccessGuard";
import { FLOW5_SUBJECTS, type Flow5SubjectKey } from "@/lib/flow5-shared";

// Admin → Course Content Control → Course → Topic-wise Exam → 8 Subject Cards
// (same subjects students see). Each subject opens its exam/content manager.
export default function TopicSubjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, authLoading } = useAuth();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/exams?kind=enrolled&courseId=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            exams?: { examFormat?: string | null; topicSubject?: string | null }[];
          };
          const next: Record<string, number> = {};
          for (const exam of data.exams ?? []) {
            if ((exam.examFormat ?? "") !== "topic-wise" || !exam.topicSubject) continue;
            next[exam.topicSubject] = (next[exam.topicSubject] ?? 0) + 1;
          }
          setCounts(next);
        }
      } catch {
        // counts stay hidden — cards still work
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, slug]);

  if (authLoading || !user) return <AccessLoading label="Loading subjects…" />;

  const courseName = decodeURIComponent(slug).replace(/-/g, " ");
  const base = `/admin/course-content-control/course/${encodeURIComponent(slug)}`;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary-500">Topic-wise Exam</p>
      <h1 className="mt-1 break-words text-2xl font-extrabold capitalize text-[#0b1e3a] admin-dark:text-white">
        Select Subject
      </h1>
      <p className="mt-1 text-xs text-slate-500 admin-dark:text-slate-400">
        Same 8 subjects students see on the Main Website. Open a subject to Add / Edit / Delete / Manage its topic-wise exams and questions.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FLOW5_SUBJECTS.map((subject: { key: Flow5SubjectKey; title: string }, index: number) => (
          <Link
            key={subject.key}
            href={`${base}/exam-flow/topic-wise/${subject.key}`}
            className="group flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#dbeafe] bg-white p-6 text-center shadow-sm shadow-[#0b1e3a]/5 transition hover:-translate-y-0.5 hover:border-primary-600/60 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600/15 text-sm font-black text-primary-400 transition group-hover:bg-primary-600 group-hover:text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-extrabold leading-snug text-[#0b1e3a] group-hover:text-[#1a3a78] admin-dark:text-white">
              {subject.title}
            </span>
            {counts && (
              <span className="rounded-full border border-ink/10 bg-ink/5 px-2.5 py-0.5 text-[11px] font-bold text-slate-500 admin-dark:text-slate-400">
                {(counts[subject.key] ?? 0)} exam{(counts[subject.key] ?? 0) === 1 ? "" : "s"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
