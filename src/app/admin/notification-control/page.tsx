"use client";

import Link from "next/link";

/**
 * Admin Panel → Notification Control (hub).
 *
 * Exactly THREE clickable cards — each opens its own dedicated notification
 * management page. Scopes are never merged: All Students / Enrolled
 * Students / Specific Student each live on their own page with their own
 * Automatic + Manual sections.
 */
const CARDS = [
  {
    href: "/admin/notification-control/all-students",
    title: "Notification for All Students",
    description:
      "Automatic welcome, course and exam announcements, plus manual broadcasts to every student.",
  },
  {
    href: "/admin/notification-control/enrolled-students",
    title: "Notification for Enrolled Students",
    description:
      "Course-scoped automatic class, exam and live alerts, plus manual messages per course.",
  },
  {
    href: "/admin/notification-control/specific-student",
    title: "Notification for a Specific Student",
    description:
      "Automatic enrollment confirmations and manual messages to one selected student.",
  },
];

export default function NotificationControlHub() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#0b1e3a] admin-dark:text-white">
        Notification Control
      </h1>
      <p className="mt-1 text-sm text-slate-500 admin-dark:text-slate-400">
        Choose a target audience. Each card opens its own dedicated
        notification management page.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-ink/10 bg-white p-5 transition admin-dark:bg-[#112544] hover:-translate-y-0.5 hover:border-primary-500/50 hover:shadow-lg"
          >
            <p className="text-base font-extrabold text-[#0b1e3a] admin-dark:text-white group-hover:text-primary-700 admin-dark:group-hover:text-primary-300">
              {card.title}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 admin-dark:text-slate-400">
              {card.description}
            </p>
            <p className="mt-4 text-sm font-bold text-primary-600 admin-dark:text-primary-400">
              Open <span aria-hidden="true">→</span>
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
