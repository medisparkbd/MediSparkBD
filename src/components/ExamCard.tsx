import Link from "next/link";
import StartExamButton from "@/components/StartExamButton";
import {
  type ExamStatus,
  type PublicExam,
} from "@/lib/public-exams";

function formatStartDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatStartTime(iso: string | null): string {
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

function formatEndTime(iso: string | null): string {
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

function TimeRow({ exam }: { exam: PublicExam }) {
  if (!shouldShowTimeRow(exam)) return null;

  const hasStart = Boolean(exam.scheduledAt);
  const hasEnd = Boolean(exam.endsAt);

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-ink/5 p-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Start Time
        </p>
        <p className="mt-1 text-sm font-bold text-heading">
          {hasStart
            ? `${formatStartTime(exam.scheduledAt)}, ${formatStartDate(
                exam.scheduledAt,
              )}`
            : "—"}
        </p>
      </div>
      <div className="border-l border-ink/10 pl-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          End Time
        </p>
        <p className="mt-1 text-sm font-bold text-heading">
          {hasEnd
            ? `${formatEndTime(exam.endsAt)}, ${formatStartDate(exam.endsAt)}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

const statusMeta: Record<
  ExamStatus,
  { label: string; badge: string; dot: string }
> = {
  Live: {
    label: "Exam is Live Now",
    badge:
      "bg-emerald-600 text-white shadow-md shadow-emerald-600/50 ring-1 ring-emerald-400/60",
    dot: "bg-white animate-pulse",
  },
  Available: {
    label: "Exam is Live Now",
    badge:
      "bg-emerald-600 text-white shadow-md shadow-emerald-600/50 ring-1 ring-emerald-400/60",
    dot: "bg-white animate-pulse",
  },
  Upcoming: {
    label: "Upcoming Exam",
    badge:
      "bg-primary-500/10 text-primary-300 border border-primary-500/30",
    dot: "bg-primary-400",
  },
  Completed: {
    label: "Exam is Closed",
    badge: "bg-red-500/10 text-red-400 border border-red-500/30",
    dot: "bg-red-400",
  },
  Expired: {
    label: "Exam is Closed",
    badge: "bg-red-500/10 text-red-400 border border-red-500/30",
    dot: "bg-red-400",
  },
  Practice: {
    label: "Practice",
    badge:
      "bg-violet-600 text-white shadow-md shadow-violet-600/50 ring-1 ring-violet-400/60",
    dot: "bg-white",
  },
  Archived: {
    label: "Archived",
    badge:
      "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  Inactive: {
    label: "Inactive",
    badge: "bg-dark-800 text-neutral-500 border border-ink/10",
    dot: "bg-neutral-600",
  },
  Unpublished: {
    label: "Draft",
    badge:
      "bg-yellow-500/10 text-yellow-300 border border-yellow-500/30",
    dot: "bg-yellow-400",
  },
};

const actionMeta: Record<
  ExamStatus,
  { label: string; disabled: boolean }
> = {
  Live: {
    label: "Start Exam",
    disabled: false,
  },
  Available: {
    label: "Start Exam",
    disabled: false,
  },
  Upcoming: {
    label: "Coming Soon",
    disabled: true,
  },
  Completed: {
    label: "Exam is Closed",
    disabled: true,
  },
  Expired: {
    label: "Exam is Closed",
    disabled: true,
  },
  Practice: {
    label: "Practice Again",
    disabled: false,
  },
  Archived: {
    label: "Practice",
    disabled: false,
  },
  Inactive: {
    label: "Not Available",
    disabled: true,
  },
  Unpublished: {
    label: "Not Available",
    disabled: true,
  },
};



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
  const status = statusMeta[exam.status];
  const action = actionMeta[exam.status];
  const isLive = exam.status === "Live" || exam.status === "Available";
  const isAvailable = exam.status === "Available";
  const isPractice = exam.status === "Practice";
  const isArchived = exam.status === "Archived";
  const isUpcoming = exam.status === "Upcoming";
  const isClosed = exam.status === "Completed" || exam.status === "Expired";
  const isInactive = exam.status === "Inactive";
  const isUnpublished = exam.status === "Unpublished";
  const canStart = !hasCompleted && (isLive || isAvailable || isPractice || isArchived);
  const href = detailsHref ?? `/exam/${exam.id}`;
  const effectiveStatus: ExamStatus = hasCompleted ? "Completed" : exam.status;

  const cardClasses = canStart
    ? isPractice
      ? "border-violet-600/60 ring-1 ring-violet-600/40 shadow-xl shadow-violet-900/40 hover:border-violet-500 hover:shadow-violet-800/50"
      : "border-primary-600/60 ring-1 ring-primary-600/40 shadow-xl shadow-primary-900/40 hover:border-primary-500 hover:shadow-primary-800/50"
    : exam.status === "Upcoming"
      ? "border-primary-500/30 shadow-lg shadow-black/20 hover:border-primary-600/50"
      : "border-ink/10 shadow-lg shadow-black/20 hover:border-primary-600/50";

  const buttonClasses =
    "w-full rounded-xl px-4 py-3 text-sm font-bold touch-manipulation select-none transform-gpu will-change-transform transition-colors duration-75 ease-out active:scale-[0.97]";

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-2xl bg-dark-900 transform-gpu transition duration-150 ease-out hover:-translate-y-1 active:scale-[0.99] ${cardClasses}`}
    >
      <div className="flex flex-1 flex-col p-5">
        <h3
          className={`text-lg font-bold leading-snug transition-colors duration-150 ease-out ${
            isLive
              ? "text-heading group-hover:text-primary-400"
              : "text-heading group-hover:text-primary-400"
          }`}
        >
          {exam.name}
        </h3>

        <div className="mt-3 w-full">
          <span
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wider ${status.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-ink/5 p-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Total Marks
            </p>
            <p className="mt-1 text-sm font-bold text-heading">
              {exam.totalMarks || "—"}
            </p>
          </div>
          <div className="border-l border-ink/10 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Duration
            </p>
            <p className="mt-1 text-sm font-bold text-heading">
              {exam.durationMinutes} min
            </p>
          </div>
        </div>

        <TimeRow exam={exam} />

        <div className="mt-auto pt-5">
          {hasCompleted ? (
            <Link
              href={`/exam/${exam.id}/result`}
              className={`${buttonClasses} flex items-center justify-center gap-2 border border-emerald-600/50 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20`}
            >
              View Result
              <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : action.disabled ? (
            <div
              className={`${buttonClasses} flex items-center justify-center gap-2 ${
                isUpcoming
                  ? "border border-primary-600/50 bg-primary-600/10 text-primary-300 cursor-not-allowed"
                  : isClosed
                    ? "border border-red-500/50 bg-red-500/10 text-red-400 cursor-not-allowed"
                    : "border border-ink/10 bg-dark-850 text-neutral-500 cursor-not-allowed"
              }`}
            >
              {action.label}
            </div>
          ) : canStart && !detailsHref ? (
            <StartExamButton
              exam={exam}
              disabled={isInactive || isUnpublished}
              className={`${buttonClasses} flex items-center justify-center gap-2 bg-primary-600 text-white shadow-md shadow-primary-900/50 hover:bg-primary-500`}
            >
              {action.label}
              <span aria-hidden="true">&rarr;</span>
            </StartExamButton>
          ) : (
            <Link
              href={href}
              className={`${buttonClasses} flex items-center justify-center gap-2 ${
                effectiveStatus === "Upcoming"
                  ? "border border-primary-600/50 bg-primary-600/10 text-primary-300 hover:bg-primary-600/20"
                  : isInactive || isUnpublished
                    ? "border border-ink/10 bg-dark-850 text-neutral-500 cursor-not-allowed"
                    : "border border-ink/10 bg-dark-850 text-neutral-300 hover:border-ink/20 hover:text-heading"
              }`}
            >
              {action.label}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}

          {manage}
        </div>
      </div>
    </article>
  );
}
