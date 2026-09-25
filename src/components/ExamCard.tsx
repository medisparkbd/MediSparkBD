import Link from "next/link";
import StartExamButton from "@/components/StartExamButton";
import {
  type ExamStatus,
  type PublicExam,
} from "@/lib/public-exams";

/**
 * Exam Card — dark/red premium theme, three states driven ONLY by the
 * exam's time-based status (dynamic exam data, never hardcoded):
 *
 *   Upcoming → "Upcoming Exam" + "Coming Soon" (disabled, cannot start)
 *   Live     → "Exam is Live"  + "Start Exam"  (starts the live attempt)
 *   Practice → "Practice Exam" + "Start Exam"  (unranked practice attempt)
 *
 * Same premium appearance on desktop / laptop / tablet / mobile — the card
 * responsively fits its grid column without a separate mobile design.
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
    "flex-1 rounded-xl border border-red-500/25 bg-black/40 px-3 py-2 text-center shadow-inner shadow-black/40";
  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/60">
        Exam Participation Time
      </p>
      <div className="mt-2 flex items-stretch gap-2">
        <div className={pill}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-red-300/70">
            Start
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold leading-tight text-white">
            {formatDayMonth(exam.scheduledAt)}
          </p>
          <p className="text-[11px] font-bold leading-tight text-red-100/90">
            {formatClock(exam.scheduledAt)}
          </p>
        </div>
        <div className="flex items-center" aria-hidden="true">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 bg-red-600/20 text-sm font-extrabold text-red-300 shadow-md shadow-red-950/50">
            &rarr;
          </span>
        </div>
        <div className={pill}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-red-300/70">
            End
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold leading-tight text-white">
            {formatDayMonth(exam.endsAt)}
          </p>
          <p className="text-[11px] font-bold leading-tight text-red-100/90">
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
    dot: string;
    label: string;
    action: string;
    accentBar: string;
    ring: string;
  }
> = {
  upcoming: {
    badge: "Upcoming Exam",
    dot: "bg-amber-400",
    label:
      "border-amber-400/40 bg-amber-500/10 text-amber-300 shadow-md shadow-amber-950/40",
    action: "Coming Soon",
    accentBar: "from-amber-500/80 via-amber-500/20 to-transparent",
    ring: "border-red-500/25 hover:border-red-400/50 shadow-red-950/50",
  },
  live: {
    badge: "Exam is Live",
    dot: "bg-emerald-400 animate-pulse",
    label:
      "bg-red-600 text-white shadow-lg shadow-red-950/60 ring-1 ring-red-400/70",
    action: "Start Exam",
    accentBar: "from-red-500 via-red-500/40 to-transparent",
    ring: "border-red-500/60 hover:border-red-400 shadow-red-900/60 ring-red-600/40",
  },
  practice: {
    badge: "Practice Exam",
    dot: "bg-violet-300",
    label:
      "border-violet-400/50 bg-violet-600/20 text-violet-200 shadow-md shadow-violet-950/50",
    action: "Start Exam",
    accentBar: "from-violet-500/80 via-red-500/30 to-transparent",
    ring: "border-violet-500/40 hover:border-violet-400/70 shadow-violet-950/50",
  },
  closed: {
    badge: "Exam is Closed",
    dot: "bg-red-400",
    label: "border-red-500/30 bg-red-500/10 text-red-400",
    action: "Exam is Closed",
    accentBar: "from-red-900/60 via-red-900/10 to-transparent",
    ring: "border-red-500/20 shadow-black/40",
  },
  idle: {
    badge: "Not Available",
    dot: "bg-neutral-500",
    label: "border border-ink/10 bg-dark-800 text-neutral-500",
    action: "Not Available",
    accentBar: "from-neutral-700/40 via-neutral-700/10 to-transparent",
    ring: "border-ink/10 shadow-black/30",
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
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-[#1a0b10] via-[#120710] to-[#0b0508] shadow-xl transition duration-150 ease-out hover:-translate-y-1 active:scale-[0.99] ${meta.ring} ring-1 hover:shadow-2xl`}
    >
      {/* Top accent bar + glow */}
      <div
        className={`h-1 w-full bg-gradient-to-r ${meta.accentBar}`}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl transition duration-300 group-hover:bg-red-600/25"
        aria-hidden="true"
      />

      <div className="relative flex flex-1 flex-col p-5">
        <h3 className="text-[17px] font-extrabold leading-snug text-white transition-colors duration-150 group-hover:text-red-200">
          {exam.name}
        </h3>

        {/* Status badge */}
        <div className="mt-3 w-full">
          <span
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] ${meta.label}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.badge}
          </span>
        </div>

        {/* Marks + Duration */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-red-500/20 bg-black/30 p-3 shadow-inner shadow-black/40">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-600/15 text-red-300">
              <MarksIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-200/60">
                Total Marks
              </p>
              <p className="truncate text-sm font-extrabold text-white">
                {exam.totalMarks || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-l border-red-500/20 pl-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-600/15 text-red-300">
              <ClockIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-200/60">
                Duration
              </p>
              <p className="truncate text-sm font-extrabold text-white">
                {exam.durationMinutes} min
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mx-1 mt-3 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"
          aria-hidden="true"
        />

        {/* Participation window: date/time pills with arrow */}
        <ExamWindow exam={exam} />

        {isPostLivePractice && (
          <p className="mt-3 rounded-lg border border-violet-400/25 bg-violet-600/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-violet-200/90">
            Live window ended — practice attempts won&apos;t affect the
            leaderboard.
          </p>
        )}

        {/* Bottom action button */}
        <div className="mt-auto pt-5">
          {showResultLink ? (
            <Link
              href={`/exam/${exam.id}/result`}
              className={`${buttonBase} flex items-center justify-center gap-2 border border-emerald-500/50 bg-emerald-600/15 text-emerald-200 hover:bg-emerald-600/25`}
            >
              View Result
              <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : isUpcoming || isClosed || phase === "idle" ? (
            <div
              className={`${buttonBase} flex cursor-not-allowed items-center justify-center gap-2 border border-red-500/30 bg-red-600/10 text-red-300/80`}
              aria-disabled="true"
            >
              {meta.action}
              {isUpcoming && <span aria-hidden="true">&rarr;</span>}
            </div>
          ) : canStart && !detailsHref ? (
            <StartExamButton
              exam={exam}
              className={`${buttonBase} flex items-center justify-center gap-2 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-lg shadow-red-950/60 ring-1 ring-red-400/50 hover:from-red-400 hover:to-red-600`}
            >
              {meta.action}
              <span aria-hidden="true">&rarr;</span>
            </StartExamButton>
          ) : (
            <Link
              href={href}
              className={`${buttonBase} flex items-center justify-center gap-2 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-lg shadow-red-950/60 ring-1 ring-red-400/50 hover:from-red-400 hover:to-red-600`}
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
