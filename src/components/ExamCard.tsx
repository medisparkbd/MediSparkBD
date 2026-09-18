import Link from "next/link";
import StartExamButton from "@/components/StartExamButton";
import {
  categorizeExam,
  type ExamCategory,
  type ExamStatus,
  type PublicExam,
} from "@/lib/public-exams";

function formatStartDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
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
            ? `${formatStartDate(exam.scheduledAt)}, ${formatStartTime(
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
            ? `${formatStartDate(exam.endsAt)}, ${formatEndTime(exam.endsAt)}`
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
  Inactive: {
    label: "Not Available",
    disabled: true,
  },
  Unpublished: {
    label: "Not Available",
    disabled: true,
  },
};

function BookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function GraduationCapIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
      />
    </svg>
  );
}

function StethoscopeIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3v2m6-2v2M9 19v1a4 4 0 008 0v-1m-12-6a6 6 0 0012 0V7a2 2 0 10-4 0v5a2 2 0 11-4 0V7a2 2 0 10-4 0v6z"
      />
    </svg>
  );
}

function BuildingIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
      />
    </svg>
  );
}

const categoryMeta: Record<
  ExamCategory,
  { icon: (props: { className?: string }) => React.ReactElement }
> = {
  "ssc-academic": { icon: BookIcon },
  "hsc-academic": { icon: GraduationCapIcon },
  "medical-admission": { icon: StethoscopeIcon },
  "varsity-admission": { icon: BuildingIcon },
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
  const category = categorizeExam(exam);
  const CategoryIcon = categoryMeta[category].icon;
  const isLive = exam.status === "Live" || exam.status === "Available";
  const isAvailable = exam.status === "Available";
  const isPractice = exam.status === "Practice";
  const isUpcoming = exam.status === "Upcoming";
  const isClosed = exam.status === "Completed" || exam.status === "Expired";
  const isInactive = exam.status === "Inactive";
  const isUnpublished = exam.status === "Unpublished";
  const canStart = !hasCompleted && (isLive || isAvailable || isPractice);
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
      <div className="relative h-32 w-full bg-gradient-to-br from-primary-600/25 via-dark-900 to-dark-950 sm:h-36">
        {exam.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exam.bannerUrl}
            alt={`${exam.name} banner`}
            className="h-full w-full object-cover transform-gpu transition duration-150 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CategoryIcon className="h-10 w-10 text-neutral-600" />
          </div>
        )}
        {!exam.published && (
          <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-[11px] font-extrabold tracking-wider text-yellow-300">
            DRAFT
          </span>
        )}
      </div>

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
              disabled={false}
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
