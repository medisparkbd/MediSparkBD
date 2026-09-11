"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Heavy PDF libraries - only load when user clicks Generate/Download
export const PdfGenerator = dynamic(
  () =>
    import("@/app/admin/material-pdf/page").then(
      (mod) => mod.default
    ),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);

// Admin-heavy components - defer until admin panel
export const AdminExamManager = dynamic(
  () => import("@/components/admin/ExamManager").then((mod) => mod.default),
  { loading: () => <div className="h-32 animate-pulse bg-slate-100" />, ssr: false }
);

export const AdminCourseManager = dynamic(
  () => import("@/components/admin/CourseManager").then((mod) => mod.default),
  { loading: () => <div className="h-32 animate-pulse bg-slate-100" />, ssr: false }
);

// Firebase Auth - preload on idle
let firebaseAuthPromise: Promise<typeof import("firebase/auth")> | null = null;

export function preloadFirebaseAuth(): void {
  if (!firebaseAuthPromise) {
    firebaseAuthPromise = import("firebase/auth");
  }
}

// Preload on first user interaction
if (typeof window !== "undefined") {
  ["click", "keydown", "mousemove", "touchstart"].forEach((evt) => {
    window.addEventListener(
      evt,
      () => {
        preloadFirebaseAuth();
      },
      { once: true, passive: true }
    );
  });
}

export function getFirebaseAuth(): Promise<typeof import("firebase/auth")> {
  if (!firebaseAuthPromise) {
    firebaseAuthPromise = import("firebase/auth");
  }
  return firebaseAuthPromise;
}