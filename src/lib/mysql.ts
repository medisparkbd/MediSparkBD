import mysql from "mysql2/promise";

export const mysqlHost =
  process.env.MYSQL_HOST ?? process.env.NEXT_PUBLIC_MYSQL_HOST ?? "localhost";
export const mysqlPort = Number(process.env.MYSQL_PORT ?? 3306);
export const mysqlDatabase =
  process.env.MYSQL_DATABASE ?? process.env.NEXT_PUBLIC_MYSQL_DATABASE ?? "";
export const mysqlUser =
  process.env.MYSQL_USER ?? process.env.NEXT_PUBLIC_MYSQL_USER ?? "";
const mysqlPassword =
  process.env.MYSQL_PASSWORD ?? process.env.NEXT_PUBLIC_MYSQL_PASSWORD ?? "";

export const isMysqlConfigured =
  mysqlDatabase.length > 0 &&
  mysqlUser.length > 0 &&
  mysqlHost.length > 0;

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool | null {
  if (!isMysqlConfigured) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: mysqlHost,
      port: mysqlPort,
      database: mysqlDatabase,
      user: mysqlUser,
      password: mysqlPassword,
      // Optimized for Vercel serverless: small pool, fast release
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 15_000,
      connectTimeout: 10_000,
      waitForConnections: true,
      enableKeepAlive: true,
      queueLimit: 50,
      // Azure MySQL enforces TLS
      ssl:
        process.env.MYSQL_SSL === "false"
          ? undefined
          : /azure\.com$/.test(mysqlHost) || process.env.MYSQL_SSL === "true"
            ? { rejectUnauthorized: false }
            : undefined,
      flags: ["FOUND_ROWS"],
    });
  }
  return pool;
}

// Simple in-memory query cache for GET requests (invalidated on mutations)
const queryCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5_000; // 5 seconds default

function cacheKey(sql: string, params?: unknown[]): string {
  return sql + "|" + JSON.stringify(params ?? []);
}

export async function query<T>(
  sql: string,
  params?: unknown[],
  options?: { cache?: number | false },
): Promise<T> {
  const client = getMysqlPool();
  if (!client) throw new Error("Database is not configured.");

  // Cache GET queries (SELECT) by default
  const useCache = options?.cache !== false && sql.trim().toUpperCase().startsWith("SELECT");
  const ttl = typeof options?.cache === "number" ? options.cache : CACHE_TTL;
  const key = cacheKey(sql, params);

  if (useCache) {
    const cached = queryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const [rows] = await client.execute(sql, params as never);
      if (useCache) {
        queryCache.set(key, { data: rows, expires: Date.now() + ttl });
      }
      return rows as T;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "ER_CON_COUNT_ERROR" && attempt === 0) {
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

// Invalidate cache on mutations
export function invalidateQueryCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }
  for (const k of queryCache.keys()) {
    if (k.includes(pattern)) queryCache.delete(k);
  }
}

export async function exec(
  sql: string,
  params?: unknown[],
): Promise<mysql.ResultSetHeader> {
  const client = getMysqlPool();
  if (!client) throw new Error("Database is not configured.");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const [result] = await client.execute<mysql.ResultSetHeader>(sql, params as never);
      // Invalidate relevant cache on write
      const tableMatch = sql.match(/\b(INSERT|UPDATE|DELETE|REPLACE)\s+(?:INTO\s+)?`?(\w+)`?/i);
      if (tableMatch) invalidateQueryCache(tableMatch[2]);
      return result;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "ER_CON_COUNT_ERROR" && attempt === 0) {
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

/**
 * MySQL-safe "add column if missing". MariaDB's `ADD COLUMN IF NOT EXISTS`
 * is not supported by Azure MySQL, so callers self-heal through this instead.
 * `definition` includes the column name, e.g. "`title` VARCHAR(255) NULL".
 */
export async function ensureColumn(
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const rows = await query<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  if ((rows[0]?.n ?? 0) > 0) return;
  await exec(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
}

/**
 * Run a set of statements in a single MySQL transaction — all succeed or
 * all roll back. The connection is row-locked work's own (use
 * `SELECT ... FOR UPDATE` inside for concurrent-safety).
 */
export async function withTransaction<T>(
  work: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const client = getMysqlPool();
  if (!client) {
    throw new Error("Database is not configured.");
  }
  const connection = await client.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* connection already broken */
    }
    throw error;
  } finally {
    connection.release();
  }
}

export function parseDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString();
  }
  return String(raw ?? "");
}

/**
 * Normalize a JSON column value. mysql2 auto-parses JSON columns into
 * objects/arrays, but values may also arrive as strings (raw drivers,
 * legacy rows), so accept both and never throw.
 */
export function parseJsonColumn<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}