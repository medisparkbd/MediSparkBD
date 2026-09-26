import { exec, query } from "@/lib/mysql";

export const DEFAULT_TYPES = [
  { type_key: "class", name: "Class" },
  { type_key: "exam", name: "Exam" },
  { type_key: "materials", name: "Materials" },
  { type_key: "archive", name: "Archive" },
] as const;

export type CtypeScope = {
  courseSlug: string;
  subjectId?: string | null;
  paperId?: string | null;
};

async function ensureTables() {
  await query("SELECT 1 FROM course_content_types LIMIT 1");
}

export async function ensureTypes(scope: CtypeScope): Promise<
  Array<{ typeKey: string; name: string }>
> {
  await ensureTables();
  const existing = await query<{ type_key: string; name: string }[]>(
    `SELECT type_key, name FROM course_content_types
      WHERE course_slug = ? AND subject_id <=> ? AND paper_id <=> ?
      ORDER BY sort_order ASC`,
    [scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? ""],
  );
  if (existing.length > 0) return existing.map((r) => ({ typeKey: r.type_key, name: r.name }));
  let order = 1;
  for (const t of DEFAULT_TYPES) {
    await exec(
      `INSERT IGNORE INTO course_content_types
         (course_slug, subject_id, paper_id, type_key, name, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? "", t.type_key, t.name, order++],
    );
  }
  return DEFAULT_TYPES.map((t) => ({ typeKey: t.type_key, name: t.name }));
}

/** Chapters of one content-type scope (subject/paper scoped or course-level). */
export async function getTypeChapters(
  scope: CtypeScope,
  contentType: string,
): Promise<Array<{ id: string; name: string; classCount?: number }>> {
  await ensureTables();
  return query(
    `SELECT ch.id, ch.name,
            (SELECT COUNT(*) FROM course_classes cl WHERE cl.chapter_id = ch.id AND cl.is_active=1) AS classCount
       FROM course_chapters ch
      WHERE COALESCE(ch.course_slug,'') = ?
        AND COALESCE(ch.subject_id,'') = ?
        AND COALESCE(ch.paper_id,'') = ?
        AND ch.content_type = ?
        AND ch.is_active = 1
      ORDER BY ch.sort_order, ch.name`,
    [scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? "", contentType],
  ) as never;
}

export async function addTypeChapter(
  scope: CtypeScope,
  contentType: string,
  name: string,
  id: string,
): Promise<void> {
  const rows = await query<{ next: number }[]>(
    "SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM course_chapters WHERE course_slug = ?",
    [scope.courseSlug],
  );
  await exec(
    `INSERT INTO course_chapters (id, subject_id, paper_id, course_slug, name, content_type, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, scope.subjectId ?? "", scope.paperId ?? "", scope.courseSlug, name, contentType, Number(rows[0]?.next ?? 1)],
  );
}

/**
 * Rename a chapter. sortOrder is optional — when omitted only the name is
 * updated so a rename NEVER disturbs the manually arranged display order.
 */
export async function updateTypeChapter(id: string, name: string, sortOrder?: number): Promise<boolean> {
  if (sortOrder === undefined || !Number.isFinite(sortOrder)) {
    const res = await exec("UPDATE course_chapters SET name = ? WHERE id = ?", [name, id]);
    return res.affectedRows > 0;
  }
  const res = await exec(
    "UPDATE course_chapters SET name = ?, sort_order = ? WHERE id = ?",
    [name, sortOrder, id],
  );
  return res.affectedRows > 0;
}

/**
 * Manual content reordering — moves one chapter Up/Down within its own
 * content-type scope (course + subject + paper + content_type). The order is
 * persisted via sort_order so it survives refresh/reload and is reflected on
 * the main website (both admin and student queries ORDER BY sort_order).
 * Swaps sort_order with the adjacent neighbour; no duplication, no deletion,
 * content data untouched — only display position changes.
 */
export async function moveTypeChapter(
  scope: CtypeScope,
  contentType: string,
  id: string,
  direction: "up" | "down",
): Promise<{ moved: boolean }> {
  const rows = await query<{ id: string; sort_order: number }[]>(
    `SELECT ch.id, ch.sort_order FROM course_chapters ch
      WHERE COALESCE(ch.course_slug,'') = ?
        AND COALESCE(ch.subject_id,'') = ?
        AND COALESCE(ch.paper_id,'') = ?
        AND ch.content_type = ?
        AND ch.is_active = 1
      ORDER BY ch.sort_order, ch.name`,
    [scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? "", contentType],
  );
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { moved: false };
  const neighbourIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= rows.length) return { moved: false };
  const current = rows[idx]!;
  const neighbour = rows[neighbourIdx]!;
  // Swap sort_order. If equal (legacy rows), force distinct ordering.
  let orderA = Number(current.sort_order) || 0;
  let orderB = Number(neighbour.sort_order) || 0;
  if (orderA === orderB) {
    orderA = idx + 1;
    orderB = neighbourIdx + 1;
  }
  await exec("UPDATE course_chapters SET sort_order = ? WHERE id = ?", [orderB, current.id]);
  await exec("UPDATE course_chapters SET sort_order = ? WHERE id = ?", [orderA, neighbour.id]);
  return { moved: true };
}

/** Full-order persist: orderedIds[0] becomes sort_order 1, etc. Same scope. */
export async function reorderTypeChapters(
  scope: CtypeScope,
  contentType: string,
  orderedIds: string[],
): Promise<void> {
  let order = 1;
  for (const id of orderedIds) {
    await exec(
      `UPDATE course_chapters SET sort_order = ?
        WHERE id = ? AND COALESCE(course_slug,'') = ?
          AND COALESCE(subject_id,'') = ? AND COALESCE(paper_id,'') = ?
          AND content_type = ? AND is_active = 1`,
      [order++, id, scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? "", contentType],
    );
  }
}

/** Move a content-type card (Class / Exam / Materials / …) Up/Down. */
export async function moveContentType(
  scope: CtypeScope,
  typeKey: string,
  direction: "up" | "down",
): Promise<{ moved: boolean }> {
  const rows = await query<{ type_key: string; sort_order: number }[]>(
    `SELECT type_key, sort_order FROM course_content_types
      WHERE course_slug = ? AND subject_id <=> ? AND paper_id <=> ?
      ORDER BY sort_order ASC`,
    [scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? ""],
  );
  const idx = rows.findIndex((r) => r.type_key === typeKey);
  if (idx < 0) return { moved: false };
  const neighbourIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= rows.length) return { moved: false };
  const current = rows[idx]!;
  const neighbour = rows[neighbourIdx]!;
  let orderA = Number(current.sort_order) || 0;
  let orderB = Number(neighbour.sort_order) || 0;
  if (orderA === orderB) {
    orderA = idx + 1;
    orderB = neighbourIdx + 1;
  }
  await exec(
    `UPDATE course_content_types SET sort_order = ?
      WHERE course_slug = ? AND subject_id <=> ? AND paper_id <=> ? AND type_key = ?`,
    [orderB, scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? "", current.type_key],
  );
  await exec(
    `UPDATE course_content_types SET sort_order = ?
      WHERE course_slug = ? AND subject_id <=> ? AND paper_id <=> ? AND type_key = ?`,
    [orderA, scope.courseSlug, scope.subjectId ?? "", scope.paperId ?? "", neighbour.type_key],
  );
  return { moved: true };
}

export async function deleteTypeChapter(id: string): Promise<void> {
  await exec("UPDATE course_chapters SET is_active = 0 WHERE id = ?", [id]);
}
