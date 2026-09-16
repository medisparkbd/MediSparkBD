import type { Metadata } from "next";
import SmartBackButton from "@/components/navigation/SmartBackButton";
import BatchCourseList from "@/components/BatchCourseList";
import { fetchBatchFilterOptions } from "@/lib/course-filters";
import { getLivePublicCourses } from "@/lib/course-catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Medical Admission Courses",
  description:
    "Browse MediSpark medical admission courses by batch — combined syllabus preparation for the medical entrance race.",
};

export default async function AdmissionCoursesPage() {
  const [filterOptions, allCourses] = await Promise.all([
    fetchBatchFilterOptions("hsc"),
    getLivePublicCourses(),
  ]);
  const admissionCourses = allCourses.filter(
    (course) => course.category === "Medical Admission",
  );

  return (
    <main className="flex-1 bg-dark-950">
      <section className="mx-auto max-w-6xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
        <SmartBackButton href="/courses" label="All Courses" />
        <div className="mt-4">
          <BatchCourseList options={filterOptions} courses={admissionCourses} />
        </div>
      </section>
    </main>
  );
}
