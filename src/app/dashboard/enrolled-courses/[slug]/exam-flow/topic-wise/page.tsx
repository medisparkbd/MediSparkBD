import type { Metadata } from "next";
import { Flow5TopicSubjectsView } from "@/components/dashboard/Flow5Exams";

export const metadata: Metadata = {
  title: "Topic-wise Exam | My Enrolled Courses",
  description: "Select a subject to open its topic-wise exams.",
};

export default async function TopicWisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="flex-1 bg-dark-950">
      <Flow5TopicSubjectsView slug={decodeURIComponent(slug)} />
    </main>
  );
}
