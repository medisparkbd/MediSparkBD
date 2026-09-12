"use client";

// Global in-app navigation history — the memory behind SmartBackButton.
//
// Tracks visited pathnames (session-only, in-memory) so Back always prefers
// the real previous page (preserving its filters/scroll via router.back())
// and only falls back to the hierarchical parent when there is no in-app
// history (e.g. deep link / refresh). Never pushes duplicate entries, never
// rewrites browser history — browser / Android Back keep working untouched.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const MAX_ENTRIES = 30;

type NavHistoryValue = {
  /** True when a real in-app previous page exists (Back will use history). */
  canGoBack: boolean;
  /** Go to the previous page, or to `fallbackHref` when history is empty. */
  goBack: (fallbackHref: string) => void;
};

function fallbackNavigate(fallbackHref: string) {
  if (typeof window === "undefined") return;
  if (!fallbackHref || window.location.pathname === fallbackHref) return;
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = fallbackHref;
}

const NavHistoryContext = createContext<NavHistoryValue>({
  canGoBack: false,
  goBack: fallbackNavigate,
});

export function useNavHistory(): NavHistoryValue {
  return useContext(NavHistoryContext);
}

/**
 * Mount ONCE near the root (inside ExamLockProvider). Tracks pathname
 * changes: true back steps pop, forward steps push, replaces/duplicates
 * are ignored — the stack always mirrors the logical in-app trail.
 */
export function NavHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const stackRef = useRef<string[]>([]);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!pathname) return;
    const stack = stackRef.current;
    const top = stack[stack.length - 1];
    if (top === pathname) return; // replace / same-page: ignore
    if (stack.length >= 2 && stack[stack.length - 2] === pathname) {
      stack.pop(); // true back step: pop
    } else {
      stack.push(pathname); // forward step: push
      if (stack.length > MAX_ENTRIES) stack.splice(0, stack.length - MAX_ENTRIES);
    }
    setDepth(stack.length);
  }, [pathname]);

  const goBack = useCallback(
    (fallbackHref: string) => {
      const stack = stackRef.current;
      if (stack.length >= 2) {
        router.back(); // real previous page: filters + scroll preserved
        return;
      }
      if (!fallbackHref || pathname === fallbackHref) return; // never loop
      router.push(fallbackHref); // no history: hierarchical parent
    },
    [pathname, router],
  );

  const value = useMemo(
    () => ({ canGoBack: depth >= 2, goBack }),
    [depth, goBack],
  );

  return <NavHistoryContext.Provider value={value}>{children}</NavHistoryContext.Provider>;
}
