"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOGO } from "@/lib/logo";

const RING_SIZE = 104;
const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** Perceived-progress ceiling — never show 100% while data is still pending. */
const PROGRESS_CEILING = 90;

/**
 * MediSpark branded center-page loader.
 *
 * Shows the real MediSpark logo with a subtle circular progress ring and a
 * calm perceived-progress percentage (eases toward 90% and holds there until
 * the parent unmounts it when data is actually ready). It never reaches 100%
 * on its own, never triggers data fetching, and never resets — safe for very
 * slow networks and very slow devices.
 */
export default function AdminCenterLoader({ label }: { label: string }) {
  const [progress, setProgress] = useState(2);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= PROGRESS_CEILING) return PROGRESS_CEILING;
        const remaining = PROGRESS_CEILING - prev;
        return Math.min(PROGRESS_CEILING, prev + Math.max(0.12, remaining * 0.015));
      });
    }, 120);
    return () => clearInterval(timer);
  }, []);

  const offset = RING_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-[40vh] w-full items-center justify-center px-4 py-16"
    >
      <div className="flex flex-col items-center">
        <div
          className="relative flex items-center justify-center"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            aria-hidden="true"
            className="absolute inset-0 -rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={5}
              className="stroke-[#dbeafe] admin-dark:stroke-[#1e3a65]"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 150ms linear" }}
              className="stroke-[#1a3a78] admin-dark:stroke-[#3b82f6]"
            />
          </svg>
          <img
            src={DEFAULT_LOGO.url}
            alt=""
            aria-hidden="true"
            width={52}
            height={24}
            draggable={false}
            className="h-6 w-[52px] select-none object-contain"
          />
        </div>
        <p
          aria-hidden="true"
          className="mt-3 text-xs font-bold tabular-nums text-slate-400 admin-dark:text-slate-500"
        >
          {Math.floor(progress)}%
        </p>
        <p className="mt-1 text-sm text-slate-500 admin-dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}
