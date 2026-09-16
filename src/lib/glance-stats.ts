import { query } from "@/lib/mysql";

export type GlanceStats = {
  studentsGuided: number;
  coursesAvailable: number;
  classesAvailable: number;
  examsConducted: number;
  questionsAnswered: number;
  learningMaterials: number;
};

export async function fetchGlanceStats(): Promise<GlanceStats> {
  try {
    const [
      baseRow,
      coursesRow,
      classesRow,
      examsRow,
      questionsRow,
      materialsRow,
    ] = await Promise.all([
      query<{ base_student_count: number }[]>(
        `SELECT base_student_count FROM website_settings WHERE id = 'active' LIMIT 1`,
      ).catch(() => []),
      query<{ n: number }[]>(
        `SELECT COUNT(*) AS n FROM catalog_courses WHERE status = 'published'`,
      ).catch(() => []),
      query<{ n: number }[]>(
        `SELECT COUNT(*) AS n FROM course_classes WHERE is_active = 1`,
      ).catch(() => []),
      query<{ n: number }[]>(
        `SELECT COUNT(*) AS n FROM exams WHERE status = 'published' AND active = 1`,
      ).catch(() => []),
      query<{ n: number }[]>(
        `SELECT COUNT(*) AS n FROM qa_questions WHERE answer_text IS NOT NULL`,
      ).catch(() => []),
      query<{ n: number }[]>(
        `SELECT COUNT(*) AS n FROM course_materials WHERE is_active = 1`,
      ).catch(() => []),
    ]);

    const baseCount = baseRow[0]?.base_student_count ?? 0;
    const studentCount = await query<{ n: number }[]>(
      `SELECT COUNT(*) AS n FROM students`,
    ).catch(() => []);

    return {
      studentsGuided: baseCount + (studentCount[0]?.n ?? 0),
      coursesAvailable: coursesRow[0]?.n ?? 0,
      classesAvailable: classesRow[0]?.n ?? 0,
      examsConducted: examsRow[0]?.n ?? 0,
      questionsAnswered: questionsRow[0]?.n ?? 0,
      learningMaterials: materialsRow[0]?.n ?? 0,
    };
  } catch {
    return {
      studentsGuided: 0,
      coursesAvailable: 0,
      classesAvailable: 0,
      examsConducted: 0,
      questionsAnswered: 0,
      learningMaterials: 0,
    };
  }
}
