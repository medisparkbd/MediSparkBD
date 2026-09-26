import Link from "next/link";
import StartExamButton from "@/components/StartExamButton";
import {
  type ExamStatus,
  type PublicExam,
} from "@/lib/public-exams";

/**
 * Exam Card — reference-based premium card, three states driven ONLY by the
 * exam's time-based status (dynamic exam data, never hardcoded):
 *
 *   Upcoming → "Upcoming Exam" + "Coming Soon" (disabled, cannot start)
 *   Live     → "Exam is Live"  + "Start Exam"  (starts the live attempt)
 *   Practice → "Practice Exam" + "Start Exam"  (unranked practice attempt)
 *
 * Layout (reference, unchanged across themes & screens):
 *   Row 1: exam title (left) + compact status pill (right, same row)
 *   Row 2: horizontal Marks | Duration container with center divider
 *   Row 3: participation-time heading + Start → End compact pills + arrow
 *   Row 4: one full-width bottom action button
 *
 * Theme-safe: every color goes through theme tokens (bg-dark-*, text-heading,
 * text-neutral-*, border-ink/*) so Dark + Light both stay readable. Red/amber/
 * emerald/violet accents are visible on both themes. No hardcoded white-on-dark
 * or black-on-light text.
 *
 * Responsive: same design on desktop / tablet / mobile — the card only shrinks
 * and wraps (title + pill stay on one row where space allows, never overflow).
 */

function formatDayMonth(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    })
    .toUpperCase();
}

function shouldShowTimeRow(exam: PublicExam): boolean {
  return Boolean(exam.scheduledAt) || Boolean(exam.endsAt);
}

function ExamWindow({ exam }: { exam: PublicExam }) {
  if (!shouldShowTimeRow(exam)) return null;
  const pill =
    "min-w-0 flex-1 rounded-xl border border-ink/10 bg-dark-850 px-2 py-2 text-center sm:px-3";
  return (
    <div className="mt-3 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
        Participation Time
      </p>
      <div className="mt-2 flex min-w-0 items-stretch gap-1.5 sm:gap-2">
        <div className={pill}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            Start
          </p>
          <p className="mt-0.5 truncate text-[12px] font-extrabold leading-tight text-heading sm:text-[13px]">
            {formatDayMonth(exam.scheduledAt)}
          </p>
          <p className="truncate text-[10px] font-bold leading-tight text-neutral-300 sm:text-[11px]">
            {formatClock(exam.scheduledAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary-500/40 bg-primary-600/15 text-xs font-extrabold text-primary-500 sm:h-7 sm:w-7 sm:text-sm">
            &rarr;
          </span>
        </div>
        <div className={pill}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
            End
          </p>
          <p className="mt-0.5 truncate text-[12px] font-extrabold leading-tight text-heading sm:text-[13px]">
            {formatDayMonth(exam.endsAt)}
          </p>
          <p className="truncate text-[10px] font-bold leading-tight text-neutral-300 sm:text-[11px]">
            {formatClock(exam.endsAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

type CardPhase = "upcoming" | "live" | "practice" | "closed" | "idle";

function phaseOf(status: ExamStatus): CardPhase {
  if (status === "Upcoming") return "upcoming";
  if (status === "Live" || status === "Available") return "live";
  if (status === "Practice" || status === "Archived") return "practice";
  if (status === "Completed" || status === "Expired") return "closed";
  return "idle";
}

const phaseMeta: Record<
  CardPhase,
  {
    badge: string;
    dotClass: string;
    label: string;
    action: string;
    accentBar: string;
    ring: string;
  }
> = {
  upcoming: {
    badge: "Upcoming Exam",
    dotClass: "exam-dot exam-dot-upcoming",
    label: "border-amber-400/50 bg-amber-500/10 exam-pill-upcoming",
    action: "Coming Soon",
    accentBar: "from-amber-500/80 via-amber-500/20 to-transparent",
    ring: "hover:border-amber-400/50",
  },
  live: {
    badge: "Exam is Live",
    dotClass: "exam-dot exam-dot-live",
    label:
      "bg-red-600 text-white shadow-lg shadow-red-950/40 ring-1 ring-red-400/70",
    action: "Start Exam",
    accentBar: "from-red-500 via-red-500/40 to-transparent",
    ring: "hover:border-red-400/60",
  },
  practice: {
    badge: "Practice Exam",
    dotClass: "exam-dot exam-dot-practice",
    label: "border-violet-400/50 bg-violet-600/15 exam-pill-practice",
    action: "Start Exam",
    accentBar: "from-violet-500/80 via-red-500/30 to-transparent",
    ring: "hover:border-violet-400/60",
  },
  closed: {
    badge: "Exam is Closed",
    dotClass: "exam-dot exam-dot-closed",
    label: "border-red-500/30 bg-red-500/10 text-red-500",
    action: "Exam is Closed",
    accentBar: "from-red-900/60 via-red-900/10 to-transparent",
    ring: "",
  },
  idle: {
    badge: "Not Available",
    dotClass: "exam-dot exam-dot-closed",
    label: "border border-ink/10 bg-dark-800 text-neutral-500",
    action: "Not Available",
    accentBar: "from-neutral-700/40 via-neutral-700/10 to-transparent",
    ring: "",
  },
};

function ClockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function MarksIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export default function ExamCard({
  exam,
  detailsHref,
  manage,
  hasCompleted,
}: {
  exam: PublicExam;
  detailsHref?: string;
  manage?: React.ReactNode;
  hasCompleted?: boolean;
}) {
  const phase = phaseOf(exam.status);
  const meta = phaseMeta[phase];
  const isUpcoming = phase === "upcoming";
  const isPractice = phase === "practice";
  const isClosed = phase === "closed";
  // Post-live Practice stays startable even with a prior live attempt — each
  // new attempt is an unranked practice attempt with its own result.
  const isPostLivePractice = isPractice && exam.examMode === "live";
  const showResultLink = hasCompleted && !isPostLivePractice;
  const canStart =
    !showResultLink &&
    !isUpcoming &&
    !isClosed &&
    phase !== "idle";
  const href = detailsHref ?? `/exam/${exam.id}`;

  const buttonBase =
    "w-full rounded-xl px-4 py-3 text-sm font-extrabold touch-manipulation select-none transform-gpu will-change-transform transition-all duration-150 ease-out active:scale-[0.97]";

  return (
    <article
      className={`group relative flex min-w-0 w-full max-w-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-dark-900 shadow-xl transition duration-150 ease-out hover:-translate-y-1 active:scale-[0.99] ${meta.ring} hover:shadow-2xl`}
    >
      {/* Top accent bar + theme-safe glow */}
      <div
        className={`h-1 w-full bg-gradient-to-r ${meta.accentBar}`}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 max-w-full -translate-x-1/2 rounded-full bg-primary-600/10 blur-3xl transition duration-300 group-hover:bg-primary-600/20"
        aria-hidden="true"
      />

      <div className="relative flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        {/* Row 1 — title (left) + compact status pill (right, same row) */}
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 break-words text-[15px] font-extrabold leading-snug text-heading transition-colors duration-150 sm:text-[17px]">
            {exam.name}
          </h3>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] sm:text-[11px] ${meta.label}`}
          >
            <span className={meta.dotClass} aria-hidden="true" />
            {meta.badge}
          </span>
        </div>

        {/* Marks + Duration — one horizontal container, center divider */}
        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-ink/10 bg-dark-850 p-3 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-500/30 bg-primary-600/10 text-primary-500">
              <MarksIcon />
            </span>
            <p className="truncate text-sm font-extrabold text-heading">
              {exam.totalMarks || "—"}
              <span className="ml-1 text-[11px] font-bold text-neutral-400">
                Marks
              </span>
            </p>
          </div>
          <div
            className="h-8 w-px shrink-0 bg-ink/10"
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-500/30 bg-primary-600/10 text-primary-500">
              <ClockIcon />
            </span>
            <p className="truncate text-sm font-extrabold text-heading">
              {exam.durationMinutes}
              <span className="ml-1 text-[11px] font-bold text-neutral-400">
                min
              </span>
            </p>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mx-1 mt-3 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent"
          aria-hidden="true"
        />

        {/* Participation window: heading + Start → End compact pills */}
        <ExamWindow exam={exam} />

        {isPostLivePractice && (
          <p className="exam-practice-note mt-3 rounded-lg border border-violet-400/25 bg-violet-600/10 px-3 py-2 text-[11px] font-semibold leading-relaxed">
            Live window ended — practice attempts won&apos;t affect the
            leaderboard.
          </p>
        )}

        {/* Bottom action button — one full-width button */}
        <div className="mt-auto min-w-0 pt-5">
          {showResultLink ? (
            <Link
              href={`/exam/${exam.id}/result`}
              className={`${buttonBase} exam-result-btn flex items-center justify-center gap-2 border border-emerald-500/50 bg-emerald-600/15`}
            >
              View Result
              <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : isUpcoming || isClosed || phase === "idle" ? (
            <div
              className={`${buttonBase} flex cursor-not-allowed items-center justify-center gap-2 border border-ink/10 bg-dark-850 text-neutral-400`}
              aria-disabled="true"
            >
              {meta.action}
              {isUpcoming && <span aria-hidden="true">&rarr;</span>}
            </div>
          ) : canStart && !detailsHref ? (
            <StartExamButton
              exam={exam}
              className={`${buttonBase} flex items-center justify-center gap-2 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-lg shadow-red-950/40 ring-1 ring-red-400/50 hover:from-red-400 hover:to-red-600`}
            >
              {meta.action}
              <span aria-hidden="true">&rarr;</span>
            </StartExamButton>
          ) : (
            <Link
              href={href}
              className={`${buttonBase} flex items-center justify-center gap-2 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-lg shadow-red-950/40 ring-1 ring-red-400/50 hover:from-red-400 hover:to-red-600`}
            >
              {meta.action}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}

          {manage}
        </div>
      </div>
    </article>
  );
}
