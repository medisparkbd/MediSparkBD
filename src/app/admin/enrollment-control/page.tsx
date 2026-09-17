"use client";

import Link from "next/link";
import {
  PendingIndicator,
  useEnrollmentPendingTotals,
} from "@/components/admin/EnrollmentControlShared";

/**
 * Enrollment Control — main page. 3 cards:
 * Free Course, Paid Course and Payment Card.
 * Free/Paid cards glow when any course inside has pending applications.
 */
const CARDS = [
  {
    href: "/admin/enrollment-control/free",
    icon: "🆓",
    title: "Free Course Enrollment",
    description: "Auto Enrollment ON/OFF + course-wise applications.",
  },
  {
    href: "/admin/enrollment-control/paid",
    icon: "💳",
    title: "Paid Course Enrollment",
    description: "Course-wise enrollment applications for paid courses.",
  },
  {
    href: "/admin/enrollment-control/payment-card",
    icon: "📱",
    title: "Payment Card",
    description: "bKash/Nagad numbers + payment instructions with live preview.",
  },
];

export default function EnrollmentControlPage() {
  const { freePending, paidPending } = useEnrollmentPendingTotals();
  const pendingFor: Record<string, number> = {
    "/admin/enrollment-control/free": freePending,
    "/admin/enrollment-control/paid": paidPending,
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#0b1e3a] admin-dark:text-white">Enrollment Control</h1>
      <p className="mt-1 text-sm text-slate-500 admin-dark:text-slate-400">
        Manage Free and Paid Course enrollments course-by-course.
      </p>

      <div className="mt-8 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex min-h-[190px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[#dbeafe] bg-white p-6 text-center shadow-md shadow-[#0b1e3a]/5 transition duration-300 hover:-translate-y-1 hover:border-primary-600/50 hover:shadow-xl hover:shadow-primary-900/10 admin-dark:border-[#1e3a65] admin-dark:bg-[#112544] admin-dark:shadow-black/30 admin-dark:hover:shadow-primary-900/30"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-600/70 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
            />
            <PendingIndicator
              count={pendingFor[card.href] ?? 0}
              className="right-3 top-3"
            />
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-600/15 bg-primary-600/10 text-[28px] leading-none shadow-sm transition duration-300 group-hover:border-primary-600/40 group-hover:bg-primary-600/15 group-hover:shadow-md group-hover:shadow-primary-900/20"
            >
              {card.icon}
            </span>
            <span className="break-words text-base font-extrabold leading-snug text-[#0b1e3a] admin-dark:text-white sm:text-lg">
              {card.title}
            </span>
            <span className="max-w-[26ch] text-xs leading-relaxed text-slate-500 admin-dark:text-slate-400">
              {card.description}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}