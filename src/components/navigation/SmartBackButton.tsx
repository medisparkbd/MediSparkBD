"use client";

// ── Global Back Button ────────────────────────────────────────────────────
// ONE reusable back component for the whole website (public + dashboard).
//
// Behavior:
// - History first: returns to the immediately previous valid page/state
//   (filters + scroll preserved by the router) whenever in-app history
//   exists — tracked by NavHistoryProvider, no duplicate history entries.
// - Hierarchy fallback: with no history (deep link / refresh) it navigates
//   to `href`, which every usage sets to the logical parent — never Home
//   blindly, never a redirect loop (same-page fallback is a no-op).
// - Active exam: routes through the existing exam exit-confirmation
//   ("Are you sure you want to exit the exam?" → Stay in Exam / Exit Exam);
//   exam session, timer, answers, one-attempt rule and auto-submit are
//   untouched (exam pages additionally hide back UI via HideDuringExam,
//   browser/Android Back via the existing lock trap).
// - Same look everywhere: existing back-link design language, compact,
//   responsive, never overlapping content.
//
// Usage: <SmartBackButton href="/courses" label="All Courses" />
// Do NOT render on true top-level pages (Home, main landings, section
// roots) — only inside deeper levels where going back makes sense.

import { useCallback } from "react";
import { useNavHistory } from "@/components/navigation/NavHistoryContext";
import { useExamLock } from "@/components/exam/ExamLockContext";

export function BackChevron({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export default function SmartBackButton({
  href,
  label,
  className = "",
}: {
  /** Logical parent — used ONLY when no in-app history exists. */
  href: string;
  /** Visible label (kept per page — this component never renames). */
  label: React.ReactNode;
  className?: string;
}) {
  const { goBack } = useNavHistory();
  const { isLocked, requestExit } = useExamLock();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      const navigate = () => goBack(href);
      // During an active exam the existing exit-confirm modal decides;
      // otherwise navigate immediately (history-first, parent fallback).
      if (isLocked) requestExit(navigate);
      else navigate();
    },
    [goBack, href, isLocked, requestExit],
  );

  const ariaLabel = typeof label === "string" ? `Back to ${label}` : "Go back";

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 text-sm font-semibold text-neutral-400 transition hover:text-primary-400 ${className}`.trim()}
    >
      <BackChevron />
      {label}
    </a>
  );
}
