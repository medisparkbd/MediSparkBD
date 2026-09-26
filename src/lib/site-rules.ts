import { exec, parseJsonColumn, query } from "@/lib/mysql";

// ── Internal Site Rules (Admin-only source of truth) ───────────────────────
// Storage: `site_rules` + `site_rule_versions` + `site_rule_audit_logs`.
// All tables are created lazily (CREATE TABLE IF NOT EXISTS) following the
// codebase convention (see src/lib/exam-rules.ts, src/lib/administration.ts).
// Every mutation is server-side admin-gated in the API routes — never trust
// the client. History is append-only: updates insert a new version row.

export const RULE_CATEGORIES = [
  "General",
  "Course",
  "Exam",
  "Student",
  "Finance",
  "Admin",
  "Content",
  "Technical",
  "AI",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_PRIORITIES = ["Critical", "High", "Normal", "Low"] as const;
export type RulePriority = (typeof RULE_PRIORITIES)[number];

export const RULE_STATUSES = ["Active", "Draft", "Archived"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export type RuleOrigin = "existing" | "proposed";

export type SiteRule = {
  id: number;
  ruleId: string;
  category: RuleCategory;
  title: string;
  description: string;
  priority: RulePriority;
  status: RuleStatus;
  origin: RuleOrigin;
  sourceRef: string | null;
  referenceNote: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type SiteRuleVersion = {
  id: number;
  ruleId: string;
  version: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  changedBy: string | null;
  changedAt: string;
};

export type SiteRuleAudit = {
  id: number;
  ruleId: string;
  action: "Created" | "Updated" | "Archived" | "Restored";
  oldData: unknown;
  newData: unknown;
  performedBy: string | null;
  performedByUid: string | null;
  performedAt: string;
};

export type RuleFilters = {
  q?: string;
  category?: string;
  priority?: string;
  status?: string;
  origin?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
};

/** Category → Rule ID prefix (ADMIN-001, FIN-002, COURSE-015 …). */
export const RULE_PREFIX_BY_CATEGORY: Record<RuleCategory, string> = {
  General: "GEN",
  Course: "COURSE",
  Exam: "EXAM",
  Student: "STU",
  Finance: "FIN",
  Admin: "ADMIN",
  Content: "CONTENT",
  Technical: "TECH",
  AI: "AI",
};

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }
  return String(value ?? "");
}

type RuleRow = {
  id: number;
  rule_id: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  origin: string;
  source_ref: string | null;
  reference_note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
};

function rowToRule(row: RuleRow): SiteRule {
  return {
    id: row.id,
    ruleId: row.rule_id,
    category: (RULE_CATEGORIES as readonly string[]).includes(row.category)
      ? (row.category as RuleCategory)
      : "General",
    title: row.title,
    description: row.description,
    priority: (RULE_PRIORITIES as readonly string[]).includes(row.priority)
      ? (row.priority as RulePriority)
      : "Normal",
    status: (RULE_STATUSES as readonly string[]).includes(row.status)
      ? (row.status as RuleStatus)
      : "Active",
    origin: row.origin === "proposed" ? "proposed" : "existing",
    sourceRef: row.source_ref,
    referenceNote: row.reference_note,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
  };
}

let tablesReady: Promise<void> | null = null;

export function ensureSiteRulesTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await exec(`CREATE TABLE IF NOT EXISTS site_rules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rule_id VARCHAR(32) NOT NULL UNIQUE,
        category VARCHAR(32) NOT NULL DEFAULT 'General',
        title VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(16) NOT NULL DEFAULT 'Normal',
        status VARCHAR(16) NOT NULL DEFAULT 'Active',
        origin VARCHAR(16) NOT NULL DEFAULT 'existing',
        source_ref VARCHAR(255) NULL,
        reference_note TEXT NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        archived_at TIMESTAMP NULL,
        KEY site_rules_category_idx (category),
        KEY site_rules_status_idx (status),
        KEY site_rules_priority_idx (priority),
        KEY site_rules_updated_idx (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await exec(`CREATE TABLE IF NOT EXISTS site_rule_versions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rule_id VARCHAR(32) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        title VARCHAR(191) NOT NULL DEFAULT '',
        description TEXT NOT NULL,
        priority VARCHAR(16) NOT NULL DEFAULT 'Normal',
        status VARCHAR(16) NOT NULL DEFAULT 'Active',
        changed_by VARCHAR(191) NULL,
        changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY site_rule_versions_unique (rule_id, version),
        KEY site_rule_versions_rule_idx (rule_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await exec(`CREATE TABLE IF NOT EXISTS site_rule_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rule_id VARCHAR(32) NOT NULL,
        action VARCHAR(16) NOT NULL DEFAULT 'Updated',
        old_data JSON NULL,
        new_data JSON NULL,
        performed_by VARCHAR(191) NULL,
        performed_by_uid VARCHAR(191) NULL,
        performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY site_rule_audit_rule_idx (rule_id),
        KEY site_rule_audit_time_idx (performed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    })().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}

function sanitizeSort(sort?: string): string {
  switch ((sort ?? "").trim()) {
    case "ruleId":
      return "rule_id";
    case "category":
      return "category";
    case "priority":
      return "priority";
    case "status":
      return "status";
    case "createdAt":
      return "created_at";
    case "updatedAt":
    default:
      return "updated_at";
  }
}

export async function fetchSiteRules(filters: RuleFilters = {}): Promise<SiteRule[]> {
  await ensureSiteRulesTables();
  const where: string[] = [];
  const params: unknown[] = [];
  const q = (filters.q ?? "").trim();
  if (q) {
    const like = `%${q}%`;
    where.push(
      "(rule_id LIKE ? OR title LIKE ? OR description LIKE ? OR category LIKE ? OR created_by LIKE ? OR updated_by LIKE ? OR priority LIKE ? OR status LIKE ?)",
    );
    params.push(like, like, like, like, like, like, like, like);
  }
  if (filters.category && (RULE_CATEGORIES as readonly string[]).includes(filters.category)) {
    where.push("category = ?");
    params.push(filters.category);
  }
  if (filters.priority && (RULE_PRIORITIES as readonly string[]).includes(filters.priority)) {
    where.push("priority = ?");
    params.push(filters.priority);
  }
  if (filters.status && (RULE_STATUSES as readonly string[]).includes(filters.status)) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters.origin === "existing" || filters.origin === "proposed") {
    where.push("origin = ?");
    params.push(filters.origin);
  }
  const sortCol = sanitizeSort(filters.sort);
  const dir = filters.order === "asc" ? "ASC" : "DESC";
  const limit = Math.min(500, Math.max(1, filters.limit ?? 200));
  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query<RuleRow[]>(
    `SELECT * FROM site_rules ${clause} ORDER BY ${sortCol} ${dir} LIMIT ${limit}`,
    params,
    { cache: false },
  );
  return rows.map(rowToRule);
}

export async function fetchSiteRuleByRuleId(ruleId: string): Promise<SiteRule | null> {
  await ensureSiteRulesTables();
  const rows = await query<RuleRow[]>(`SELECT * FROM site_rules WHERE rule_id = ? LIMIT 1`, [
    ruleId.trim().toUpperCase(),
  ], { cache: false });
  return rows[0] ? rowToRule(rows[0]) : null;
}

export async function fetchRuleVersions(ruleId: string): Promise<SiteRuleVersion[]> {
  await ensureSiteRulesTables();
  const rows = await query<{
    id: number;
    rule_id: string;
    version: number;
    title: string;
    description: string;
    priority: string;
    status: string;
    changed_by: string | null;
    changed_at: Date | string;
  }[]>(
    `SELECT * FROM site_rule_versions WHERE rule_id = ? ORDER BY version ASC`,
    [ruleId.trim().toUpperCase()],
    { cache: false },
  );
  return rows.map((r) => ({
    id: r.id,
    ruleId: r.rule_id,
    version: r.version,
    title: r.title,
    description: r.description,
    priority: r.priority,
    status: r.status,
    changedBy: r.changed_by,
    changedAt: toIso(r.changed_at),
  }));
}

export async function fetchRuleAudit(ruleId: string, limit = 100): Promise<SiteRuleAudit[]> {
  await ensureSiteRulesTables();
  const rows = await query<{
    id: number;
    rule_id: string;
    action: string;
    old_data: unknown;
    new_data: unknown;
    performed_by: string | null;
    performed_by_uid: string | null;
    performed_at: Date | string;
  }[]>(
    `SELECT * FROM site_rule_audit_logs WHERE rule_id = ? ORDER BY performed_at DESC LIMIT ${Math.min(500, Math.max(1, limit))}`,
    [ruleId.trim().toUpperCase()],
    { cache: false },
  );
  return rows.map((r) => ({
    id: r.id,
    ruleId: r.rule_id,
    action: (["Created", "Updated", "Archived", "Restored"] as const).includes(r.action as never)
      ? (r.action as SiteRuleAudit["action"])
      : "Updated",
    oldData: parseJsonColumn(r.old_data),
    newData: parseJsonColumn(r.new_data),
    performedBy: r.performed_by,
    performedByUid: r.performed_by_uid,
    performedAt: toIso(r.performed_at),
  }));
}

export async function fetchRecentRuleAudit(limit = 200): Promise<SiteRuleAudit[]> {
  await ensureSiteRulesTables();
  const rows = await query<{
    id: number;
    rule_id: string;
    action: string;
    old_data: unknown;
    new_data: unknown;
    performed_by: string | null;
    performed_by_uid: string | null;
    performed_at: Date | string;
  }[]>(
    `SELECT * FROM site_rule_audit_logs ORDER BY performed_at DESC LIMIT ${Math.min(500, Math.max(1, limit))}`,
    [],
    { cache: false },
  );
  return rows.map((r) => ({
    id: r.id,
    ruleId: r.rule_id,
    action: (["Created", "Updated", "Archived", "Restored"] as const).includes(r.action as never)
      ? (r.action as SiteRuleAudit["action"])
      : "Updated",
    oldData: parseJsonColumn(r.old_data),
    newData: parseJsonColumn(r.new_data),
    performedBy: r.performed_by,
    performedByUid: r.performed_by_uid,
    performedAt: toIso(r.performed_at),
  }));
}

export function validateRuleInput(input: Record<string, unknown>): {
  ruleId: string;
  category: RuleCategory;
  title: string;
  description: string;
  priority: RulePriority;
  status: RuleStatus;
  sourceRef: string | null;
  referenceNote: string | null;
} {
  const categoryRaw = typeof input.category === "string" ? input.category.trim() : "";
  if (!(RULE_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    throw new Error("A valid category is required.");
  }
  const category = categoryRaw as RuleCategory;
  const rawId = typeof input.ruleId === "string" ? input.ruleId.trim().toUpperCase() : "";
  const expectedPrefix = RULE_PREFIX_BY_CATEGORY[category];
  if (!rawId) throw new Error("Rule ID is required.");
  if (!/^[A-Z]+-[0-9]{3,6}$/.test(rawId)) {
    throw new Error("Rule ID must look like PREFIX-001 (e.g. ADMIN-001).");
  }
  if (!rawId.startsWith(`${expectedPrefix}-`)) {
    throw new Error(`Rule ID for ${category} must start with ${expectedPrefix}-.`);
  }
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 191) : "";
  if (title.length < 4) throw new Error("Rule title is required (min 4 characters).");
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 10) throw new Error("Rule description is required (min 10 characters).");
  const priorityRaw = typeof input.priority === "string" ? input.priority.trim() : "Normal";
  if (!(RULE_PRIORITIES as readonly string[]).includes(priorityRaw)) {
    throw new Error("A valid priority is required.");
  }
  const statusRaw = typeof input.status === "string" ? input.status.trim() : "Active";
  if (!(RULE_STATUSES as readonly string[]).includes(statusRaw)) {
    throw new Error("A valid status is required.");
  }
  const sourceRef =
    typeof input.sourceRef === "string" && input.sourceRef.trim()
      ? input.sourceRef.trim().slice(0, 255)
      : null;
  const referenceNote =
    typeof input.referenceNote === "string" && input.referenceNote.trim()
      ? input.referenceNote.trim().slice(0, 2000)
      : null;
  return {
    ruleId: rawId,
    category,
    title,
    description,
    priority: priorityRaw as RulePriority,
    status: statusRaw as RuleStatus,
    sourceRef,
    referenceNote,
  };
}

/** Next auto Rule ID for a category (e.g. ADMIN-009 → ADMIN-010). */
export async function nextRuleId(category: RuleCategory): Promise<string> {
  await ensureSiteRulesTables();
  const prefix = RULE_PREFIX_BY_CATEGORY[category];
  const rows = await query<{ rule_id: string }[]>(
    `SELECT rule_id FROM site_rules WHERE rule_id LIKE ? ORDER BY rule_id DESC LIMIT 20`,
    [`${prefix}-%`],
    { cache: false },
  );
  let max = 0;
  for (const r of rows) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(r.rule_id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

async function insertVersion(
  ruleId: string,
  version: number,
  data: { title: string; description: string; priority: string; status: string },
  changedBy: string | null,
): Promise<void> {
  await exec(
    `INSERT INTO site_rule_versions (rule_id, version, title, description, priority, status, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ruleId, version, data.title, data.description, data.priority, data.status, changedBy],
  );
}

async function insertAudit(
  ruleId: string,
  action: SiteRuleAudit["action"],
  oldData: unknown,
  newData: unknown,
  performedBy: string | null,
  performedByUid: string | null,
): Promise<void> {
  await exec(
    `INSERT INTO site_rule_audit_logs (rule_id, action, old_data, new_data, performed_by, performed_by_uid)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      ruleId,
      action,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      performedBy,
      performedByUid,
    ],
  );
}

export async function createSiteRule(
  input: Record<string, unknown>,
  actor: { email: string | null; uid: string },
  origin: RuleOrigin = "existing",
): Promise<SiteRule> {
  const v = validateRuleInput(input);
  await ensureSiteRulesTables();
  const dup = await query<{ id: number }[]>(`SELECT id FROM site_rules WHERE rule_id = ? LIMIT 1`, [
    v.ruleId,
  ], { cache: false });
  if (dup.length > 0) throw new Error(`Rule ID ${v.ruleId} already exists.`);
  const actorLabel = actor.email ?? actor.uid;
  await exec(
    `INSERT INTO site_rules (rule_id, category, title, description, priority, status, origin, source_ref, reference_note, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      v.ruleId,
      v.category,
      v.title,
      v.description,
      v.priority,
      v.status,
      origin,
      v.sourceRef,
      v.referenceNote,
      actorLabel,
      actorLabel,
    ],
  );
  await insertVersion(v.ruleId, 1, { title: v.title, description: v.description, priority: v.priority, status: v.status }, actorLabel);
  await insertAudit(v.ruleId, "Created", null, v, actorLabel, actor.uid);
  const created = await fetchSiteRuleByRuleId(v.ruleId);
  if (!created) throw new Error("Failed to create the rule.");
  return created;
}

export async function updateSiteRule(
  ruleId: string,
  input: Record<string, unknown>,
  actor: { email: string | null; uid: string },
): Promise<SiteRule> {
  const cleanId = ruleId.trim().toUpperCase();
  const v = validateRuleInput({ ...input, ruleId: cleanId });
  await ensureSiteRulesTables();
  const existing = await fetchSiteRuleByRuleId(cleanId);
  if (!existing) throw new Error("Rule not found.");
  if (existing.status === "Archived") throw new Error("Archived rules cannot be edited. Restore it first.");
  const actorLabel = actor.email ?? actor.uid;
  const oldData = { ...existing };
  await exec(
    `UPDATE site_rules SET title = ?, description = ?, priority = ?, status = ?, source_ref = ?, reference_note = ?, updated_by = ? WHERE rule_id = ?`,
    [v.title, v.description, v.priority, v.status, v.sourceRef, v.referenceNote, actorLabel, cleanId],
  );
  const versions = await fetchRuleVersions(cleanId);
  const nextVersion = versions.length > 0 ? Math.max(...versions.map((x) => x.version)) + 1 : 2;
  await insertVersion(cleanId, nextVersion, { title: v.title, description: v.description, priority: v.priority, status: v.status }, actorLabel);
  await insertAudit(cleanId, "Updated", oldData, v, actorLabel, actor.uid);
  const updated = await fetchSiteRuleByRuleId(cleanId);
  if (!updated) throw new Error("Failed to update the rule.");
  return updated;
}

export async function setRuleArchived(
  ruleId: string,
  archived: boolean,
  actor: { email: string | null; uid: string },
): Promise<SiteRule> {
  const cleanId = ruleId.trim().toUpperCase();
  await ensureSiteRulesTables();
  const existing = await fetchSiteRuleByRuleId(cleanId);
  if (!existing) throw new Error("Rule not found.");
  const actorLabel = actor.email ?? actor.uid;
  const oldData = { ...existing };
  if (archived) {
    await exec(`UPDATE site_rules SET status = 'Archived', archived_at = NOW(), updated_by = ? WHERE rule_id = ?`, [
      actorLabel,
      cleanId,
    ]);
  } else {
    await exec(`UPDATE site_rules SET status = 'Active', archived_at = NULL, updated_by = ? WHERE rule_id = ?`, [
      actorLabel,
      cleanId,
    ]);
  }
  const versions = await fetchRuleVersions(cleanId);
  const nextVersion = versions.length > 0 ? Math.max(...versions.map((x) => x.version)) + 1 : 2;
  const after = await fetchSiteRuleByRuleId(cleanId);
  await insertVersion(
    cleanId,
    nextVersion,
    { title: after?.title ?? existing.title, description: after?.description ?? existing.description, priority: after?.priority ?? existing.priority, status: after?.status ?? "Active" },
    actorLabel,
  );
  await insertAudit(cleanId, archived ? "Archived" : "Restored", oldData, after, actorLabel, actor.uid);
  if (!after) throw new Error("Failed to update the rule.");
  return after;
}

// ── Seed: discovered from the current codebase (Existing) + gaps (Proposed) ─
// Existing = enforced or documented today. Proposed = recommended, NOT enforced.
// Every entry carries a source reference so the page works as internal truth.

type SeedRule = {
  ruleId: string;
  category: RuleCategory;
  title: string;
  description: string;
  priority: RulePriority;
  status: RuleStatus;
  origin: RuleOrigin;
  sourceRef: string;
  referenceNote?: string;
};

export function buildSeedRules(): SeedRule[] {
  return [
    {
      ruleId: "ADMIN-001",
      category: "Admin",
      title: "Admin authorization must be enforced server-side",
      description:
        "Hiding admin buttons in the UI is NOT authorization. Every admin mutation is gated server-side via requireAdmin / requirePermission / requireAnyPermission (Firebase token → admins table lookup). Client-side hasControlAccess only controls navigation visibility.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/admin.ts",
      referenceNote: "Documented in CODEBASE_SUMMARY.md → Security Features",
    },
    {
      ruleId: "ADMIN-002",
      category: "Admin",
      title: "Dual-key admin lookup (UID + verified email fallback)",
      description:
        "Admin checks match by Firebase UID OR verified email in a single query so access survives a Firebase project change. Only verified emails are trusted for the fallback. Inactive admins (is_active=0) are always denied.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/admin.ts → isAdminUid",
    },
    {
      ruleId: "ADMIN-003",
      category: "Admin",
      title: "Role → Permission → Control is fail-closed",
      description:
        "Unknown controls, missing roles, or missing permissions DENY access. Only role admin bypasses. Canonical matrix lives in src/lib/admin-access.ts and is shared by UI and API. Moderator holds 9/10 permissions (no manageAdmins); Teacher holds exactly 6 teaching permissions.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/admin-access.ts",
      referenceNote: "Covered by tests/admin-authorization.test.ts",
    },
    {
      ruleId: "ADMIN-004",
      category: "Admin",
      title: "All admin actions are audit-logged",
      description:
        "Admin mutations log to admin_activity_logs (admin_uid, admin_email, action, detail, ip). Logging is best-effort and never breaks the request. Login events are recorded at most once per 30 minutes per admin.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/administration.ts → logAdminAction",
    },
    {
      ruleId: "ADMIN-005",
      category: "Admin",
      title: "manageAdmins is Admin-only and can never be delegated",
      description:
        "saveRolePermissions strips manageAdmins for moderator/teacher server-side. Admin Center and Administration pages require manageAdmins. Admin role itself can never be downgraded via the matrix.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/administration.ts → saveRolePermissions",
    },
    {
      ruleId: "GEN-001",
      category: "General",
      title: "Google sign-in is the only authentication method",
      description:
        "Users authenticate with Firebase Google Sign-In (popup + redirect fallback, browserLocalPersistence). No second auth system may be introduced; all features reuse the Firebase token.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/auth-context.tsx",
    },
    {
      ruleId: "TECH-001",
      category: "Technical",
      title: "APIs verify Firebase Bearer tokens server-side",
      description:
        "getFirebaseUser extracts the Bearer token and verifies it with the Firebase Admin SDK. Missing/invalid tokens return null and the route responds 401. No user API trusts client-claimed identity.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/auth-api.ts + src/lib/firebase-admin.ts",
    },
    {
      ruleId: "TECH-002",
      category: "Technical",
      title: "Database access uses pooled parameterized queries",
      description:
        "Azure MySQL via mysql2 pool (max 8 connections, serverless-friendly). All queries use placeholders; pool.query (text protocol) is used to halve WAN round-trips vs prepared statements. TLS enforced for *.azure.com hosts.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/mysql.ts",
    },
    {
      ruleId: "TECH-003",
      category: "Technical",
      title: "Schema changes are additive with lazy self-healing",
      description:
        "Tables use CREATE TABLE IF NOT EXISTS on first use; backward-compatible columns are added via ensureColumn (information_schema check) because Azure MySQL lacks ADD COLUMN IF NOT EXISTS. Never destructively delete existing tables.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/mysql.ts → ensureColumn",
      referenceNote: "CODEBASE_SUMMARY.md → Lazy Table Creation; migrations in src/sql/",
    },
    {
      ruleId: "TECH-004",
      category: "Technical",
      title: "SELECT caching is short-TTL and invalidated on writes",
      description:
        "In-memory LRU query cache (500 entries, 5s TTL) applies to SELECT only (never FOR UPDATE or information_schema). INSERT/UPDATE/DELETE invalidate matching table keys. Stale reads older than 5s are not a correctness mechanism.",
      priority: "Normal",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/mysql.ts → query cache",
    },
    {
      ruleId: "COURSE-001",
      category: "Course",
      title: "Course visibility requires published + available",
      description:
        "catalog_courses rows carry status (published/unpublished) and availability (available/hidden). Only published + available courses appear publicly. Admin create/update/delete flows through /api/admin/courses with validation.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "CODEBASE_SUMMARY.md → catalog_courses; src/app/api/admin/courses",
    },
    {
      ruleId: "COURSE-002",
      category: "Course",
      title: "Paid enrollment needs payment proof + admin approval",
      description:
        "Paid enrollment POST requires transactionId (4–64 chars), senderMobile (01XXXXXXXXX), paymentMethod (bkash/nagad). Server checks: registered student, course exists, no active enrollment, unique transaction ID, max one pending application per course. Row starts pending; admin approval flips it to active.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/app/api/enrollments + CODEBASE_SUMMARY.md → Course Enrollment",
    },
    {
      ruleId: "COURSE-003",
      category: "Course",
      title: "Free enrollment path stays instant but validated",
      description:
        "Free courses enroll instantly without payment proof, but still validate course existence and duplicate enrollment server-side.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "src/app/api/enrollments",
    },
    {
      ruleId: "EXAM-001",
      category: "Exam",
      title: "Correct answers never leave the server during exams",
      description:
        "Exam GET returns sanitized questions without correct answers. All scoring happens server-side post-submission with negative marking and second-timer penalties. Client state holds only selected options.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/exam-taking.ts; src/app/api/exams/[id]",
    },
    {
      ruleId: "EXAM-002",
      category: "Exam",
      title: "Exam attempts enforce window, limit, and session locks",
      description:
        "Start validates: published + active exam, within lifecycle window, attempt limit not exceeded. Creates exam_attempt (in_progress) + exam_session (device tracking). New device auto-submits the previous session; timer expiry auto-submits locked answers.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/exam-taking.ts + src/lib/exam-lifecycle.ts",
    },
    {
      ruleId: "EXAM-003",
      category: "Exam",
      title: "Per-exam display rules are strictly exam-scoped",
      description:
        "exam_rules rows belong to exactly one exam_id and are never shared. Updates/deletes/reorders always filter by (id AND exam_id). New exams seed the standard 8-rule Bangla set, editable afterwards.",
      priority: "Normal",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/exam-rules.ts",
    },
    {
      ruleId: "EXAM-004",
      category: "Exam",
      title: "Exam kinds and states are the source of truth",
      description:
        "kind ∈ {public, practice, enrolled}; status ∈ {draft, published, closed}. kind drives access control as a layer on top of the unified engine. draft is invisible, closed blocks new attempts.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "CODEBASE_SUMMARY.md → Unified Exam Engine",
    },
    {
      ruleId: "STU-001",
      category: "Student",
      title: "Student identity is Firebase UID + MS-XXXXXXXX",
      description:
        "students.uid is the Firebase UID (PK); student_id is a MS-XXXXXXXX unique handle backed by the student_ids uniqueness table. Profile + enrollment state drive all access decisions.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "CODEBASE_SUMMARY.md → students; src/sql/students-enrollments-migration.sql",
    },
    {
      ruleId: "STU-002",
      category: "Student",
      title: "Q&A asking requires active paid enrollment",
      description:
        "POST /api/qa validates: authenticated, enrolled active in the submitted course, at least one active paid enrollment, category→course→subject chain, text 5–2000 chars. Image attachments allowed; audio submissions are not accepted.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "src/app/api/qa; src/lib/qa-store.ts",
    },
    {
      ruleId: "FIN-001",
      category: "Finance",
      title: "Coupon discounts are recalculated server-side",
      description:
        "Client discount values are never trusted. Enrollment and coupon validation recompute discounted fees server-side, check usage limits and validity windows before applying.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/coupons.ts; src/app/api/enrollments",
    },
    {
      ruleId: "FIN-002",
      category: "Finance",
      title: "Payment transaction IDs must be unique",
      description:
        "Duplicate transaction IDs are rejected to prevent double-spend payment proofs. Enrollment application creation is transactional with row locks (SELECT ... FOR UPDATE) against races.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/mysql.ts → withTransaction; CODEBASE_SUMMARY.md",
    },
    {
      ruleId: "CONTENT-001",
      category: "Content",
      title: "Media is VM-hosted with token-authenticated operations",
      description:
        "Files live on medispark.duckdns.org (/var/www/medispark-uploads/), served by nginx. Upload/delete require MEDIA_UPLOAD_TOKEN (X-Medifiles-Token). DB stores URLs only, except legacy LONGBLOB fallback via /api/files/<id>.",
      priority: "High",
      status: "Active",
      origin: "existing",
      sourceRef: "src/lib/storage.ts; server/medifiles-server.mjs",
    },
    {
      ruleId: "CONTENT-002",
      category: "Content",
      title: "Public content lists only publishable states",
      description:
        "Reviews API returns published only; FAQs/banners/mentors respect is_active / status flags. Admin moderation flips states; deletion paths clean up VM files.",
      priority: "Normal",
      status: "Active",
      origin: "existing",
      sourceRef: "src/app/api/reviews; src/lib/reviews-store.ts; src/lib/faq-store.ts",
    },
    {
      ruleId: "TECH-005",
      category: "Technical",
      title: "Secrets live in environment, never in code",
      description:
        "MySQL, Firebase Admin, and media tokens come from env (Vercel dashboard / .env). Never commit secrets, never force-push main. Production build strips non-error console output.",
      priority: "Critical",
      status: "Active",
      origin: "existing",
      sourceRef: "next.config.ts; CODEBASE_SUMMARY.md → Key Rules",
    },
    // ── Proposed (NOT enforced today — gaps found during inspection) ──
    {
      ruleId: "FIN-003",
      category: "Finance",
      title: "Course income ledger with immutable audit trail (proposed)",
      description:
        "PROPOSED — not currently enforced: no income/expense ledger tables were found in src/sql or the summary. Recommendation: append-only ledger (income from enrollments, manual costs, admin spending, refunds) with.actor + timestamp, reconciled against enrollment approvals.",
      priority: "High",
      status: "Draft",
      origin: "proposed",
      sourceRef: "GAP: no ledger tables in src/sql (inspected Sep 2026)",
      referenceNote: "Requires new tables + admin finance UI before activation",
    },
    {
      ruleId: "FIN-004",
      category: "Finance",
      title: "Refund workflow with approval states (proposed)",
      description:
        "PROPOSED — not currently enforced: no refund tables or refund API found. Recommendation: refund request → evidence → admin approve/reject → ledger entry, with enrollment status transitions defined.",
      priority: "Normal",
      status: "Draft",
      origin: "proposed",
      sourceRef: "GAP: no refund handling in API_REFERENCE.md",
    },
    {
      ruleId: "TECH-006",
      category: "Technical",
      title: "API rate limiting per IP and per user (proposed)",
      description:
        "PROPOSED — not currently enforced: codebase explicitly documents no rate limiting (DDoS risk). Recommendation: edge + route-level throttles, stricter on auth, upload, and exam-submit endpoints.",
      priority: "High",
      status: "Draft",
      origin: "proposed",
      sourceRef: "CODEBASE_SUMMARY.md → Known Limitations #2",
    },
    {
      ruleId: "TECH-007",
      category: "Technical",
      title: "Automated database backup and restore drills (proposed)",
      description:
        "PROPOSED — not currently enforced: backups are manual MySQL dumps. Recommendation: scheduled Azure backups + tested restore runbook owned by Admin Center.",
      priority: "High",
      status: "Draft",
      origin: "proposed",
      sourceRef: "CODEBASE_SUMMARY.md → Known Limitations #6",
    },
    {
      ruleId: "AI-001",
      category: "AI",
      title: "AI-generated content requires human review (proposed)",
      description:
        "PROPOSED — not currently enforced: no AI generation pipeline or review gates found in the codebase. Recommendation: label AI drafts, require teacher/admin approval before publish, validate question/answer keys independently.",
      priority: "High",
      status: "Draft",
      origin: "proposed",
      sourceRef: "GAP: no AI modules in src/lib (inspected Sep 2026)",
    },
    {
      ruleId: "AI-002",
      category: "AI",
      title: "AI voice/video attribution and consent log (proposed)",
      description:
        "PROPOSED — not currently enforced. Recommendation: store model, prompt version, voice consent, and publish approval per asset before any AI media ships.",
      priority: "Normal",
      status: "Draft",
      origin: "proposed",
      sourceRef: "GAP: no AI media workflow found",
    },
  ];
}

/** Idempotent seed — inserts missing rule_ids only, never overwrites edits. */
export async function seedSiteRules(actorLabel = "system"): Promise<{ inserted: number; total: number }> {
  await ensureSiteRulesTables();
  const seeds = buildSeedRules();
  let inserted = 0;
  for (const s of seeds) {
    const existing = await query<{ id: number }[]>(
      `SELECT id FROM site_rules WHERE rule_id = ? LIMIT 1`,
      [s.ruleId],
      { cache: false },
    );
    if (existing.length > 0) continue;
    await exec(
      `INSERT INTO site_rules (rule_id, category, title, description, priority, status, origin, source_ref, reference_note, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.ruleId, s.category, s.title, s.description, s.priority, s.status, s.origin, s.sourceRef, s.referenceNote ?? null, actorLabel, actorLabel],
    );
    await insertVersion(
      s.ruleId,
      1,
      { title: s.title, description: s.description, priority: s.priority, status: s.status },
      actorLabel,
    );
    await insertAudit(s.ruleId, "Created", null, s, actorLabel, null);
    inserted += 1;
  }
  return { inserted, total: seeds.length };
}
