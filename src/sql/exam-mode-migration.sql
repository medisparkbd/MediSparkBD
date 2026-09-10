-- Exam Mode — Live Exam / Practice Exam classification for Public Exams.
-- Separate from Published/Draft and Running/Upcoming/Expired.
-- Default 'live' preserves existing exams as Live Exams.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_mode ENUM('live','practice') NOT NULL DEFAULT 'live' AFTER kind;

-- Backfill: keep current public exams as 'live' unless title hints practice (do not infer — keep live for all)
-- Admin will reclassify via Admin Panel → Public Exam Control → Exam Mode.

-- Ensure index for filtering.
CREATE INDEX IF NOT EXISTS idx_exams_exam_mode ON exams (exam_mode);
