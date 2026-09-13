import type { MetadataRoute } from "next";
import { fetchCatalogCourses } from "@/lib/courses-admin";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://medisparkbd.com";

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/courses", changeFrequency: "daily", priority: 0.9 },
  { path: "/courses/academic", changeFrequency: "weekly", priority: 0.8 },
  { path: "/courses/ssc", changeFrequency: "weekly", priority: 0.8 },
  { path: "/courses/admission", changeFrequency: "weekly", priority: 0.8 },
  { path: "/courses/varsity", changeFrequency: "weekly", priority: 0.8 },
  { path: "/exam", changeFrequency: "daily", priority: 0.9 },
  { path: "/exam/category/ssc-academic", changeFrequency: "weekly", priority: 0.7 },
  { path: "/exam/category/hsc-academic", changeFrequency: "weekly", priority: 0.7 },
  { path: "/exam/category/medical-admission", changeFrequency: "weekly", priority: 0.7 },
  { path: "/exam/category/varsity-admission", changeFrequency: "weekly", priority: 0.7 },
  { path: "/qa", changeFrequency: "daily", priority: 0.8 },
  { path: "/login", changeFrequency: "monthly", priority: 0.3 },
  { path: "/register", changeFrequency: "monthly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticUrls: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let courseUrls: MetadataRoute.Sitemap = [];
  try {
    const courses = await fetchCatalogCourses();
    courseUrls = courses.map((c) => ({
      url: `${BASE_URL}/courses/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB unreachable — return static-only sitemap
  }

  return [...staticUrls, ...courseUrls];
}
