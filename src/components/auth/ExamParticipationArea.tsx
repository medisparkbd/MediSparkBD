"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AccessLoading, AccessMessage } from "@/components/auth/AccessGuard";
import { useExamLock } from "@/components/exam/ExamLockContext";
import {
  ExamRulesList,
  type ExamRulesData,
} from "@/components/ExamRules";

type TakingExam = ExamRulesData & {
  id: string;
  subject: string;
};

type TakingQuestion = {
  id: number;
  question: string;
  options: string[];
  marks: number;
  questionImage?: string | null;
};

type SubmissionOutcome = {
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  rawMarks?: number;
  negativeMarks?: number;
  negativeDeduction?: number;
  timerPenalty?: number;
  secondTimer?: boolean;
  autoSubmitted?: boolean;
  meritPosition?: number | null;
  timeTakenSeconds?: number | null;
  highestMark?: number | null;
  examName?: string;
};

type ScriptQuestion = {
  questionId: number;
  question: string;
  options: string[];
  marks: number;
  chosenIndex: number | null;
  correctIndex: number;
  obtained: number;
  explanation?: string | null;
};

type ResultScript = {
  examName: string;
  score: number;
  totalMarks: number;
  timeTakenSeconds: number | null;
  meritPosition: number | null;
  questions: ScriptQuestion[];
};

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function padNum(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Clean loading screen shown after Rules → Continue while the question paper
 * is being prepared. No metadata, no counts, no partial paper — just this.
 */
function PreparingExamScreen() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-dark-900 p-8 text-center shadow-lg shadow-black/20 sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center">
          <span
            aria-hidden="true"
            className="block h-12 w-12 animate-spin rounded-full border-[3px] border-ink/10 border-t-primary-500"
          />
        </div>
        <h2 className="mt-6 text-lg font-extrabold text-heading sm:text-xl">
          Preparing Your Exam Question...
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          আপনার পরীক্ষার প্রশ্ন প্রস্তুত করা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।
        </p>
      </div>
    </div>
  );
}

export default function ExamParticipationArea({
  examId,
  autoBegin: propAutoBegin,
  timerType: propTimerType,
}: {
  examId: string;
  /** True when the student already accepted the Exam Rules (Start Now flow). */
  autoBegin?: boolean;
  /** First or second timer — affects grading penalty. */
  timerType?: "first" | "second";
}) {
  const searchParams = useSearchParams();
  const autoBegin = propAutoBegin ?? searchParams.get("begin") === "1";
  const timerType = propTimerType ?? (searchParams.get("timer") === "second" ? "second" : "first");
  const versionParamRaw = searchParams.get("version");
  const versionFromUrl: "bangla" | "english" | null =
    versionParamRaw === "english" ? "english" : versionParamRaw === "bangla" ? "bangla" : null;
  const examHref = `/exam/${examId}`;
  const loginHref = `/login?next=${encodeURIComponent(examHref)}`;
  const { user, profile, authLoading, profileLoading } = useAuth();
  const {
    setLocked: setExamLocked,
    registerExitHandler,
    unregisterExitHandler,
  } = useExamLock();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exam, setExam] = useState<TakingExam | null>(null);
  const [questions, setQuestions] = useState<TakingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Submit failure is shown inline (exam stays open for retry) — it must
  // never replace the exam UI or reset timer/answers/attempt.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubmissionOutcome | null>(null);
  const [terminatedNotice, setTerminatedNotice] = useState(false);
  // Strict one-attempt: if already completed, show View Result instead of Start Exam
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  // Rules accepted → the actual attempt has begun.
  const [begun, setBegun] = useState(false);
  // Question Version — preselected from the Rules page (?version=); the
  // in-exam rules gate below also requires an explicit choice. Locked
  // server-side at start; never switchable during the active exam.
  const [questionVersion, setQuestionVersion] = useState<"bangla" | "english" | null>(versionFromUrl);
  const [beginning, setBeginning] = useState(false);
  const [script, setScript] = useState<ResultScript | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const submittedRef = useRef(false);
  const answersRef = useRef<Record<number, number>>({});
  const tokenRef = useRef<string | null>(null);
  // Exam Fixed Header — measured offsets so it stays directly below the normal website header
  const [headerOffset, setHeaderOffset] = useState(64);
  const [examHeaderHeight, setExamHeaderHeight] = useState(48);
  const examFixedHeaderRef = useRef<HTMLDivElement>(null);

  /**
   * Activate a freshly created server session — locks in the start time and
   * starts the countdown. Only called after rules are accepted.
   * Timer is ONE per entire exam; scrolling never affects it.
   */
  const activateSession = useCallback(
    (sessionToken: string | null, durationMinutes: number, serverSecondsLeft?: number | null) => {
      tokenRef.current = sessionToken;
      answersRef.current = {};
      setAnswers({});
      setBegun(true);
      // Fresh session — clear any leftover answers from a terminated one.
      // Prefer server-computed remaining time when available (authoritative clock).
      const initial =
        typeof serverSecondsLeft === "number" && Number.isFinite(serverSecondsLeft)
          ? Math.max(0, Math.floor(serverSecondsLeft))
          : Math.max(60, durationMinutes * 60);
      setSecondsLeft(initial);
    },
    [],
  );

  /**
   * Begin the real attempt — creates the server session and starts the
   * timer. Only called after the student accepts the exam rules.
   */
  const beginExam = useCallback(async () => {
    if (!user || beginning || begun || !exam) return;
    // Version defaults to the Rules-page choice, then the in-exam gate
    // choice, then Bangla (legacy links without ?version=).
    const version = questionVersion ?? versionFromUrl ?? "bangla";
    setBeginning(true);
    try {
      const authToken = await user.getIdToken();
      const response = await fetch(
        `/api/exams/${encodeURIComponent(examId)}?start=1&timer=${timerType}&version=${version}`,
        {
          headers: authToken
            ? { Authorization: `Bearer ${authToken}` }
            : undefined,
          cache: "no-store",
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        sessionToken?: string | null;
        secondsLeft?: number | null;
        questions?: TakingQuestion[];
        questionVersion?: "bangla" | "english" | null;
        abandonedOutcome?: SubmissionOutcome | null;
        error?: string;
      };
      if (!response.ok) {
        setLoadError(data.error ?? "Could not start the exam. Please retry.");
        return;
      }
      if (data.abandonedOutcome && "score" in data.abandonedOutcome) {
        submittedRef.current = true;
        setOutcome({ ...data.abandonedOutcome, autoSubmitted: true });
        setAlreadyAttempted(true);
        return;
      }
      // Locked server order — replace the preview list with the student's
      // assigned Version/Set questions in randomized display order.
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions);
      }
      if (data.questionVersion === "bangla" || data.questionVersion === "english") {
        setQuestionVersion(data.questionVersion);
      } else {
        setQuestionVersion(version);
      }
      activateSession(data.sessionToken ?? null, exam.durationMinutes, data.secondsLeft ?? null);
    } catch {
      setLoadError("Failed to start the exam. Check your connection.");
    } finally {
      setBeginning(false);
    }
  }, [beginning, begun, exam, examId, user, activateSession, timerType, questionVersion, versionFromUrl]);

  // Load the exam meta + sanitized questions first (no answers, no attempt).
  useEffect(() => {
    if (authLoading || profileLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        // Exam meta + prior-attempt are independent — fetch together so the
        // page waits for one round trip instead of two.
        const [response, priorRes] = await Promise.all([
          fetch(`/api/exams/${encodeURIComponent(examId)}`, {
            headers,
            cache: "no-store",
          }),
          fetch(`/api/exams/${encodeURIComponent(examId)}/prior-attempt`, {
            headers,
            cache: "no-store",
          }),
        ]);
        const data = (await response.json().catch(() => ({}))) as {
          exam?: TakingExam;
          questions?: TakingQuestion[];
          abandonedOutcome?: SubmissionOutcome | null;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !data.exam) {
          setLoadError(data.error ?? "This exam is not available right now.");
          return;
        }
        // Re-entering found the previous session abandoned — the backend
        // auto-submitted it; show its result instead of a new attempt.
        if (data.abandonedOutcome && "score" in data.abandonedOutcome) {
          if (!cancelled) {
            submittedRef.current = true;
            setExam(data.exam);
            setOutcome({ ...data.abandonedOutcome, autoSubmitted: true });
            setAlreadyAttempted(true);
          }
          return;
        }
        setExam(data.exam);
        setQuestions(data.questions ?? []);
        // Strict one-attempt: check if already has completed attempt for this public exam
        try {
          const priorData = (await priorRes.json().catch(() => ({}))) as { hasPriorAttempt?: boolean };
          if (!cancelled && priorRes.ok && priorData.hasPriorAttempt) {
            // Already appeared — fetch existing result and show View Result instead of Start Exam
            setAlreadyAttempted(true);
            try {
              const resultRes = await fetch(`/api/exams/${encodeURIComponent(examId)}/result`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                cache: "no-store",
              });
              const resultData = (await resultRes.json().catch(() => ({}))) as SubmissionOutcome & { error?: string };
              if (!cancelled && resultRes.ok && "score" in resultData) {
                setOutcome(resultData as SubmissionOutcome);
              } else {
                // Fallback: show already attempted notice even if result fetch fails
                setOutcome({
                  score: 0,
                  totalMarks: data.exam.totalMarks ?? 0,
                  correctCount: 0,
                  wrongCount: 0,
                  skippedCount: 0,
                  examName: data.exam.name,
                } as SubmissionOutcome);
              }
            } catch {
              // ignore
            }
            return;
          }
        } catch {
          // ignore prior check failure — proceed to normal flow
        }
        // "Start Now" flow: rules were already accepted on the exam card,
        // so begin the attempt right away without showing them again.
        if (autoBegin && (data.questions?.length ?? 0) > 0) {
          try {
            const authToken = await user.getIdToken();
            const startVersion = versionFromUrl ?? "bangla";
            const startResponse = await fetch(
              `/api/exams/${encodeURIComponent(examId)}?start=1&timer=${timerType}&version=${startVersion}`,
              {
                headers: authToken
                  ? { Authorization: `Bearer ${authToken}` }
                  : undefined,
                cache: "no-store",
              },
            );
            const startData = (await startResponse
              .json()
              .catch(() => ({}))) as { sessionToken?: string | null; secondsLeft?: number | null; questions?: TakingQuestion[]; questionVersion?: "bangla" | "english" | null; abandonedOutcome?: SubmissionOutcome | null; error?: string; alreadyAttempted?: boolean };
            if (cancelled) return;
            if (startData.abandonedOutcome && "score" in startData.abandonedOutcome) {
              submittedRef.current = true;
              setOutcome({ ...startData.abandonedOutcome, autoSubmitted: true });
              setAlreadyAttempted(true);
              return;
            }
            if (startResponse.ok && data.exam) {
              // Locked server order replaces the preview list.
              if (Array.isArray(startData.questions) && startData.questions.length > 0) {
                if (!cancelled) setQuestions(startData.questions);
              }
              if (startData.questionVersion === "bangla" || startData.questionVersion === "english") {
                if (!cancelled) setQuestionVersion(startData.questionVersion);
              } else if (!cancelled) {
                setQuestionVersion(startVersion);
              }
              activateSession(
                startData.sessionToken ?? null,
                data.exam.durationMinutes,
                startData.secondsLeft ?? null,
              );
            } else if (startResponse.status === 403 && (startData as { alreadyAttempted?: boolean }).alreadyAttempted) {
              // Backend enforced one-attempt — show View Result
              setAlreadyAttempted(true);
              try {
                const resultRes = await fetch(`/api/exams/${encodeURIComponent(examId)}/result`, {
                  headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
                  cache: "no-store",
                });
                const resultData = (await resultRes.json().catch(() => ({}))) as SubmissionOutcome & { error?: string };
                if (!cancelled && resultRes.ok && "score" in resultData) {
                  setOutcome(resultData as SubmissionOutcome);
                }
              } catch {
                // ignore
              }
            } else if (!startResponse.ok) {
              if (!cancelled) setLoadError((startData as { error?: string }).error ?? "Could not start the exam. Please retry.");
            }
          } catch {
            if (!cancelled) setLoadError("Failed to start the exam. Please retry.");
          }
        }
      } catch {
        if (!cancelled) setLoadError("Failed to load the exam. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, profileLoading, user, examId, autoBegin, activateSession, timerType, versionFromUrl]);

  const submit = useCallback(async () => {
    // Duplicate guard: one submission per attempt — concurrent triggers
    // (button, timer expiry, exit handler) collapse into a single POST.
    if (submittedRef.current || !user) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/exams/${encodeURIComponent(examId)}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            answers: Object.fromEntries(
              Object.entries(answersRef.current).map(([key, value]) => [
                key,
                value,
              ]),
            ),
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as
        | SubmissionOutcome
        | { error?: string };
      if ("score" in data) {
        // Timer, answers and attempt are untouched — the attempt is finalized
        // server-side and the existing result/Answer Card flow takes over.
        setOutcome(data);
      } else {
        // Allow retry on failure — the exam stays exactly as it was.
        submittedRef.current = false;
        setSubmitError("error" in data && data.error ? data.error : "Submission failed. Please try again.");
      }
    } catch {
      submittedRef.current = false;
      setSubmitError("Submission failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [examId, user]);

  // ── Exam Navigation Lock: hide BottomNav + block navigation during active attempt ──
  // Also locked while the begin=1 flow is preparing the paper, so no exam
  // metadata/counts/timer leak onto the screen before questions are ready.
  useEffect(() => {
    const preparing = autoBegin && loading;
    const locked = (begun || preparing) && !outcome && !terminatedNotice && !alreadyAttempted;
    setExamLocked(locked);
    return () => setExamLocked(false);
  }, [begun, outcome, terminatedNotice, alreadyAttempted, autoBegin, loading, setExamLocked]);

  // Register auto-submit as the exit handler for the confirmation modal.
  // Returned promise is awaited by confirmExit so submission/session
  // cleanup completes before navigating to Home.
  useEffect(() => {
    const locked = begun && !outcome && !terminatedNotice && !alreadyAttempted;
    if (locked) {
      registerExitHandler(() => submit());
    } else {
      unregisterExitHandler();
    }
    return () => unregisterExitHandler();
  }, [
    begun,
    outcome,
    terminatedNotice,
    alreadyAttempted,
    submit,
    registerExitHandler,
    unregisterExitHandler,
  ]);

  // Countdown + auto-submit when time runs out. The timer only exists once
  // the attempt has actually begun (rules accepted).
  useEffect(() => {
    if (secondsLeft === null || outcome || terminatedNotice) return;
    if (secondsLeft <= 0) {
      void submit();
      return;
    }
    const timer = setTimeout(
      () => setSecondsLeft((value) => (value ?? 1) - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [secondsLeft, outcome, terminatedNotice, submit]);

  // Exam Fixed Header positioning — keep it directly below the normal website header (sticky Navbar).
  // Measures the live header height so the sticky exam header sticks at the correct offset and never overlaps the Navbar.
  useEffect(() => {
    if (!begun || outcome || terminatedNotice) return;
    function updateOffsets() {
      const header = document.querySelector("header");
      if (header) {
        // Navbar is sticky top-0; its height is the offset where the exam header should stick
        const h = Math.round(header.getBoundingClientRect().height);
        if (h) setHeaderOffset(h);
      }
      if (examFixedHeaderRef.current) {
        const h = examFixedHeaderRef.current.offsetHeight;
        if (h && h !== examHeaderHeight) setExamHeaderHeight(h);
      }
    }
    updateOffsets();
    window.addEventListener("scroll", updateOffsets, { passive: true });
    window.addEventListener("resize", updateOffsets);
    const iv = setInterval(updateOffsets, 500);
    // also observe announcement dismissal / header height changes
    const ro = new ResizeObserver(updateOffsets);
    const headerEl = document.querySelector("header");
    if (headerEl) ro.observe(headerEl);
    if (examFixedHeaderRef.current) ro.observe(examFixedHeaderRef.current);
    return () => {
      window.removeEventListener("scroll", updateOffsets);
      window.removeEventListener("resize", updateOffsets);
      clearInterval(iv);
      ro.disconnect();
    };
  }, [begun, outcome, terminatedNotice, examHeaderHeight]);

  // Close/leave protection for an active exam.
  // - beforeunload ONLY warns ("If you close this tab, your exam will be
  //   automatically submitted.") — it never submits, so cancelling the dialog
  //   leaves the attempt fully intact (timer, answers, session untouched).
  // - pagehide (the tab is really going away) sends the answers with
  //   keepalive so the backend finalizes the attempt reliably.
  useEffect(() => {
    const active = begun && !outcome && !terminatedNotice && !alreadyAttempted;
    if (!active || !user) return;
    const currentUser = user;
    const warningText =
      "If you close this tab, your exam will be automatically submitted.";
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (submittedRef.current) return;
      e.preventDefault();
      // Browsers show their own generic prompt, but returnValue is required.
      e.returnValue = warningText;
      return warningText;
    }
    function postAnswersKeepalive() {
      try {
        const answered = answersRef.current;
        const body = JSON.stringify({
          answers: Object.fromEntries(
            Object.entries(answered).map(([key, value]) => [String(key), value]),
          ),
        });
        void currentUser.getIdToken().then((authToken) => {
          // keepalive lets the request finish even as the page unloads.
          void fetch(`/api/exams/${encodeURIComponent(examId)}/submit`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body,
            keepalive: true,
          }).catch(() => undefined);
        });
      } catch {
        // Best effort — the server-side stored answers remain authoritative.
      }
    }
    function onPageHide() {
      // Only when the page is actually unloading (leave confirmed).
      if (submittedRef.current) return;
      submittedRef.current = true;
      postAnswersKeepalive();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [examId, user, begun, outcome, terminatedNotice, alreadyAttempted]);

  // Presence heartbeat (every 20s) while the exam is active. Keeps the
  // server-side session alive; if the backend reports the session ended
  // elsewhere (abandoned / submitted / taken over), the result is shown
  // instead of a dead exam paper. Never submits from the client on hide.
  useEffect(() => {
    const active = begun && !outcome && !terminatedNotice && !alreadyAttempted;
    if (!active || !user) return;
    let stopped = false;
    const pullStoredResult = async (): Promise<boolean> => {
      try {
        const authToken = await user.getIdToken();
        if (stopped) return false;
        const rRes = await fetch(`/api/exams/${encodeURIComponent(examId)}/result`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          cache: "no-store",
        });
        const rData = (await rRes.json().catch(() => ({}))) as SubmissionOutcome & { error?: string };
        if (stopped) return false;
        if (rRes.ok && "score" in rData) {
          submittedRef.current = true;
          setOutcome(rData as SubmissionOutcome);
          return true;
        }
      } catch {
        // ignore — stay on the exam, next beat retries
      }
      return false;
    };
    const beat = async () => {
      if (stopped || submittedRef.current) return;
      try {
        const authToken = await user.getIdToken();
        if (stopped || submittedRef.current) return;
        const res = await fetch(`/api/exams/${encodeURIComponent(examId)}/heartbeat`, {
          method: "POST",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          status?: "ok" | "abandoned" | "submitted";
          outcome?: SubmissionOutcome;
        };
        if (stopped || submittedRef.current) return;
        if (data.status === "abandoned" && data.outcome && "score" in data.outcome) {
          // Server finalized the abandoned session — show its result card.
          submittedRef.current = true;
          setOutcome({ ...data.outcome, autoSubmitted: true });
        } else if (data.status === "submitted") {
          // Attempt ended elsewhere (keepalive won, another device, expiry).
          submittedRef.current = true;
          const shown = await pullStoredResult();
          if (!shown) submittedRef.current = false; // result not ready yet — stay on exam
        }
      } catch {
        // Offline — stay on the exam; the next beat retries.
      }
    };
    void beat();
    const iv = setInterval(() => void beat(), 20000);
    const onVisibility = () => void beat(); // revalidate on return; stamp presence on hide
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [examId, user, begun, outcome, terminatedNotice, alreadyAttempted]);

  /** Select an answer — allowed only once per question, no changing later. */
  async function chooseOption(question: TakingQuestion, optionIndex: number) {
    if (answers[question.id] !== undefined || submitting || outcome) return;
    // Lock locally right away — option-circle selection IS the lock mechanism.
    const next = { ...answersRef.current, [question.id]: optionIndex };
    answersRef.current = next;
    setAnswers(next);

    // Server-side enforcement + storage.
    if (tokenRef.current && user) {
      try {
        const authToken = await user.getIdToken();
        const response = await fetch(
          `/api/exams/${encodeURIComponent(examId)}/answer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              token: tokenRef.current,
              questionId: question.id,
              optionIndex,
            }),
          },
        );
        const data = (await response.json().catch(() => ({}))) as {
          accepted?: boolean;
          terminated?: boolean;
          outcome?: SubmissionOutcome;
          error?: string;
        };
        if (data.terminated && data.outcome) {
          // The exam was started on another device — this session was
          // terminated and auto-submitted.
          submittedRef.current = true;
          setTerminatedNotice(true);
          setOutcome(data.outcome);
          return;
        }
      } catch {
        // Offline answer is kept locally; the final submit still carries it.
      }
    }
  }

  const openAnswerScript = async () => {
    if (script) {
      setScriptOpen(true);
      return;
    }
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/exams/${encodeURIComponent(examId)}/result`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        },
      );
      const data = (await response.json().catch(() => ({}))) as
        | ResultScript
        | { error?: string };
      if ("questions" in data) {
        setScript(data);
        setScriptOpen(true);
      } else {
        setLoadError("error" in data && data.error ? data.error : "Answer script is not available yet.");
      }
    } catch {
      setLoadError("Failed to load the answer script. Please retry.");
    }
  };

  if (authLoading || profileLoading) {
    return <AccessLoading label="Checking access..." />;
  }

  if (!user) {
    return (
      <AccessMessage
        title="Login Required to Start Exams"
        message="You can view this Public Exam without an account, but you must be logged in to start or submit an exam."
        actionLabel="Login to Start Exam"
        actionHref={loginHref}
      />
    );
  }

  // Registration (completed student profile) is required to participate.
  if (!profile) {
    return (
      <AccessMessage
        title="Registration Required to Start Exams"
        message="You can view this Public Exam without an account, but you must complete your student registration to start or submit an exam."
        actionLabel="Complete Registration"
        actionHref="/register"
      />
    );
  }

  if (loading) {
    // Rules → Continue flow: clean preparing screen until questions + exam
    // data are fully ready. Normal visits keep the existing loader.
    if (autoBegin) {
      return <PreparingExamScreen />;
    }
    return <AccessLoading label="Loading exam…" />;
  }

  if (loadError && !outcome) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="font-semibold text-red-400">{loadError}</p>
      </div>
    );
  }

  /* ── Result Card ─────────────────────────────────────────────────────── */

  if (outcome) {
    if (scriptOpen && script) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-heading">Answer Script</h3>
              <p className="text-xs text-neutral-400">{script.examName}</p>
            </div>
            <button
              type="button"
              onClick={() => setScriptOpen(false)}
              className="rounded-xl border border-ink/10 bg-dark-850 px-4 py-2 text-sm font-bold text-neutral-300 transition hover:text-heading"
            >
              ← Back to Result
            </button>
          </div>

          <ol className="space-y-4">
            {script.questions.map((item, index) => {
              const isCorrect =
                item.chosenIndex !== null && item.chosenIndex === item.correctIndex;
              return (
                <li
                  key={item.questionId}
                  className={`rounded-2xl border p-4 sm:p-5 ${
                    item.chosenIndex === null
                      ? "border-ink/10 bg-dark-900"
                      : isCorrect
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold leading-relaxed text-heading sm:text-base">
                      {padNum(index + 1)}. {item.question}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        item.chosenIndex === null
                          ? "bg-neutral-500/15 text-neutral-400"
                          : isCorrect
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {item.chosenIndex === null
                        ? "Unanswered"
                        : isCorrect
                          ? "Correct"
                          : "Wrong"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {item.options.map((option, optionIndex) => {
                      const chosen = item.chosenIndex === optionIndex;
                      const correct = item.correctIndex === optionIndex;
                      return (
                        <div
                          key={optionIndex}
                          className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
                            correct
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                              : chosen
                                ? "border-red-500/50 bg-red-500/10 text-red-200"
                                : "border-ink/10 bg-dark-850 text-neutral-400"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                              correct
                                ? "bg-emerald-500 text-white"
                                : chosen
                                  ? "bg-red-500 text-white"
                                  : "bg-ink/10 text-neutral-400"
                            }`}
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="min-w-0 break-words">{option}</span>
                          {correct && (
                            <span className="ml-auto shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-emerald-300">
                              Correct Answer
                            </span>
                          )}
                          {chosen && !correct && (
                            <span className="ml-auto shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-red-300">
                              Your Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-semibold">
                    <span className="text-slate-500">
                      Marks: <span className="text-heading">{item.marks}</span>
                      <span className="ml-2 text-neutral-500">
                        Obtained: <span className={isCorrect ? "text-emerald-400" : "text-neutral-400"}>{isCorrect ? `+${item.marks}` : "0"}</span>
                      </span>
                    </span>
                    <span className="text-slate-500">
                      Your Answer: <span className="text-heading">{item.chosenIndex == null ? "—" : String.fromCharCode(65 + item.chosenIndex)}</span>
                    </span>
                    <span className="text-slate-500">
                      Correct: <span className="text-heading">{String.fromCharCode(65 + item.correctIndex)}</span>
                    </span>
                  </div>
                  {item.explanation && (
                    <div className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-200">
                      <span className="font-extrabold">Explanation: </span>
                      {item.explanation}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-primary-600/30 bg-primary-600/10 p-4 text-left sm:p-8">
        {terminatedNotice && (
          <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center text-sm font-semibold text-yellow-300">
            This exam was started on another device — this session was submitted automatically.
          </p>
        )}

        {/* Result Card */}
        <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-ink/10 bg-dark-900 p-5 sm:p-6">
          {/* 1. Exam Name */}
          <div className="text-center">
            <h3 className="text-lg font-extrabold text-heading">{outcome.examName ?? exam?.name ?? "Exam"}</h3>
          </div>

          {/* 2. Answer Summary */}
          <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">Correct Answer</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-300">{outcome.correctCount}</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-400">Wrong Answer</p>
              <p className="mt-1 text-lg font-extrabold text-red-300">{outcome.wrongCount}</p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-dark-850 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Unanswered</p>
              <p className="mt-1 text-lg font-extrabold text-neutral-300">{outcome.skippedCount}</p>
            </div>
          </div>

          {/* 3. Marks */}
          <div className="mt-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Obtained Marks / Total Marks</p>
            <p className="text-5xl font-extrabold text-primary-300">
              {outcome.score}
              <span className="text-2xl text-neutral-400"> / {outcome.totalMarks}</span>
            </p>
          </div>

          {/* 4. Additional Result Information */}
          <ul className="mt-4 grid gap-2 text-left text-sm">
            <li className="flex items-center justify-between rounded-xl border border-ink/10 bg-dark-850 px-4 py-2.5">
              <span className="font-semibold text-neutral-400">Negative Marking</span>
              {outcome.negativeMarks != null && outcome.negativeMarks > 0 ? (
                <span className="font-extrabold text-red-300">
                  −{outcome.negativeDeduction ?? 0}
                  <span className="ml-1 text-[11px] font-bold text-neutral-500">
                    (−{outcome.negativeMarks} × {outcome.wrongCount} wrong)
                  </span>
                </span>
              ) : (
                <span className="font-extrabold text-neutral-300">0</span>
              )}
            </li>
            <li className="flex items-center justify-between rounded-xl border border-ink/10 bg-dark-850 px-4 py-2.5">
              <span className="font-semibold text-neutral-400">Second Timer Penalty</span>
              {outcome.secondTimer ? (
                <span className="font-extrabold text-red-300">
                  −{outcome.timerPenalty ?? 0}
                  <span className="ml-1 text-[11px] font-bold text-neutral-500">(repeat attempt)</span>
                </span>
              ) : (
                <span className="font-extrabold text-neutral-300">0</span>
              )}
            </li>
            <li className="flex items-center justify-between rounded-xl border border-ink/10 bg-dark-850 px-4 py-2.5">
              <span className="font-semibold text-neutral-400">Merit</span>
              <span className="font-extrabold text-primary-300">{outcome.meritPosition != null ? `#${outcome.meritPosition}` : "—"}</span>
            </li>
            {outcome.highestMark != null && (
              <li className="flex items-center justify-between rounded-xl border border-ink/10 bg-dark-850 px-4 py-2.5">
                <span className="font-semibold text-neutral-400">Highest Mark</span>
                <span className="font-extrabold text-heading">{outcome.highestMark}</span>
              </li>
            )}
          </ul>
        </div>

        {/* 5. Action Buttons */}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void openAnswerScript()}
            className="w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-500 active:scale-[0.98] sm:w-auto"
          >
            View Question Paper Details
          </button>
          <a
            href="/dashboard"
            className="w-full rounded-xl border border-ink/10 bg-dark-850 px-6 py-3 text-center text-sm font-bold text-neutral-300 transition hover:text-heading sm:w-auto"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  /* ── Exam Rules gate ─────────────────────────────────────────────────── */

  if (exam && !begun && questions.length > 0) {
    return (
      <div className="rounded-2xl border border-primary-600/30 bg-dark-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold text-heading">Exam Rules</h3>
          <span className="rounded-full bg-primary-600/15 px-3 py-1 text-[11px] font-bold text-primary-300">
            Read carefully before starting
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-400">{exam.name}</p>

        <div className="mt-4">
          <ExamRulesList exam={exam} />
        </div>

        {/* Question Version — required; locked server-side once the exam starts */}
        <div className="mt-5 rounded-2xl border border-primary-600/30 bg-dark-850 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-heading">
            Question Version
            <span className="rounded-full bg-primary-600/15 px-2.5 py-0.5 text-[10px] font-bold text-primary-300">Required</span>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            Choose the language version for this exam. Your version is locked after you start — it cannot be changed during the exam.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              { key: "bangla", title: "Bangla Version", hint: "Bangla / English / mixed" },
              { key: "english", title: "English Version", hint: "English" },
            ] as const).map((option) => {
              const selected = (questionVersion ?? versionFromUrl) === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setQuestionVersion(option.key)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                    selected
                      ? "border-primary-500/60 bg-primary-600/10 ring-1 ring-primary-500/30"
                      : "border-ink/10 bg-dark-900 hover:border-primary-500/30"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                      selected ? "border-primary-500 bg-primary-600 text-white" : "border-ink/20 bg-dark-850 text-neutral-500"
                    }`}
                  >
                    {selected ? "●" : "○"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-heading">{option.title}</p>
                    <p className="text-xs text-neutral-400">{option.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {!(questionVersion ?? versionFromUrl) && (
            <p className="mt-2 text-xs font-semibold text-amber-400">Please select a Question Version to continue.</p>
          )}
        </div>

        <button
          type="button"
          disabled={beginning || !(questionVersion ?? versionFromUrl)}
          onClick={() => void beginExam()}
          title={!(questionVersion ?? versionFromUrl) ? "Select a Question Version first" : undefined}
          className="mt-6 w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {beginning ? "Starting…" : "I Understand & Start Exam"}
        </button>
        <p className="mt-2 text-center text-xs text-neutral-500">
          The timer starts as soon as you press this button.
        </p>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-center">
        <p className="font-semibold text-yellow-300">
          No questions have been added to this exam yet.
        </p>
      </div>
    );
  }

  /* ── Active exam — Single scrollable paper ─────────────────────────── */

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="space-y-4">
      {/* Exam Fixed Header — separate sticky header directly below the normal website header.
          Must remain permanently visible while scrolling: uses sticky with dynamic top (Navbar height).
          Placed OUTSIDE the scrollable question-paper container, questions scroll underneath.
          LEFT: Answered X/Y (same answeredCount) | RIGHT: live countdown (same secondsLeft state). */}
      <div
        ref={examFixedHeaderRef}
        className="sticky z-40 -mx-4 border-b border-ink/10 bg-dark-950/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-dark-950/80 sm:-mx-6 sm:px-6"
        style={{ top: `${headerOffset}px` }}
        role="region"
        aria-label="Exam progress and timer"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-heading sm:text-[15px]">
              Answered {answeredCount}/{totalQuestions}
            </span>
            {questionVersion && (
              <span className="hidden shrink-0 whitespace-nowrap rounded-full border border-primary-500/20 bg-primary-600/10 px-2 py-0.5 text-[10px] font-extrabold capitalize text-primary-300 sm:inline-block">
                {questionVersion} Version · Locked
              </span>
            )}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-sm font-extrabold tabular-nums sm:px-4 sm:text-base ${
              secondsLeft !== null && secondsLeft < 60
                ? "bg-red-500/15 text-red-400"
                : "bg-primary-600/15 text-primary-300"
            }`}
          >
            {formatClock(secondsLeft ?? 0)}
          </span>
        </div>
      </div>

      {/* Exam paper — all questions vertically, free scroll. Has top spacing so first question never hidden underneath the sticky header */}
      <div className="rounded-2xl border border-ink/10 bg-dark-900 p-4 sm:p-6">

        {/* Questions list */}
        <ol className="mt-6 space-y-6">
          {questions.map((q, idx) => {
            const selectedIndex = answers[q.id];
            const isLocked = selectedIndex !== undefined;
            const isUnanswered = !isLocked;
            return (
              <li
                key={q.id}
                id={`q-${q.id}`}
                className={`rounded-2xl border p-4 sm:p-5 ${isLocked ? "border-primary-500/25 bg-primary-600/[0.04]" : "border-ink/10 bg-dark-850/50"}`}
              >
                {/* Question header */}
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-sm font-bold leading-relaxed text-heading sm:text-[15px]">
                    <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-dark-800 px-1.5 text-xs font-extrabold text-neutral-300 sm:h-7 sm:px-2">
                      {padNum(idx + 1)}
                    </span>
                    {q.question}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                      isUnanswered
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                        : "bg-primary-600/15 text-primary-300 border border-primary-500/20"
                    }`}
                  >
                    {isUnanswered ? "Not Answered" : "Locked"}
                  </span>
                </div>

                {q.questionImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.questionImage}
                    alt={`Question ${idx + 1} image`}
                    className="mt-3 max-h-72 w-full rounded-xl border border-ink/10 object-contain bg-dark-950"
                  />
                ) : null}

                <p className="mt-2 text-xs font-semibold text-neutral-500">Marks: {q.marks}</p>

                {/* Options — ○ circle style, one-time lock */}
                <div className="mt-3 space-y-2">
                  {q.options.map((option, optionIndex) => {
                    const isSelected = selectedIndex === optionIndex;
                    const disabled = isLocked || submitting;
                    // Unanswered: all options are enabled. Answered: selected shows locked, others disabled grey.
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        disabled={disabled}
                        onClick={() => void chooseOption(q, optionIndex)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition sm:px-4 ${
                          isSelected
                            ? "border-primary-500 bg-primary-600/15 text-heading shadow-sm"
                            : isLocked
                              ? "border-ink/10 bg-dark-800 text-neutral-500 opacity-60 cursor-not-allowed"
                              : "border-ink/10 bg-dark-900 text-neutral-200 hover:border-primary-500/40 hover:bg-dark-800"
                        }`}
                      >
                        {/* Circle */}
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold transition ${
                            isSelected
                              ? "border-primary-500 bg-primary-600 text-white"
                              : isLocked
                                ? "border-ink/20 bg-dark-800 text-neutral-500"
                                : "border-ink/20 bg-dark-850 text-neutral-400"
                          }`}
                        >
                          {isSelected ? "●" : "○"}
                        </span>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-extrabold text-neutral-400">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="min-w-0 flex-1 break-words font-bold">{option}</span>
                        {isSelected && (
                          <span className="ml-auto shrink-0 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Locked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2.5 text-xs font-medium text-neutral-500">
                  {isLocked ? "Answer saved — locked permanently." : "Select one option — it will lock immediately and cannot be changed."}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Bottom submit */}
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-ink/10 pt-6 sm:flex-row sm:justify-between">
          <p className="text-xs font-semibold text-neutral-400">
            Answered <span className="font-extrabold text-primary-300">{answeredCount}</span> / {totalQuestions} · Unanswered{" "}
            <span className="font-extrabold text-amber-300">{unansweredCount}</span>
          </p>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            {submitError && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs font-bold text-red-300 sm:text-right">
                {submitError}
              </p>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setSubmitError(null);
                if (window.confirm("Are you sure you want to submit the exam?")) {
                  void submit();
                }
              }}
              className="w-full rounded-xl bg-emerald-600 px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Submitting…" : "Submit Exam"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
