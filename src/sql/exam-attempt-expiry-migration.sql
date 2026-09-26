-- Exam attempt fixed server-side expiration (resume-safe exam system).
-- Source of truth: expires_at = started_at + exam duration, set ONCE at
-- attempt creation. Refresh / disconnect / close / tab-switch NEVER changes
-- it; auto-submit happens ONLY when server now >= expires_at (lazy on access).
-- (Runtime ALTERs in src/lib/exam-taking.ts ensureAttemptTables() apply these
-- automatically as well — this file is for explicit/manual migration.)

CREATE TABLE IF NOT EXISTS exam_attempts (
  exam_id VARCHAR(64) NOT NULL,
  student_uid VARCHAR(191) NOT NULL,
  session_token VARCHAR(64) NOT NULL,
  status ENUM('active','submitted') NOT NULL DEFAULT 'active',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_id, student_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP NULL DEFAULT NULL;

-- Widen the status vocabulary: active (=in_progress) + submitted +
-- auto_submitted + expired. Safe: existing values are a subset of the new set.
ALTER TABLE exam_attempts
  MODIFY COLUMN status ENUM('active','submitted','auto_submitted','expired') NOT NULL DEFAULT 'active';

-- Backfill fixed expiry for legacy active attempts:
-- expires_at = started_at + exams.duration_minutes (fallback 30 min).
UPDATE exam_attempts a
  LEFT JOIN exams e ON e.id = a.exam_id
SET a.expires_at = DATE_ADD(a.started_at, INTERVAL COALESCE(e.duration_minutes, 30) MINUTE)
WHERE a.status = 'active' AND a.expires_at IS NULL AND a.started_at IS NOT NULL;

-- Speed up lazy-expiry scans (active attempts past expires_at).
CREATE INDEX IF NOT EXISTS idx_exam_attempts_expiry ON exam_attempts (status, expires_at);
