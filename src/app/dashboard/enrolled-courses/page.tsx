import type { Metadata } from "next";
import { AccessGate } from "@/components/auth/AccessGuard";
import EnrolledCoursesList from "@/components/dashboard/EnrolledCoursesList";

export const metadata: Metadata = {
  title: "My Enrolled Courses",
  description:
    "Access your enrolled courses on MediSpark — active enrollments and pending requests.",
};

export default function EnrolledCoursesPage() {
  return (
    <AccessGate
      requirement="enrolled"
      loadingLabel="Loading your enrolled courses..."
    >
      <EnrolledCoursesList />
    </AccessGate>
  );
}