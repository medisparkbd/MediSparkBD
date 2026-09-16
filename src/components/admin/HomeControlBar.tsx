"use client";

import Link from "next/link";
import { useIsAdmin } from "./AdminHold";
import SectionToggle from "./SectionToggle";

/**
 * Home Control section control bar — sits BELOW the section content.
 * Every section gets [Edit]; sections that support new items also get
 * [+ Add ...]. An optional ON/OFF toggle controls section visibility on the
 * live website. Renders nothing for normal users (verified against the
 * admins table via /api/admin, and every target API re-verifies admin).
 */
export default function HomeControlBar({
  sectionKey,
  sectionLabel,
  editHref,
  add,
  adds,
  isActive,
}: {
  sectionKey: string;
  /** Human-readable label shown next to the ON/OFF toggle. */
  sectionLabel?: string;
  /** Edit opens the section's complete MySQL-backed editing interface. */
  editHref: string;
  /** Optional section-specific add interface. */
  add?: { href: string; label: string };
  /** Several supported item types → one [+ Add ...] button each. */
  adds?: { href: string; label: string }[];
  /** Current visibility state — when provided, an ON/OFF toggle is shown. */
  isActive?: boolean;
}) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  const addButtons = adds ?? (add ? [add] : []);

  return (
    <div
      data-home-control={sectionKey}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-5 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={editHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary-500/60 bg-primary-600/10 px-4 py-2 text-xs font-bold text-primary-300 transition hover:bg-primary-600/20 active:scale-[0.98]"
        >
          Edit
        </Link>
        {addButtons.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98]"
          >
            + Add {item.label}
          </Link>
        ))}
      </div>
      {typeof isActive === "boolean" && sectionLabel && (
        <SectionToggle
          sectionKey={sectionKey}
          sectionLabel={sectionLabel}
          initialIsActive={isActive}
        />
      )}
    </div>
  );
}
