"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { getPublishedReviews } from "@/lib/reviews";
import type { StudentReview } from "@/lib/reviews";
import { useAuth } from "@/lib/auth-context";
import SectionHeading, { ReviewIcon } from "@/components/home/SectionHeading";

/** Homepage shows this many reviews before "See All Reviews". */
const INITIAL_VISIBLE_COUNT = 4;

function RatingStars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 ${
            index < rating ? "text-primary-500" : "text-ink/15"
          }`}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.538 1.118l-3.367-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.783.57-1.838-.197-1.538-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.319 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.03-3.958z" />
        </svg>
      ))}
    </div>
  );
}

function StarInput({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Select a star rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`Rate ${star} out of 5`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`rounded transition hover:scale-110 active:scale-95 disabled:cursor-not-allowed ${
            star <= value ? "text-primary-500" : "text-ink/20 hover:text-primary-400"
          }`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.958c.3.921-.755 1.688-1.538 1.118l-3.367-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.783.57-1.838-.197-1.538-1.118l1.286-3.958a1 1 0 00-.363-1.118L2.319 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.03-3.958z" />
          </svg>
        </button>
      ))}
      <span className="ml-2 text-sm font-semibold text-neutral-400">
        {value > 0 ? `${value} out of 5` : "Select 1–5 stars"}
      </span>
    </div>
  );
}

type PublishedRecord = {
  id: string;
  studentUid?: string | null;
  studentName: string;
  studentAvatar: string | null;
  courseName: string;
  batchLabel: string;
  rating: number;
  text: string;
  createdAt: number;
};

function toClientReview(record: PublishedRecord, index: number): StudentReview {
  return {
    id: record.id,
    studentUid: record.studentUid ?? null,
    studentName: record.studentName,
    studentAvatar: record.studentAvatar ?? "/avatars/student.svg",
    courseName: record.courseName,
    batchLabel: record.batchLabel,
    rating: record.rating,
    text: record.text,
    createdAt: new Date(record.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    order: index,
    status: "published",
  };
}

export default  function StudentReviews({
  title,
  description,
  reviews: providedReviews,
}: {
  title?: string;
  description?: string;
  reviews?: StudentReview[];
} = {}) {
  void title;
  void description;
  const { user, profile, authLoading } = useAuth();
  const [reviews, setReviews] = useState<StudentReview[]>(() => providedReviews ?? getPublishedReviews());
  const [expanded, setExpanded] = useState(false);

  // Submission form state.
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  // UID the own-review form state was loaded for — avoids sync setState in effects.
  const [ownUid, setOwnUid] = useState<string | null>(null);
  const [hasOwnReview, setHasOwnReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Load the signed-in student's own review (prefills the form for editing).
  useEffect(() => {
    if (authLoading || !user || ownUid === user.uid) return;
    let cancelled = false;
    const uid = user.uid;
    user
      .getIdToken()
      .then((token) =>
        fetch("/api/reviews/mine", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      )
      .then((response) => response.json().catch(() => null))
      .then((data: { review?: PublishedRecord | null } | null) => {
        if (cancelled) return;
        const own = data?.review ?? null;
        if (own) {
          setRating(Math.min(5, Math.max(1, Math.round(own.rating) || 5)));
          setText(own.text ?? "");
          setHasOwnReview(true);
        } else {
          setHasOwnReview(false);
        }
        setOwnUid(uid);
      })
      .catch(() => {
        if (!cancelled) setOwnUid(uid);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, ownUid]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || submitting) return;
    setFormError(null);
    setFormSuccess(null);
    if (rating < 1 || rating > 5) {
      setFormError("Please select a star rating from 1 to 5.");
      return;
    }
    if (text.trim().length === 0) {
      setFormError("Please write your review before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating, text: text.trim() }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setFormError(data?.error ?? "Failed to submit your review.");
        return;
      }
      const wasUpdate = hasOwnReview;
      setHasOwnReview(true);
      setFormSuccess(
        wasUpdate
          ? "Your review has been updated."
          : "Thank you! Your review is now live.",
      );
      // Refresh the published list — the server keeps 5★ → 1★ order.
      const listResponse = await fetch("/api/reviews", { cache: "no-store" });
      const listData = (await listResponse.json().catch(() => null)) as {
        reviews?: PublishedRecord[];
      } | null;
      if (Array.isArray(listData?.reviews)) {
        setReviews(
          listData.reviews.map((record, index) => toClientReview(record, index)),
        );
      }
    } catch {
      setFormError("Failed to submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
  const visibleReviews = expanded ? reviews : reviews.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = reviews.length - visibleReviews.length;

  const formLoading = authLoading || (!!user && ownUid !== user.uid);

  return (
    <section id="reviews" className="scroll-mt-24 border-t border-ink/5 bg-dark-950">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading icon={ReviewIcon}>Student&apos;s Review About MediSpark</SectionHeading>

        {/* Overall rating — always calculated from the actual submitted ratings. */}
        {reviews.length > 0 && (
          <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-2xl border border-ink/10 bg-dark-900 px-5 py-3 shadow-lg shadow-black/20">
            <RatingStars rating={Math.round(averageRating)} />
            <p className="text-sm text-neutral-300">
              <span className="font-extrabold text-heading">
                {averageRating.toFixed(1)}
              </span>{" "}
              out of 5 · {reviews.length}{" "}
              {reviews.length === 1 ? "review" : "reviews"}
            </p>
          </div>
        )}

        {/* Student submission — real account info only. */}
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-ink/10 bg-dark-900 p-6 shadow-lg shadow-black/20">
          {formLoading ? (
            <p className="py-2 text-center text-sm text-neutral-500">
              Loading review form…
            </p>
          ) : !user ? (
            <div className="text-center">
              <p className="font-semibold text-heading">Share your experience</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
                Sign in as a student to give MediSpark a star rating and write
                your review.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent("/#reviews")}`}
                className="mt-4 inline-block rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98]"
              >
                Sign In to Write a Review
              </Link>
            </div>
          ) : !profile ? (
            <div className="text-center">
              <p className="font-semibold text-heading">One step left</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
                Complete your student registration before submitting a review.
              </p>
              <Link
                href={`/register?next=${encodeURIComponent("/#reviews")}`}
                className="mt-4 inline-block rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98]"
              >
                Complete Registration
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/10 bg-dark-800">
                  {profile.profilePictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.profilePictureUrl}
                      alt={profile.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-extrabold text-neutral-400">
                      {profile.fullName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-heading">
                    {hasOwnReview ? "Your Review — update it anytime" : "Write a Review"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    Posting as {profile.fullName}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <StarInput value={rating} onChange={setRating} disabled={submitting} />
              </div>

              <label htmlFor="student-review-text" className="mt-4 block">
                <span className="sr-only">Your review</span>
                <textarea
                  id="student-review-text"
                  value={text}
                  rows={4}
                  maxLength={2000}
                  disabled={submitting}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Share what you liked about MediSpark…"
                  className="w-full resize-none rounded-xl border border-ink/15 bg-dark-950 px-4 py-3 text-sm text-heading placeholder-neutral-500 outline-none transition focus:border-primary-500/70 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
                />
              </label>

              {formError && (
                <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400">
                  {formError}
                </p>
              )}
              {formSuccess && (
                <p role="status" className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400">
                  {formSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-900/40 transition hover:bg-primary-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Submitting…"
                  : hasOwnReview
                    ? "Update My Review"
                    : "Submit Review"}
              </button>
            </form>
          )}
        </div>

        {reviews.length > 0 ? (
          <>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleReviews.map((review) => {
                const isOwn = !!user && !!review.studentUid && review.studentUid === user.uid;
                return (
                  <article
                    key={review.id}
                    className="flex h-full flex-col rounded-2xl border border-ink/10 bg-dark-900 p-6 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-primary-600/50 hover:shadow-primary-900/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/10 bg-dark-800">
                        <Image
                          src={review.studentAvatar}
                          alt={review.studentName}
                          width={48}
                          height={48}
                          className="rounded-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-heading">
                          {review.studentName}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {review.courseName}
                          {review.batchLabel ? ` · ${review.batchLabel}` : ""}
                        </p>
                      </div>
                      {isOwn && (
                        <span className="ml-auto shrink-0 rounded-full border border-primary-500/40 bg-primary-600/15 px-2.5 py-0.5 text-[11px] font-bold text-primary-300">
                          Your review
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <RatingStars rating={review.rating} />
                    </div>

                    <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-300">
                      {review.text}
                    </p>

                    <p className="mt-4 text-xs text-neutral-500">
                      {review.createdAt}
                    </p>
                  </article>
                );
              })}
            </div>

            {hiddenCount > 0 && !expanded && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="rounded-xl border border-primary-500/50 bg-primary-600/15 px-8 py-3 text-sm font-bold text-primary-300 shadow-lg shadow-primary-900/20 transition hover:bg-primary-600/25 active:scale-[0.98]"
                >
                  See All Reviews ({reviews.length})
                </button>
              </div>
            )}
            {expanded && reviews.length > INITIAL_VISIBLE_COUNT && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-xl border border-ink/15 bg-ink/5 px-8 py-3 text-sm font-bold text-heading transition hover:border-primary-500/60 hover:bg-ink/10 active:scale-[0.98]"
                >
                  Show Less
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-dashed border-ink/15 bg-dark-900/60 p-10 text-center">
            <p className="font-semibold text-heading">Reviews are on the way</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
              Real student reviews will appear here as soon as they are
              submitted and published.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
