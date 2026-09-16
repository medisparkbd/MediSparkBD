import type { Metadata } from "next";
import SmartBackButton from "@/components/navigation/SmartBackButton";
import BatchCourseList from "@/components/BatchCourseList";
import { fetchBatchFilterOptions } from "@/lib/course-filters";
import { getLivePublicCourses } from "@/lib/course-catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Varsity Admission Courses",
  description:
    "Browse MediSpark varsity admission courses by batch — structured classes, practice and model tests for university entrance exams.",
};

export default async function VarsityCoursesPage() {
  const [filterOptions, allCourses] = await Promise.all([
    fetchBatchFilterOptions("hsc"),
    getLivePublicCourses(),
  ]);
  const varsityCourses = allCourses.filter(
    (course) => course.category === "Varsity Admission",
  );

  return (
    <main className="flex-1 bg-dark-950">
      <section className="mx-auto max-w-6xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
        <SmartBackButton href="/courses" label="All Courses" />
        <div className="mt-4">
          <BatchCourseList options={filterOptions} courses={varsityCourses} />
        </div>
      </section>
    </main>
  );
}
