import type { Metadata } from "next";
import BatchCourseList from "@/components/BatchCourseList";
import { fetchBatchFilterOptions } from "@/lib/course-filters";
import { getLivePublicCourses } from "@/lib/course-catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "HSC Academic Courses",
  description:
    "Browse MediSpark HSC academic courses by batch — Botany, Zoology and Biology Revision with board exam-focused preparation.",
};

export default async function AcademicCoursesPage() {
  const [filterOptions, allCourses] = await Promise.all([
    fetchBatchFilterOptions("hsc"),
    getLivePublicCourses(),
  ]);
  const academicCourses = allCourses.filter(
    (course) => course.category === "HSC Academic",
  );

  return (
    <main className="flex-1 bg-dark-950">
      <section className="mx-auto max-w-6xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
        <div className="mt-4">
          <BatchCourseList options={filterOptions} courses={academicCourses} />
        </div>
      </section>
    </main>
  );
}
