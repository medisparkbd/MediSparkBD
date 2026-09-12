import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flow5ExamListView } from "@/components/dashboard/Flow5Exams";
import { isFlow5Format } from "@/lib/flow5-shared";

export const metadata: Metadata = {
  title: "Final Exams | My Enrolled Courses",
  description: "Paper Final, Subject Final and Final Model Test exams.",
};

// Direct exam lists — Paper Final / Subject Final / Final Model Test.
// Topic-wise is served by the topic-wise/ route (subject selection first).
export default async function ExamFlowFormatPage({
  params,
}: {
  params: Promise<{ slug: string; format: string }>;
}) {
  const { slug, format } = await params;
  const key = decodeURIComponent(format);
  if (!isFlow5Format(key) || key === "topic-wise") notFound();
  return (
    <main className="flex-1 bg-dark-950">
      <Flow5ExamListView slug={decodeURIComponent(slug)} format={key} />
    </main>
  );
}
