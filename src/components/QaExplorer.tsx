"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { QaAskOptions, QaQuestion, QaSubject } from "@/lib/qa";
import QaSubjectPicker from "@/components/QaSubjectPicker";
import type { SubjectStats } from "@/components/QaSubjectPicker";
import QaQuestionItem from "@/components/QaQuestionItem";
import QaAskForm, { type QaAskPayload } from "@/components/QaAskForm";
import QaGuideline from "@/components/QaGuideline";
import PermissionGuidanceCard, {
  type PermissionGuidance,
} from "@/components/auth/PermissionGuidanceCard";
import { useAuth } from "@/lib/auth-context";
import type { QaAskCardSettings } from "@/lib/qa-ask-card-settings";

function splitUrl(url: string): { pathname: string; search: string } {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return { pathname: url, search: "" };
  return {
    pathname: url.slice(0, queryIndex),
    search: url.slice(queryIndex),
  };
}

export default function QaExplorer({
  subjects,
  questions,
  askCardSettings: initialAskCardSettings,
  initialSubjectId = null,
}: {
  subjects: QaSubject[];
  questions: QaQuestion[];
  askCardSettings?: import("@/lib/qa-ask-card-settings").QaAskCardSettings | null;
  /** Subject pre-selected from the server (`?subject=` deep link). */
  initialSubjectId?: string | null;
}) {
  const router = useRouter();
  const {
    user,
    access,
    authLoading,
    configured,
    signInWithGoogle,
  } = useAuth();
  const validSubjectIds = useMemo(
    () => new Set(subjects.map((subject) => subject.id)),
    [subjects],
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(() =>
    initialSubjectId && validSubjectIds.has(initialSubjectId)
      ? initialSubjectId
      : null,
  );
  const [askOpen, setAskOpen] = useState(false);
  const [askOptions, setAskOptions] = useState<QaAskOptions | null>(null);
  const [askOptionsError, setAskOptionsError] = useState<string | null>(null);
  const [askGuidance, setAskGuidance] = useState<PermissionGuidance | null>(
    null
  );
  const [signingIn, setSigningIn] = useState(false);
  // ── Q&A-owned navigation: explicit parent only (never global history) ──
  // Final rule: Q&A Subject/Question child → Back = Q&A Main (`/qa`).
  // - NEVER use router.back() / history.back() / navigate(-1) here.
  // - Q&A Main → Subject uses push (parent `/qa` explicitly preserved).
  // - Subject → Subject uses replace (no stacking, parent stays `/qa`).
  // - Child → Q&A Main ALWAYS resolves to the explicit `/qa` route via the
  //   single navigation system (useNavHistory().goBack → replace(`/qa`)).
  //   Replace removes the child entry → Back on Main can never loop back
  //   to the child. Scroll/cards state is preserved via saved position.
  // - Deep links (`/qa?subject=x`) insert `/qa` as parent on mount with
  //   Next router calls only (never raw history APIs, so App Router
  //   bookkeeping stays intact) — Browser / Android Back lands on Q&A
  //   Main, never a foreign page.
  // - Browser / Android Back enforcement lives in the global NavHistory
  //   guard (single system): any child Back that would land outside Q&A
  //   Main is redirected to `/qa`. This component only SYNCs its state
  //   from the URL on popstate and never navigates there. Main-page Back
  //   is untouched (other sections unaffected).
  const savedMainScrollRef = useRef(0);
  const insertedParentRef = useRef(false);

  const readSubjectFromUrl = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const value = new URLSearchParams(window.location.search).get("subject");
      return value && validSubjectIds.has(value) ? value : null;
    } catch {
      return null;
    }
  }, [validSubjectIds]);

  // Browser / Android Back/Forward: PURE state sync from the URL.
  // Destination enforcement is owned by the global NavHistory guard
  // (single system) — this listener never navigates, so it can never race
  // the App Router or create loops. Leaving Q&A from Main itself is normal
  // history and is left untouched (other sections unaffected).
  useEffect(() => {
    const onPopState = () => {
      const nextSubject = readSubjectFromUrl();
      setSelectedSubjectId(nextSubject);
      setAskOpen(false);
      if (nextSubject == null) {
        // Landed back on Q&A Main — restore Main scroll position.
        const restoreScroll = savedMainScrollRef.current;
        requestAnimationFrame(() => {
          try {
            window.scrollTo(0, restoreScroll);
          } catch {
            // ignore
          }
        });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [readSubjectFromUrl]);

  // Deep link (`/qa?subject=x` as the entry point — new tab, shared link):
  // explicitly preserve Q&A Main as the parent route so Browser / Android
  // Back goes to `/qa` natively.
  // Rewrites [.., /qa?subject=x] → [.., /qa, /qa?subject=x] using ONLY Next
  // router calls (never raw history.replaceState/pushState, so App Router
  // bookkeeping stays intact) — no reload, no flicker, and it never reads
  // or navigates to any pre-Q&A (Home/Exam/Dashboard) history entry.
  // Safety design (no duplicates, no loops, no lost deep link):
  // - Skipped on reload: a reload preserves entries, so an in-app parent
  //   `/qa` beneath the child survives and no insertion is needed.
  // - The child push fires ONLY after the parent replace is visibly applied
  //   (verified by reading the URL, polled briefly): if the replace was
  //   dropped, is slow, or the user navigated away, nothing is pushed.
  // - The global NavHistory guard remains as backstop for every other case.
  useEffect(() => {
    if (insertedParentRef.current) return;
    if (!initialSubjectId || !validSubjectIds.has(initialSubjectId)) return;
    if (typeof window === "undefined") return;
    let childUrl = "";
    try {
      const current = new URLSearchParams(window.location.search).get(
        "subject",
      );
      if (current !== initialSubjectId) return;
      const { pathname } = splitUrl(
        window.location.pathname + window.location.search,
      );
      if (pathname !== "/qa") return;
      childUrl = window.location.pathname + window.location.search;
      let navType = "";
      try {
        const entries = performance.getEntriesByType("navigation");
        if (entries.length > 0) {
          navType = (entries[0] as PerformanceNavigationTiming).type;
        }
      } catch {
        navType = "";
      }
      // Reload keeps history entries (including an in-app `/qa` parent) —
      // inserting again would only stack a duplicate `/qa`.
      if (navType === "reload") {
        insertedParentRef.current = true;
        return;
      }
    } catch {
      return;
    }
    insertedParentRef.current = true;
    try {
      router.replace("/qa", { scroll: false });
    } catch {
      return;
    }
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      let onParent = false;
      try {
        onParent =
          window.location.pathname === "/qa" &&
          new URLSearchParams(window.location.search).get("subject") == null;
      } catch {
        onParent = false;
      }
      if (onParent) {
        clearInterval(timer);
        try {
          router.push(childUrl, { scroll: false });
        } catch {
          // ignore — global guard remains as backstop
        }
        return;
      }
      if (attempts >= 5) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [initialSubjectId, validSubjectIds, router]);

  // Clean an unknown `?subject=` value back to Q&A root (replace → no
  // duplicate history entry).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let param: string | null = null;
    try {
      param = new URLSearchParams(window.location.search).get("subject");
    } catch {
      return;
    }
    if (param && !validSubjectIds.has(param)) {
      // State is already Q&A Main for unknown ids (server passes null and
      // readSubjectFromUrl() returns null) — just clean the URL with a
      // replace so no duplicate history entry is left behind.
      router.replace("/qa", { scroll: false });
    }
  }, [validSubjectIds, router]);

  const handleSelectSubject = useCallback(
    (subjectId: string) => {
      // No duplicate history entry when re-selecting the current subject.
      if (subjectId === selectedSubjectId) return;
      // Preserve Q&A Main scroll so Back can restore cards position.
      if (!selectedSubjectId) {
        try {
          savedMainScrollRef.current = window.scrollY;
        } catch {
          savedMainScrollRef.current = 0;
        }
      }
      setAskOpen(false);
      setSelectedSubjectId(subjectId);
      if (selectedSubjectId) {
        // Already inside a child → replace keeps parent as Q&A Main
        // (no Subject→Subject stacking, so Back always lands on Main).
        router.replace(`/qa?subject=${encodeURIComponent(subjectId)}`, {
          scroll: false,
        });
        return;
      }
      // Q&A Main → Subject: push explicitly preserves `/qa` as parent.
      router.push(`/qa?subject=${encodeURIComponent(subjectId)}`, {
        scroll: false,
      });
    },
    [router, selectedSubjectId],
  );

  const handleBackToSubjects = useCallback(() => {
    if (!selectedSubjectId) return;
    // Subject filter reset — direct replace to Q&A Main (no custom Back
    // history logic; Browser / device Back handles previous navigation).
    // replace() removes the child entry so Back on Main never loops back.
    setSelectedSubjectId(null);
    setAskOpen(false);
    router.replace("/qa", { scroll: false });
    const restoreScroll = savedMainScrollRef.current;
    requestAnimationFrame(() => {
      try {
        window.scrollTo(0, restoreScroll);
      } catch {
        // ignore
      }
    });
  }, [router, selectedSubjectId]);
  const [askCardSettings, setAskCardSettings] = useState<QaAskCardSettings | null>(
    initialAskCardSettings ?? null
  );

  useEffect(() => {
    if (initialAskCardSettings) return;
    let cancelled = false;
    void fetch("/api/qa/ask-card", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.title === "string") {
          setAskCardSettings(data as QaAskCardSettings);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialAskCardSettings]);

  const subjectStats = useMemo(
    () =>
      subjects.reduce<Record<string, SubjectStats>>((stats, subject) => {
        if (subject.id === "guideline") {
          stats[subject.id] = { total: null, answered: null };
          return stats;
        }
        const subjectQuestions = questions.filter(
          (question) => question.subjectId === subject.id
        );
        stats[subject.id] = {
          total: subjectQuestions.length,
          answered: subjectQuestions.filter(
            (question) => question.status === "answered"
          ).length,
        };
        return stats;
      }, {}),
    [subjects, questions]
  );

  const selectedSubject =
    selectedSubjectId === "guideline"
      ? { id: "guideline", name: "Guideline", order: 999 }
      : subjects.find((subject) => subject.id === selectedSubjectId);

  const isGuideline = selectedSubjectId === "guideline";

  const [qaFavIds, setQaFavIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setQaFavIds(new Set());
      return;
    }
    let cancelled = false;
    void user
      .getIdToken()
      .then((token) =>
        fetch("/api/my/favourites", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { favourites?: { itemType: string; itemId: string }[] } | null) => {
        if (cancelled || !data?.favourites) return;
        const ids = new Set(data.favourites.filter((f) => f.itemType === "qa").map((f) => f.itemId));
        setQaFavIds(ids);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleQuestions = selectedSubjectId
    ? questions.filter(
        (question) => question.subjectId === selectedSubjectId
      )
    : [];

  // Load the ask-form dropdown data — gated to paid enrollments.
  // Everyone can VIEW questions/answers; only paid-enrolled students may ASK.
  const openAsk = async () => {
    if (authLoading) return;
    if (!access.hasPaidEnrollment) {
      if (!user) {
        const guidance: PermissionGuidance = configured
          ? {
              title: "Enrollment Required",
              message:
                "Asking questions is available only to students enrolled in a paid course. Please sign in and enroll in a paid course to ask questions.",
              actionLabel: "View Paid Courses",
              actionHref: "/courses?kind=paid",
              secondaryLabel: signingIn ? "Please wait..." : "Continue with Google",
              onAction: undefined,
            }
          : {
              title: "Enrollment Required",
              message:
                "Asking questions is available only to students enrolled in a paid course. Please sign in and enroll in a paid course to ask questions.",
              actionLabel: "View Paid Courses",
              actionHref: "/courses?kind=paid",
            };
        // For guests with Firebase configured, offer Google sign-in as the
        // primary action and keep View Courses as secondary.
        if (configured && !user) {
          guidance.actionLabel = signingIn ? "Please wait..." : "Continue with Google";
          guidance.onAction = () => {
            setSigningIn(true);
            void signInWithGoogle()
              .catch(() => undefined)
              .finally(() => setSigningIn(false));
          };
          guidance.actionPending = signingIn;
          guidance.secondaryLabel = "View Paid Courses";
          guidance.secondaryHref = "/courses?kind=paid";
        }
        // Add close handler so the overlay can be dismissed.
        setAskGuidance({
          ...guidance,
          onClose: () => setAskGuidance(null),
        });
      } else {
        setAskGuidance({
          title: "Paid Enrollment Required",
          message:
            "Asking questions is available only to students enrolled in a paid course. You can view all questions and answers, but you need an active paid course enrollment to ask a new question.",
          actionLabel: "Explore Paid Courses",
          actionHref: "/courses?kind=paid",
          secondaryLabel: "View My Courses",
          secondaryHref: "/dashboard/enrolled-courses",
          onClose: () => setAskGuidance(null),
        });
      }
      return;
    }

    setAskOpen(true);
    setAskOptions(null);
    setAskOptionsError(null);
    if (!user) return;
    try {
      const res = await fetch("/api/qa/ask-options", {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setAskOptions((await res.json()) as QaAskOptions);
    } catch {
      setAskOptionsError(
        "Could not load your course context — please try again."
      );
    }
  };

  // Persist the question to MySQL via /api/qa, then refresh server data.
  const handleAskSubmit = async (
    payload: QaAskPayload
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) {
      return { ok: false, error: "Sign in to ask a question." };
    }
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        return { ok: false, error: data?.error ?? "Failed to submit your question." };
      }
      router.refresh();
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: "Network error — could not submit your question.",
      };
    }
  };

  // Upload the optional picture before the question itself is submitted.
  const handleUploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/qa/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        body: formData,
      });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
      } | null;
      return res.ok && data?.url ? data.url : null;
    } catch {
      return null;
    }
  };

  const closeAsk = () => {
    setAskOpen(false);
  };

  return (
    <div>
      {selectedSubject && (
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-extrabold text-heading">
              {selectedSubject.name}
            </h2>
            <button
              type="button"
              onClick={handleBackToSubjects}
              className="rounded-lg border border-ink/10 bg-ink/5 px-3 py-1.5 text-xs font-semibold text-neutral-400 transition hover:border-primary-500/60 hover:text-primary-400"
            >
              Change Subject
            </button>
          </div>
        </div>
      )}

      {!selectedSubject && (
        <div className="relative mb-3 overflow-hidden rounded-2xl border border-ink/10 bg-dark-900 px-4 py-4 text-center shadow-lg shadow-black/20 sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-600/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-medical-dots opacity-30" />
          <p className="relative mx-auto max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
            তোমার প্রশ্নটি করতে নিচের &ldquo;Ask Question&rdquo; বাটনে ক্লিক করো।
          </p>
          <button
            type="button"
            onClick={() => void openAsk()}
            className="relative mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ask Question
          </button>

          {askOpen && (
            <div className="mt-4">
              {askOptionsError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm font-semibold text-red-400">
                  {askOptionsError}
                </div>
              ) : askOptions ? (
                <QaAskForm
                  options={askOptions}
                  initialSubjectId={selectedSubjectId ?? undefined}
                  onSubmit={handleAskSubmit}
                  onUploadImage={handleUploadImage}
                  onClose={closeAsk}
                  cardSettings={askCardSettings}
                />
              ) : (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-ink/10 bg-dark-900 p-8 text-sm text-neutral-400">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  Loading your courses…
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedSubject && (
        <div className="relative mb-3 overflow-hidden rounded-2xl border border-ink/10 bg-dark-900 px-4 py-2 text-center shadow-lg shadow-black/20 sm:px-6 sm:py-3">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-600/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-medical-dots opacity-30" />
          <h2 className="relative text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
            Choose a Subject to View Questions
          </h2>
          <p className="relative mx-auto mt-1 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            নিচের বিষয়গুলোতে ক্লিক করে বিভিন্ন প্রশ্ন ও তাদের উত্তর দেখতে পারো।
          </p>
        </div>
      )}

      {askGuidance && (
        <PermissionGuidanceCard guidance={askGuidance} />
      )}

      {!selectedSubject ? (
        <QaSubjectPicker
          subjects={subjects}
          stats={subjectStats}
          onSelect={handleSelectSubject}
        />
      ) : isGuideline ? (
        <QaGuideline />
      ) : visibleQuestions.length > 0 ? (
        <div className="flex flex-col gap-6">
          {visibleQuestions.map((question) => (
            <QaQuestionItem
              key={question.id}
              question={{ ...question, isFavourite: qaFavIds.has(question.id) } as QaQuestion & { isFavourite?: boolean }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-dark-900/60 p-12 text-center">
          <p className="font-semibold text-heading">No questions yet</p>
          <p className="mt-1 text-sm text-neutral-400">
            Be the first to ask a question in {selectedSubject.name}.
          </p>
        </div>
      )}
    </div>
  );
}
