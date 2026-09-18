"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import StudentResultCard from "@/components/dashboard/StudentResultCard";
import type {
  ResultCardKind,
  StudentResultCardData,
} from "@/lib/my-exam-results";

type LoadState = "loading" | "error" | "ready";

const KIND_META: Record<
  ResultCardKind,
  { title: string; emptyHint: string; browseHref: string; browseLabel: string }
> = {
  public: {
    title: "Public Exam Result",
    emptyHint: "You have not attempted any public exam yet.",
    browseHref: "/exam",
    browseLabel: "Browse Public Exams",
  },
  course: {
    title: "Course Exam Result",
    emptyHint: "You have not attempted any course exam yet.",
    browseHref: "/dashboard/enrolled-courses",
    browseLabel: "Go to My Courses",
  },
};

/**
 * Dedicated result page body for ONE exam kind — lists that kind's
 * simplified result cards only. Public never shows course results and
 * course never shows public results (separated server-side by exam kind).
 */
export default function ExamResultTypeView({ kind }: { kind: ResultCardKind }) {
  const { user, authLoading } = useAuth();
  const [results, setResults] = useState<StudentResultCardData[] | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const meta = KIND_META[kind];

  const load = useCallback(async () => {
    if (!user) return;
    setState("loading");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/my/exam-results/cards?kind=${kind}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as {
        results?: StudentResultCardData[];
      };
      setResults(Array.isArray(data.results) ? data.results : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [user, kind]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void load();
  }, [authLoading, user, load]);

  if (state === "loading") {
    return (
      <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 sm:px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-neutral-400">
          Loading your exam results...
        </p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <p className="font-bold text-red-300">Something went wrong</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mt-5">
        <p className="text-xs font-bold uppercase tracking-widest text-primary-500">
          Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-heading sm:text-3xl">
          {meta.title}
        </h1>
      </header>

      {!results || results.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink/15 bg-dark-900/60 p-12 text-center">
          <p className="font-semibold text-heading">No exam results yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-400">
            {meta.emptyHint}
          </p>
          <Link
            href={meta.browseHref}
            className="mt-6 inline-block rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98]"
          >
            {meta.browseLabel}
          </Link>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-3xl space-y-6">
          {results.map((result) => (
            <StudentResultCard key={result.resultId} result={result} />
          ))}
        </div>
      )}
    </section>
  );
}
