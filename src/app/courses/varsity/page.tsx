import type { Metadata } from "next";
import SmartBackButton from "@/components/navigation/SmartBackButton";
import BatchCourseList from "@/components/BatchCourseList";
import { fetchBatchFilterOptions } from "@/lib/course-filters";
import { getLivePublicCourses } from "@/lib/course-catalog";

// Cached at the edge; admin changes appear within 60s.
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
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SmartBackButton href="/courses" label="All Courses" />

        <header className="mb-10">
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary-500">
            Courses
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-heading sm:text-4xl">
            Varsity Admission Courses
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
            Select your batch to see the relevant varsity admission course
            lineup.
          </p>
        </header>

        <BatchCourseList options={filterOptions} courses={varsityCourses} />
      </section>
    </main>
  );
}
