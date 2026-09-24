"use client";

import MediSparkLoader from "@/components/MediSparkLoader";

/**
 * MediSpark branded center-page loader.
 * Unified wrapper around MediSparkLoader to keep one visual identity everywhere.
 * Keeps the same public API ( { label } ) so all existing call sites continue to work.
 * Internally delegates to the global MediSparkLoader with correct branding/animation.
 */
export default function AdminCenterLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-[40vh] w-full items-center justify-center px-4 py-16"
    >
      <MediSparkLoader size="large" label={label} withBranding={false} />
    </div>
  );
}
