import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flow5ExamListView } from "@/components/dashboard/Flow5Exams";
import { isFlow5SubjectKey } from "@/lib/flow5-shared";

export const metadata: Metadata = {
  title: "Topic-wise Exams | My Enrolled Courses",
  description: "Topic-wise exams for the selected subject.",
};

export default async function TopicWiseSubjectPage({
  params,
}: {
  params: Promise<{ slug: string; subjectKey: string }>;
}) {
  const { slug, subjectKey } = await params;
  const key = decodeURIComponent(subjectKey);
  if (!isFlow5SubjectKey(key)) notFound();
  return (
    <main className="flex-1 bg-dark-950">
      <Flow5ExamListView slug={decodeURIComponent(slug)} format="topic-wise" subjectKey={key} />
    </main>
  );
}
