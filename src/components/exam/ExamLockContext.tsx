"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ExamLockContextValue = {
  isLocked: boolean;
  setLocked: (v: boolean) => void;
  requestExit: (action?: () => void) => void;
  confirmExit: () => void | Promise<void>;
  cancelExit: () => void;
  showModal: boolean;
  registerExitHandler: (fn: () => void | Promise<void>) => void;
  unregisterExitHandler: () => void;
};

const ExamLockContext = createContext<ExamLockContextValue | null>(null);

export function useExamLock(): ExamLockContextValue {
  const ctx = useContext(ExamLockContext);
  if (!ctx) {
    // Return a no-op context when provider is missing (e.g., during tests or outside tree)
    // This prevents crashes in BottomNav when provider not yet mounted, but we will ensure provider exists in layout.
    // Throwing would break rendering, so we return a fallback that does nothing.
    // However callers expecting real lock will get isLocked=false.
    return {
      isLocked: false,
      setLocked: () => {},
      requestExit: (action?: () => void) => {
        action?.();
      },
      confirmExit: () => {},
      cancelExit: () => {},
      showModal: false,
      registerExitHandler: () => {},
      unregisterExitHandler: () => {},
    };
  }
  return ctx;
}

function ExamExitModal({
  onStay,
  onExit,
}: {
  onStay: () => void;
  onExit: () => void | Promise<void>;
}) {
  // Lock body scroll when modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-exit-title"
      onClick={(e) => {
        // Clicking backdrop = stay in exam (prevent accidental exit)
        if (e.target === e.currentTarget) onStay();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-dark-900 p-6 shadow-2xl shadow-black/40 sm:p-7">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h2
          id="exam-exit-title"
          className="mt-4 text-center text-lg font-extrabold text-heading"
        >
          Are you sure you want to exit the exam?
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-neutral-400">
          If you exit now, your exam may be submitted and you may not be able
          to attempt this exam again.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-primary-900/30 transition hover:bg-primary-500 active:scale-[0.98]"
          >
            Stay in Exam
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-extrabold text-red-300 transition hover:bg-red-500/20 active:scale-[0.98]"
          >
            Exit Exam
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExamLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [, setPendingAction] = useState<(() => void) | null>(null);
  const exitHandlerRef = useRef<(() => void | Promise<void>) | null>(null);
  const isLockedRef = useRef(isLocked);
  const isExitingRef = useRef(false);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const registerExitHandler = useCallback(
    (fn: () => void | Promise<void>) => {
      exitHandlerRef.current = fn;
    },
    [],
  );

  const unregisterExitHandler = useCallback(() => {
    exitHandlerRef.current = null;
  }, []);

  const requestExit = useCallback((action?: () => void) => {
    if (!isLockedRef.current) {
      action?.();
      return;
    }
    setPendingAction(() => action ?? null);
    setShowModal(true);
  }, []);

  const confirmExit = useCallback(async () => {
    // Prevent double-clicks from double-submitting / double-navigating.
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    try {
      setShowModal(false);
      const handler = exitHandlerRef.current;
      // Clear pending navigation — Exit always ends at Home ("/") per spec,
      // so the stored intent is discarded after the exit process completes.
      setPendingAction(null);
      if (handler) {
        try {
          // Await the existing exam-exit process (auto-submit) so async
          // submission/session cleanup completes before navigation.
          await handler();
        } catch {
          // ignore — still exit to Home; keepalive/pagehide retries submit
        }
      }
      // End the active exam session + clear the lock trap synchronously so
      // browser history cannot return the student to the exam.
      exitHandlerRef.current = null;
      setIsLocked(false);
      isLockedRef.current = false;
      try {
        if (
          typeof window !== "undefined" &&
          (window.history.state as Record<string, unknown> | null)?.examLock
        ) {
          // Remove the dummy trap entry added while locked.
          window.history.back();
          // Let the pop (listener already removed on unlock) settle.
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      } catch {
        // ignore
      }
      // Navigate to Home. replace() (not push) so Back never lands back
      // inside the exam. No timer restart / no new attempt — the exam
      // component unmounts and submittedRef already guards re-submit.
      try {
        window.location.replace("/");
      } catch {
        window.location.href = "/";
      }
    } finally {
      // Reset after navigation starts; harmless if page unloads.
      setTimeout(() => {
        isExitingRef.current = false;
      }, 1000);
    }
  }, []);

  const cancelExit = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  const setLocked = useCallback((v: boolean) => {
    setIsLocked(v);
    if (!v) {
      // Unlocking: hide any pending modal
      setShowModal(false);
      setPendingAction(null);
    }
  }, []);

  // Expose exam lock to CSS — allows exam pages to hide banner/details via [data-exam-locked]
  useEffect(() => {
    const root = document.documentElement;
    if (isLocked) {
      root.setAttribute("data-exam-locked", "true");
      document.body.style.paddingBottom = "0";
    } else {
      root.removeAttribute("data-exam-locked");
      document.body.style.paddingBottom = "";
    }
    return () => {
      root.removeAttribute("data-exam-locked");
      document.body.style.paddingBottom = "";
    };
  }, [isLocked]);

  // Global click interceptor for anchors when locked
  useEffect(() => {
    if (!isLocked) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      // Ignore hash-only or empty
      if (href === "#" || href.startsWith("#")) return;
      // Ignore links that explicitly want to stay (e.g., inside modal)
      if (anchor.closest("[data-exam-modal]")) return;
      // BottomNav is hidden, but if somehow visible, intercept
      // We intercept ALL anchor navigations during locked exam
      // Exception: allow links that are anchors to the same exam page? Exam page has no internal nav, so block all
      // But we should allow the exam's own internal non-navigation? There is none.
      e.preventDefault();
      e.stopPropagation();
      const url = anchor.href; // absolute URL
      requestExit(() => {
        window.location.href = url;
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isLocked, requestExit]);

  // Browser back / mobile back / swipe gesture trap + beforeunload
  useEffect(() => {
    if (!isLocked) return;

    const currentUrl = window.location.href;
    // Push dummy entry so back button can be intercepted
    try {
      history.pushState({ examLock: true }, "", currentUrl);
    } catch {
      // ignore
    }

    const onPopState = () => {
      // Re-push to keep trap, then show modal
      try {
        history.pushState({ examLock: true }, "", currentUrl);
      } catch {
        // ignore
      }
      requestExit(() => {
        // No-op pending action for back gesture — submit will be handled via exitHandler
        // If for some reason no exitHandler, allow going back
        // We do not automatically go back; user must press back again after lock cleared
      });
    };

    window.addEventListener("popstate", onPopState);

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom text but require returnValue set.
      // Warn-only: cancelling keeps the attempt intact; confirming lets the
      // pagehide handler finalize it server-side.
      e.returnValue =
        "If you close this tab, your exam will be automatically submitted.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Clean up dummy state when unlocking
      try {
        if (history.state && (history.state as Record<string, unknown>).examLock) {
          history.back();
        }
      } catch {
        // ignore
      }
    };
  }, [isLocked, requestExit]);

  // Also intercept keyboard Backspace navigation? Not needed

  return (
    <ExamLockContext.Provider
      value={{
        isLocked,
        setLocked,
        requestExit,
        confirmExit,
        cancelExit,
        showModal,
        registerExitHandler,
        unregisterExitHandler,
      }}
    >
      {children}
      {showModal && (
        <ExamExitModal onStay={cancelExit} onExit={confirmExit} />
      )}
    </ExamLockContext.Provider>
  );
}
