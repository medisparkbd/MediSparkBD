import type { Metadata } from "next";
import SmartBackButton from "@/components/navigation/SmartBackButton";
import BatchCourseList from "@/components/BatchCourseList";
import { fetchBatchFilterOptions } from "@/lib/course-filters";
import { getLivePublicCourses } from "@/lib/course-catalog";

// Cached at the edge; admin changes appear within 60s.
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
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SmartBackButton href="/courses" label="All Courses" />

        <header className="mb-10">
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary-500">
            Courses
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-heading sm:text-4xl">
            SSC Academic Courses
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
            Select your batch to see the relevant SSC academic course lineup.
          </p>
        </header>

        <BatchCourseList options={filterOptions} courses={sscCourses} />
      </section>
    </main>
  );
}
