// ── Explicit parent-child route hierarchy ─────────────────────────────────
// SINGLE source of truth for "Back must land on the logical parent, never
// generic history".
//
// Pages registered here own their Back destination across ALL THREE back
// channels, which all resolve through this registry:
//   1. Website custom Back  (NavHistoryContext.goBack)
//   2. Browser Back button  (global popstate guard in NavHistoryProvider)
//   3. Android system back gesture/button (same popstate mechanism as #2)
//
// Rules for registering a page here:
// - Its parent must be unambiguous and explicit (never -1 / history.back()).
// - Every route NOT listed keeps native/generic history behavior untouched.
// - matcher()/parent() receive the pathname and search (?a=b) separately.
// - parent() must return an explicit same-origin path.
//
// Currently registered:
// - Q&A subject/question child (`/qa?subject=x`) → Q&A Main (`/qa`).
//   Where the user was before Q&A (Home/Course/Exam/Dashboard/…) is NEVER
//   a Back destination from a Q&A child.

export type ExplicitParentRule = {
  /** Stable id for debugging (e.g. "qa-subject"). */
  id: string;
  matches: (pathname: string, search: string) => boolean;
  parent: (pathname: string, search: string) => string;
};

function getQueryParam(search: string, key: string): string | null {
  if (!search) return null;
  try {
    const query = search.startsWith("?") ? search.slice(1) : search;
    return new URLSearchParams(query).get(key);
  } catch {
    return null;
  }
}

export const EXPLICIT_PARENT_RULES: ExplicitParentRule[] = [
  {
    id: "qa-subject",
    matches: (pathname, search) =>
      pathname === "/qa" && getQueryParam(search, "subject") != null,
    parent: () => "/qa",
  },
];

/** Explicit parent route for a URL, or null when generic history applies. */
export function explicitParentFor(
  pathname: string,
  search: string,
): string | null {
  for (const rule of EXPLICIT_PARENT_RULES) {
    try {
      if (rule.matches(pathname, search)) return rule.parent(pathname, search);
    } catch {
      // A faulty rule must never break navigation — skip it.
    }
  }
  return null;
}

/** Split "/a/b?c=d" into { pathname: "/a/b", search: "?c=d" }. */
export function splitUrl(url: string): { pathname: string; search: string } {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return { pathname: url, search: "" };
  return {
    pathname: url.slice(0, queryIndex),
    search: url.slice(queryIndex),
  };
}
