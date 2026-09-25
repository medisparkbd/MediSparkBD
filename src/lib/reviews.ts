export type ReviewStatus = "published" | "unpublished";

export type StudentReview = {
  id: string;
  /** Firebase UID of the student who submitted it (if student-owned). */
  studentUid?: string | null;
  studentName: string;
  studentAvatar: string;
  courseName: string;
  batchLabel: string;
  rating: number;
  text: string;
  createdAt: string;
  order: number;
  status: ReviewStatus;
};

export const studentReviews: StudentReview[] = [];

export function getPublishedReviews(): StudentReview[] {
  return studentReviews
    .filter((review) => review.status === "published")
    .sort((a, b) => a.order - b.order);
}