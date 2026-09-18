import { query, exec, isMysqlConfigured } from "@/lib/mysql";
import { getCurrentYear } from "@/lib/student-categories";
import {
  getBatchFilterOptions,
  type BatchFilterOption,
  type BatchFilterScope,
} from "@/lib/courses";

/**
 * MySQL-backed batch filter options for the Course pages. The admin edits
 * them from Admin → Course Control → Filter [ Edit ]; the Main Website
 * course pages read this table live (falling back to the built-in defaults
 * until the row is seeded).
 */

export type FilterScope = BatchFilterScope;

export const FILTER_SCOPES: FilterScope[] = ["ssc", "hsc"];

type OptionRow = { options: string | null };

async function ensureTable(): Promise<void> {
  await exec(
    `CREATE TABLE IF NOT EXISTS course_filter_options (
      scope VARCHAR(16) NOT NULL,
      options JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(191) NULL,
      UNIQUE KEY uq_course_filter_options_pk (scope)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
}

function parseOptions(raw: string | null): BatchFilterOption[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const options = parsed
      .map((entry) => {
        const item = entry as { id?: unknown; label?: unknown };
        if (typeof item?.id !== "string" || typeof item?.label !== "string")
          return null;
        return { id: item.id, label: item.label } as BatchFilterOption;
      })
      .filter((option): option is BatchFilterOption => option !== null);
    // First option must be the "all" filter.
    if (options.length === 0 || options[0].id !== "all") return null;
    return options;
  } catch {
    return null;
  }
}

/** Merge saved custom options with the current running-year filter range. */
export function mergeBatchFilterOptions(
  scope: BatchFilterScope,
  savedOptions: readonly BatchFilterOption[] | null | undefined,
  currentYear = getCurrentYear(),
): BatchFilterOption[] {
  const generated = getBatchFilterOptions(scope, currentYear);
  if (!savedOptions?.length || savedOptions[0]?.id !== "all") return generated;

  const generatedIds = new Set(generated.map((option) => option.id));
  const customOptions = savedOptions.filter(
    (option) => option.id !== "all" && !generatedIds.has(option.id),
  );
  return [generated[0], ...generated.slice(1), ...customOptions];
}

/** Saved options for a scope; falls back to the built-in defaults. */
export async function fetchBatchFilterOptions(
  scope: FilterScope,
): Promise<BatchFilterOption[]> {
  if (!isMysqlConfigured) return getBatchFilterOptions(scope);
  try {
    await ensureTable();
    const rows = await query<OptionRow[]>(
      "SELECT options FROM course_filter_options WHERE scope = ? LIMIT 1",
      [scope],
    );
    return mergeBatchFilterOptions(scope, parseOptions(rows[0]?.options ?? null));
  } catch {
    return getBatchFilterOptions(scope);
  }
}

export async function saveBatchFilterOptions(
  scope: FilterScope,
  options: BatchFilterOption[],
  adminUid: string,
): Promise<void> {
  await ensureTable();
  await exec(
    `INSERT INTO course_filter_options (scope, options, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE options = VALUES(options), updated_by = VALUES(updated_by)`,
    [scope, JSON.stringify(options), adminUid],
  );
}
