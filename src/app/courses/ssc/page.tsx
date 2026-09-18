import type { Metadata } from "next";
import BatchCourseList from "@/components/BatchCourseList";
import { fetchBatchFilterOptions } from "@/lib/course-filters";
import { getLivePublicCourses } from "@/lib/course-catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "SSC Academic Courses",
  description:
    "Browse MediSpark SSC academic courses by batch — complete subject preparation for SSC board exams.",
};

export default async function SscCoursesPage() {
  const [filterOptions, allCourses] = await Promise.all([
    fetchBatchFilterOptions("ssc"),
    getLivePublicCourses(),
  ]);
  const sscCourses = allCourses.filter(
    (course) => course.category === "SSC Academic",
  );

  return (
    <main className="flex-1 bg-dark-950">
      <section className="mx-auto max-w-6xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
        <div className="mt-4">
          <BatchCourseList options={filterOptions} courses={sscCourses} />
        </div>
      </section>
    </main>
  );
}
