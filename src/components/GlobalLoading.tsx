"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import MediSparkLoader from "@/components/MediSparkLoader";

// ---------- Context ----------
type GlobalLoadingContextValue = {
  isLoading: boolean;
  progress: number;
  startLoading: () => void;
  stopLoading: () => void;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue>({
  isLoading: false,
  progress: 0,
  startLoading: () => {},
  stopLoading: () => {},
});

export function useGlobalLoading() {
  return useContext(GlobalLoadingContext);
}

// ---------- Provider ----------
const PROGRESS_CEILING = 90;
const PROGRESS_INTERVAL_MS = 120;
const MIN_VISIBLE_MS = 350;
const HIDE_DELAY_MS = 220;
const SHOW_DELAY_MS = 150; // avoid flashing for fast ops (spec: 100-200ms)

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString() ?? "";

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const startedAtRef = useRef<number>(0);
  const hideTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);
  // keep ref in sync
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const startLoading = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (isLoadingRef.current || showTimerRef.current !== null) return;
    // Delay showing to avoid flash for very fast navigations/APIs
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      startedAtRef.current = Date.now();
      setProgress(8);
      setIsLoading(true);
    }, SHOW_DELAY_MS) as unknown as number;
  }, []);

  const stopLoading = useCallback(() => {
    // If we never showed (fast op finished before delay), just cancel timer
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
      return;
    }
    if (!isLoadingRef.current) return;
    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, HIDE_DELAY_MS);
    }, remaining) as unknown as number;
  }, []);

  // Perceived progress: ease toward 90% while loading
  useEffect(() => {
    if (!isLoading) return;
    const id = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= PROGRESS_CEILING) return PROGRESS_CEILING;
        const remaining = PROGRESS_CEILING - prev;
        return Math.min(PROGRESS_CEILING, prev + Math.max(0.35, remaining * 0.08));
      });
    }, PROGRESS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isLoading]);

  // Route change finished → hide loader (also cancels pending show timer)
  const prevPathRef = useRef<string>(pathname + "?" + searchString);
  useEffect(() => {
    const current = pathname + "?" + searchString;
    if (prevPathRef.current !== current) {
      prevPathRef.current = current;
      // If a navigation completed, ensure loader hides
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (isLoadingRef.current) stopLoading();
    }
  }, [pathname, searchString, stopLoading]);

  // Capture internal navigation clicks early (Link / router.push) to show bar instantly
  // Respects saveData / slow connection: still show but allow earlier hide.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (href.startsWith("/") && pathname !== href.split("?")[0].split("#")[0]) {
        startLoading();
      }
    };
    const onPopState = () => startLoading();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname, startLoading]);

  // Cleanup pending timers on unmount to prevent stuck UI
  useEffect(() => {
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Ensure we never leave loading stuck (e.g. hard error) — timeout fallback
  useEffect(() => {
    if (!isLoading) return;
    const fallback = window.setTimeout(() => stopLoading(), 8000);
    return () => window.clearTimeout(fallback);
  }, [isLoading, stopLoading]);

  return (
    <GlobalLoadingContext.Provider value={{ isLoading, progress, startLoading, stopLoading }}>
      {children}
      <GlobalTopBar isLoading={isLoading} progress={progress} />
    </GlobalLoadingContext.Provider>
  );
}

// ---------- Top progress bar ----------
function GlobalTopBar({ isLoading, progress }: { isLoading: boolean; progress: number }) {
  return (
    <div
      aria-hidden={!isLoading}
      aria-busy={isLoading}
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2.5px] w-full"
      style={{ opacity: isLoading ? 1 : 0, transition: "opacity 180ms ease" }}
    >
      <div
        className="h-full bg-primary-600 shadow-[0_0_10px_rgba(229,9,20,0.9)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? "width 180ms ease-out" : "width 150ms linear",
        }}
      />
      {/* shimmer */}
      {isLoading && <div className="global-topbar-shimmer absolute inset-0" />}
      <style>{`
        .global-topbar-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: global-topbar-shimmer 1.1s ease-in-out infinite;
          opacity: 0.9;
        }
        @keyframes global-topbar-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ---------- First-load full-screen loader ----------
// Lightweight, uses unified MediSparkLoader visual identity. Never stuck permanently.
export function FirstLoadOverlay() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Hide once hydration + first paint are done. Minimum show for brand moment.
    const minShow = 420;
    const started = Date.now();

    const hide = () => {
      const elapsed = Date.now() - started;
      const delay = Math.max(0, minShow - elapsed);
      window.setTimeout(() => {
        setFading(true);
        window.setTimeout(() => setVisible(false), 420);
      }, delay);
    };

    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });

    // Fallback — never block forever (slow network / slow device)
    const fallback = window.setTimeout(hide, 2500);
    // Also hide on error to avoid infinite screen if load event never fires
    const onError = () => hide();
    window.addEventListener("error", onError, { once: true });
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("load", hide);
      window.removeEventListener("error", onError);
    };
  }, []);

  // Prevent background scroll while visible
  useEffect(() => {
    if (!visible) return;
    const prev = document.documentElement.style.overflow;
    if (!fading) document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [visible, fading]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading MediSpark"
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-dark-950 px-6"
      style={{
        opacity: fading ? 0 : 1,
        transition: "opacity 420ms ease, visibility 420ms ease",
        visibility: fading ? "hidden" : "visible",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary-600/10 blur-[70px]" />
        <div className="absolute bottom-[-80px] right-[-60px] h-[360px] w-[360px] rounded-full bg-primary-900/25 blur-[60px]" />
      </div>
      {/* Reuse unified loader - large + branding + animated dots */}
      <div className="relative">
        <MediSparkLoader size="large" label={undefined} withBranding showDots />
      </div>
    </div>
  );
}
