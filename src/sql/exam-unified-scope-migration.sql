-- Unified Exam System — scope/type migration (additive, no data loss).
--
-- ONE engine (`exams` + `exam_questions` + `exam_results` + `exam_attempts`),
-- TWO access scopes derived from `kind`:
--   PUBLIC → kind public/practice — publicly visible, everyone can attempt.
--   COURSE → kind enrolled — only enrolled + eligible students of the linked
--            course_id (exam_courses, or the chapter → subject → course chain).
--
-- The `type` column (public/course) mirrors the scope for SQL-level filtering.
-- Existing exam / question / result / attempt rows are preserved; this script
-- only backfills the scope marker.

ALTER TABLE exams
  MODIFY COLUMN kind ENUM('public','practice','enrolled') NOT NULL DEFAULT 'public';

-- NOTE: MySQL has no ADD COLUMN IF NOT EXISTS; run the next statement only
-- when the `type` column is missing (the app's ensureTables() already adds +
-- backfills it automatically on boot, so manual runs rarely need this).
-- ALTER TABLE exams ADD COLUMN `type` ENUM('public','course') NOT NULL DEFAULT 'public' AFTER `kind`;

-- Backfill scope from the canonical `kind` (idempotent, safe to re-run).
UPDATE exams SET `type` = 'course' WHERE kind = 'enrolled';
UPDATE exams SET `type` = 'public' WHERE kind IN ('public', 'practice');

-- Scope lookup index (ignore the error if it already exists).
-- CREATE INDEX idx_exams_scope_status ON exams(kind, status);
