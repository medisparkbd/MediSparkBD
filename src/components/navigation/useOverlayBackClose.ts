"use client";

import { useEffect, useRef } from "react";

/**
 * Close an open modal / drawer / overlay with the FIRST Browser / device
 * Back press, instead of navigating away.
 *
 * - When `open` becomes true, a single lightweight history entry is pushed.
 * - The first Back press pops that entry → `onClose` runs, page stays.
 * - A second Back press then navigates to the real previous page natively.
 * - Closing via UI (X / backdrop / Escape) removes the pushed entry with
 *   `history.back()` so no duplicate entries accumulate.
 * - Inactive during an exam lock (the exam trap owns Back there).
 * - No-ops on the server and when `open` is false.
 */
export function useOverlayBackClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedRef = useRef(false);
  const closingViaBackRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || typeof history === "undefined") return;
    // Exam lock owns Back — never interfere (exit-confirm, timer preserved).
    try {
      if (document.documentElement.hasAttribute("data-exam-locked")) return;
    } catch {
      // ignore
    }

    // Push one trap entry for this overlay.
    pushedRef.current = false;
    closingViaBackRef.current = false;
    try {
      history.pushState({ overlayBackClose: true }, "", window.location.href);
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }

    const onPopState = () => {
      // Back pressed while open → close overlay, stay on page.
      if (pushedRef.current) {
        pushedRef.current = false;
        closingViaBackRef.current = true;
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // UI-initiated close: remove our trap entry so history stays clean
      // (no duplicate entries, no extra Back step).
      if (pushedRef.current && !closingViaBackRef.current) {
        pushedRef.current = false;
        try {
          history.back();
        } catch {
          // ignore
        }
      }
      closingViaBackRef.current = false;
    };
  }, [open ]);
}
