"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading } from "@/components/auth/AccessGuard";
import LegacyCourseContent from "@/components/admin/LegacyCourseContent";
import { FLOW5_FORMATS, type Flow5Format } from "@/lib/flow5-shared";

type FlowExam = { examFormat?: string | null; topicSubject?: string | null };

// Flow 5 — Course → the same 4 exam-flow cards students see on the Main Website:
// Topic-wise Exam → Subject → Exam/Content · Paper/Subject Final & Final Model → Exam/Content.
export default function CourseSubjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, authLoading } = useAuth();
  const [layout, setLayout] = useState<string | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(true);
  // Flow-5 exam counts per category (same source the student exam-flow reads).
  const [formatCounts, setFormatCounts] = useState<Record<Flow5Format, number> | null>(null);

  // Determine course layout to branch: flow-5 vs legacy 1-3
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/courses?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { course?: { contentLayout?: string } };
          setLayout(data.course?.contentLayout ?? "flow-1");
        } else if (!cancelled) {
          setLayout("flow-1");
        }
      } catch {
        if (!cancelled) setLayout("flow-1");
      } finally {
        if (!cancelled) setLayoutLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, slug]);

  // Same exam source as the live website: enrolled exams assigned to this course.
  useEffect(() => {
    if (authLoading || !user) return;
    if (layout !== "flow-5") return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/exams?kind=enrolled&courseId=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { exams?: FlowExam[] };
          const counts: Record<Flow5Format, number> = {
            "topic-wise": 0,
            "paper-final": 0,
            "subject-final": 0,
            "final-model": 0,
          };
          for (const exam of data.exams ?? []) {
            const fmt = (exam.examFormat ?? "") as Flow5Format;
            if (fmt in counts) counts[fmt] += 1;
          }
          setFormatCounts(counts);
        }
      } catch {
        // counts stay hidden — cards still work
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, layout, slug]);

  if (authLoading || layoutLoading || !user) return <AccessLoading label="Loading course…" />;
  // Non Flow-5 courses keep their own flows (1-3) unchanged.
  if (layout !== "flow-5") {
    return <LegacyCourseContent slug={slug} />;
  }

  const courseName = decodeURIComponent(slug).replace(/-/g, " ");
  const base = `/admin/course-content-control/course/${encodeURIComponent(slug)}/exam-flow`;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/admin/course-content-control" className="text-sm font-semibold text-neutral-400 hover:text-[#1a3a78]">
        ← Course Content Control
      </Link>
      <h1 className="mt-3 break-words text-2xl font-extrabold capitalize text-heading">
        {courseName}
      </h1>
      <p className="mt-1 text-xs text-neutral-500">
        Course Flow 4 — <span className="font-bold">Course → Topic-wise / Paper Final / Subject Final / Final Model</span> · Same 4 exam options students see on the Main Website. Open a card to Add / Edit / Delete / Manage its exams and questions.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {FLOW5_FORMATS.map((format, index) => (
          <Link
            key={format.key}
            href={format.key === "topic-wise" ? `${base}/topic-wise` : `${base}/${format.key}`}
            className="group flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#dbeafe] bg-white p-6 text-center shadow-sm shadow-[#0b1e3a]/5 transition hover:-translate-y-0.5 hover:border-primary-600/60 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600/15 text-sm font-black text-primary-400 transition group-hover:bg-primary-600 group-hover:text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-base font-extrabold text-heading group-hover:text-[#1a3a78]">
              {format.title}
            </span>
            <span className="text-xs text-neutral-500">{format.subtitle}</span>
            {formatCounts && (
              <span className="rounded-full border border-ink/10 bg-ink/5 px-2.5 py-0.5 text-[11px] font-bold text-neutral-400">
                {formatCounts[format.key]} exam{formatCounts[format.key] === 1 ? "" : "s"}
              </span>
            )}
          </Link>
        ))}
      </div>
      <p className="mt-6 rounded-xl border border-dashed border-[#bfdbfe] bg-[#f8fbff]/70 px-4 py-3 text-center text-xs text-slate-500 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544]/60">
        Topic-wise Exam → Subject → Exam/Content · Paper Final, Subject Final and Final Model Test → Exam/Content directly. Content added here appears on the Live Website in the matching location.
      </p>
    </section>
  );
}
