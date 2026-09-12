"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SectionHeading, { ShirtIcon } from "@/components/home/SectionHeading";
import type { JerseyItem } from "@/lib/content-admin";

const AUTO_SLIDE_MS = 4000;
const SWIPE_THRESHOLD_PX = 40;
const RESUME_AFTER_INTERACTION_MS = 3500;

export default function JerseyGallery({
  jerseys,
}: {
  jerseys: JerseyItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchSwiped = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slides = jerseys ?? [];
  const slideCount = slides.length;

  const goTo = useCallback(
    (index: number) => {
      if (slideCount === 0) return;
      setActiveIndex(((index % slideCount) + slideCount) % slideCount);
    },
    [slideCount],
  );

  // Pause auto-slide while the user interacts, then resume automatically.
  const pauseTemporarily = useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_AFTER_INTERACTION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  // Auto-slide: loops back to the first image after the last one.
  // Disabled for a single image and for users preferring reduced motion.
  useEffect(() => {
    if (paused || slideCount <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [paused, slideCount]);

  // Lightbox: lock scroll + close on Escape.
  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen]);

  // Nothing published yet — the section stays hidden.
  if (slideCount === 0) return null;

  const activeJersey = slides[activeIndex] ?? slides[0];
  const hasMultiple = slideCount > 1;

  return (
    <section
      id="jerseys"
      className="relative scroll-mt-24 overflow-hidden border-t border-ink/5 bg-dark-950"
    >
      <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-primary-600/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading icon={ShirtIcon}>Premium Jersey of MediSpark</SectionHeading>

        {/* Premium showcase — single outer frame → full jersey image. */}
        <div className="mx-auto mt-12 w-full max-w-[360px] sm:max-w-[400px]">
          <div className="relative">
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Jersey of MediSpark gallery"
            className="relative select-none overflow-hidden rounded-3xl border border-ink/10 bg-dark-900 shadow-lg shadow-black/20"
            onMouseEnter={() => hasMultiple && setPaused(true)}
            onMouseLeave={() => hasMultiple && setPaused(false)}
            onFocus={() => hasMultiple && setPaused(true)}
            onBlur={() => hasMultiple && setPaused(false)}
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0].clientX;
              if (hasMultiple) setPaused(true);
            }}
            onTouchEnd={(event) => {
              if (touchStartX.current === null) return;
              const deltaX = event.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
                if (hasMultiple) pauseTemporarily();
                return;
              }
              touchSwiped.current = true;
              goTo(activeIndex + (deltaX < 0 ? 1 : -1));
              pauseTemporarily();
            }}
            onClickCapture={(event) => {
              if (touchSwiped.current) {
                event.preventDefault();
                event.stopPropagation();
                touchSwiped.current = false;
              }
            }}
          >
            {/* Slides — one full-bleed portrait image area, images fill the frame. */}
            <div
              className="flex aspect-[3/4] touch-pan-y transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {slides.map((jersey, index) => (
                <div
                  key={jersey.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${slideCount}: ${jersey.name}`}
                  aria-hidden={index !== activeIndex}
                  className="relative aspect-[3/4] w-full shrink-0"
                >
                  {jersey.image ? (
                    <button
                      type="button"
                      tabIndex={index === activeIndex ? 0 : -1}
                      onClick={() => {
                        if (index === activeIndex) setLightboxOpen(true);
                      }}
                      aria-label={`View the ${jersey.name} in larger size`}
                      className="block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={jersey.image}
                        alt={jersey.name}
                        draggable={false}
                        loading={index === 0 ? "eager" : "lazy"}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : null}
                  {jersey.price > 0 && (
                    <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-primary-600/40 bg-dark-950/80 px-3 py-1 text-xs font-semibold text-primary-400 backdrop-blur">
                      ৳ {jersey.price.toLocaleString("en-IN")}
                    </span>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-4 pt-10">
                    <p className="truncate text-center text-sm font-bold text-white drop-shadow">
                      {jersey.name}
                    </p>
                    {jersey.note && (
                      <p className="mt-0.5 truncate text-center text-xs text-neutral-300">
                        {jersey.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Previous / Next — attached to the outer frame sides, straddling the border. */}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={() => {
                  goTo(activeIndex - 1);
                  pauseTemporarily();
                }}
                aria-label="Previous jersey"
                className="absolute left-0 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-dark-950/90 text-heading shadow-md shadow-black/30 backdrop-blur transition hover:border-primary-600/60 hover:text-primary-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  goTo(activeIndex + 1);
                  pauseTemporarily();
                }}
                aria-label="Next jersey"
                className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-ink/10 bg-dark-950/90 text-heading shadow-md shadow-black/30 backdrop-blur transition hover:border-primary-600/60 hover:text-primary-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </>
          )}

            {/* Slide indicators */}
            {hasMultiple && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {slides.map((jersey, index) => (
                  <button
                    key={jersey.id}
                    type="button"
                    onClick={() => {
                      goTo(index);
                      pauseTemporarily();
                    }}
                    aria-label={`Go to ${jersey.name}`}
                    aria-current={index === activeIndex}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === activeIndex
                        ? "w-6 bg-primary-500 shadow-[0_0_8px_rgba(229,9,20,0.8)]"
                        : "w-1.5 bg-white/30 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Order link follows the active slide. */}
            {activeJersey.link && (
              <a
                key={activeJersey.id}
                href={activeJersey.link}
                target={activeJersey.link.startsWith("/") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white transition duration-300 hover:bg-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Order Now
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            )}
        </div>
      </div>

      {lightboxOpen && activeJersey.image && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeJersey.name} large view`}
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close jersey view"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-dark-900/80 text-heading transition hover:border-primary-600/60 hover:text-primary-400"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <figure
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-full max-w-3xl flex-col items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeJersey.image}
              alt={activeJersey.name}
              className="max-h-[78vh] w-auto max-w-full rounded-2xl border border-ink/10 bg-dark-900 object-contain p-6 shadow-2xl shadow-primary-900/20 sm:p-10"
            />
            <figcaption className="mt-4 text-center">
              <span className="font-bold text-heading">{activeJersey.name}</span>
              {activeJersey.note && (
                <span className="mt-1 block text-sm text-neutral-400">
                  {activeJersey.note}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      ,
          document.body
      )}
    </section>
  );
}
