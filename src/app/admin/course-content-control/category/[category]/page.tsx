import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HubHeader } from "@/components/admin/hub-ui";
import {
  fetchAllCourseCategories,
  DEFAULT_COURSE_CATEGORIES,
} from "@/lib/course-categories-store";
import { getCoursesByCategory } from "@/lib/courses-admin";

export const dynamic = "force-dynamic";

/**
 * Admin → Course Content Control → Category → Courses.
 * Same database categories and courses as Course Control and the Main
 * Website (no separate system). Each card enters the existing content flow:
 * Course → Topic-wise / Paper Final / Subject Final / Final Model → content,
 * where the full admin management (add/edit/delete/questions) lives.
 */
export default async function ContentControlCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: rawId } = await params;
  const decoded = decodeURIComponent(rawId);
  const categories = await fetchAllCourseCategories();
  let category = categories.find((item) => item.id === decoded && item.isActive);
  if (!category) {
    const fallback = DEFAULT_COURSE_CATEGORIES.find((item) => item.id === decoded);
    const hasExplicitRow = fallback
      ? categories.some((item) => item.slug === fallback.slug)
      : false;
    if (fallback && !hasExplicitRow) category = fallback;
  }
  if (!category) notFound();

  const result = await getCoursesByCategory(category.id);
  const courses = result.ok ? result.courses : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link href="/admin/course-content-control" className="transition hover:text-[#1a3a78]">
          Course Content Control
        </Link>
        <span aria-hidden="true">→</span>
        <span className="text-[#0b1e3a] admin-dark:text-zinc-100">{category.name}</span>
      </nav>

      <div className="mt-4">
        <HubHeader
          eyebrow="Admin · Course Content"
          title={category.name}
          description="Select a course to manage its content — Topic-wise / Paper Final / Subject Final / Final Model exams, questions and materials."
        />
      </div>

      {courses.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-slate-500 admin-dark:border-zinc-700">
          No courses in this category yet. Create one in Course Control — it will appear here automatically.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.slug}
              className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-dark-900 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-primary-600/60 hover:shadow-primary-900/30"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {course.image ? (
                  <Image
                    src={course.image}
                    alt={course.name}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600/20 via-dark-900 to-dark-950 p-6">
                    <span className="text-center text-sm font-semibold text-primary-400/80">
                      {course.slug.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950/70 via-dark-950/10 to-dark-950/30" />
                <span className="absolute left-3 top-3 max-w-[55%] truncate rounded-lg border border-primary-500/40 bg-dark-950/80 px-2.5 py-1 text-[11px] font-bold text-primary-400 backdrop-blur">
                  {category.name}
                </span>
                <span
                  className={`absolute right-3 top-3 rounded-lg border px-2.5 py-1 text-[11px] font-bold backdrop-blur ${
                    course.status === "published"
                      ? "border-emerald-500/40 bg-dark-950/80 text-emerald-400"
                      : "border-ink/15 bg-dark-950/80 text-neutral-300"
                  }`}
                >
                  {course.status === "published" ? "Published" : "Unpublished"}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="line-clamp-2 text-lg font-extrabold leading-snug text-heading transition group-hover:text-primary-400">
                  {course.name}
                </h3>
                {course.shortDescription && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-400">
                    {course.shortDescription}
                  </p>
                )}
                {(course.totalClasses !== undefined || course.totalExams !== undefined) && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-ink/10 bg-ink/5 px-3 py-2 text-center">
                      <p className="text-sm font-extrabold text-heading">
                        {course.totalClasses ?? "—"}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        Total Class
                      </p>
                    </div>
                    <div className="rounded-xl border border-ink/10 bg-ink/5 px-3 py-2 text-center">
                      <p className="text-sm font-extrabold text-heading">
                        {course.totalExams ?? "—"}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        Total Exam
                      </p>
                    </div>
                  </div>
                )}
                <div className="mt-auto pt-5">
                  <Link
                    href={`/admin/course-content-control/course/${encodeURIComponent(course.slug)}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/40 transition duration-300 group-hover:bg-primary-700 group-hover:shadow-primary-900/60"
                  >
                    Manage Content
                    <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
