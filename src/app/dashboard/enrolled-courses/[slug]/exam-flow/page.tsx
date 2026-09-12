import type { Metadata } from "next";
import { Flow5CourseView } from "@/components/dashboard/Flow5Exams";

export const metadata: Metadata = {
  title: "Course Exams | My Enrolled Courses",
  description: "Select an exam type — Topic-wise, Paper Final, Subject Final or Final Model Test.",
};

export default async function ExamFlowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="flex-1 bg-dark-950">
      <Flow5CourseView slug={decodeURIComponent(slug)} />
    </main>
  );
}
