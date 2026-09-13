-- Exam Language Version + Set A/B + Question Order Randomization.
-- Permanent Question IDs = exam_questions.id (never the display serial).
-- The 4 contents per slot live in exam_question_variants; no auto-translation.
-- Runtime also auto-creates these via ensureVariantTables() (exam-variants.ts),
-- so this file is the canonical offline migration (apply over SSH like others).
-- NOTE: Azure MySQL does not support ADD COLUMN IF NOT EXISTS — plain
-- ADD COLUMN is used (safe to run once; runtime self-heals via ensureColumn).

CREATE TABLE IF NOT EXISTS exam_question_variants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  lang ENUM('bangla','english') NOT NULL,
  set_label ENUM('A','B') NOT NULL,
  question TEXT NOT NULL,
  options JSON NOT NULL,
  correct_index INT NOT NULL DEFAULT 0,
  explanation TEXT NULL,
  marks DECIMAL(5,2) NOT NULL DEFAULT 1,
  question_image VARCHAR(1024) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_variant_slot (question_id, lang, set_label),
  KEY idx_variant_lang_set (lang, set_label),
  CONSTRAINT fk_eqv_question FOREIGN KEY (question_id)
    REFERENCES exam_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-attempt lock (exam_attempts): selected version + server-assigned set + shuffled order.
ALTER TABLE exam_attempts
  ADD COLUMN question_version ENUM('bangla','english') NULL AFTER timer_type,
  ADD COLUMN assigned_set ENUM('A','B') NULL AFTER question_version,
  ADD COLUMN question_order JSON NULL AFTER assigned_set;

-- Result snapshot (exam_results): replay the student's version/set/order in the answer script.
ALTER TABLE exam_results
  ADD COLUMN question_version ENUM('bangla','english') NULL AFTER attempt_type,
  ADD COLUMN assigned_set ENUM('A','B') NULL AFTER question_version,
  ADD COLUMN question_order JSON NULL AFTER assigned_set;
