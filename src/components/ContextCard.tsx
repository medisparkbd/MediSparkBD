"use client";

import { ReactNode } from "react";

interface ContextCardProps {
  title: string;
  instruction: string;
  className?: string;
  children?: ReactNode;
  variant?: "default" | "compact" | "with-action";
}

export default function ContextCard({
  title,
  instruction,
  className = "",
  children,
  variant = "default",
}: ContextCardProps) {
  const baseClasses =
    "relative mb-3 overflow-hidden rounded-2xl border border-ink/10 bg-dark-900 text-center shadow-lg shadow-black/20";

  const variantClasses = {
    default: "px-4 py-2 sm:px-6 sm:py-3",
    compact: "px-4 py-2 sm:px-6 sm:py-3",
    "with-action": "px-4 py-4 sm:px-6 sm:py-5",
  };

  return (
    <header className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-600/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-medical-dots opacity-30" />
      <h1 className="relative text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
        {title}
      </h1>
      <p className="relative mx-auto mt-1 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
        {instruction}
      </p>
      {children && <div className="relative mt-3">{children}</div>}
    </header>
  );
}