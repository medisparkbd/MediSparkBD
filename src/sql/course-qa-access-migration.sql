-- Course Control: course-level Q&A access control (ON / OFF)
-- Adds qa_access column to catalog_courses.
-- Default is 1 (ON).

ALTER TABLE catalog_courses
  ADD COLUMN IF NOT EXISTS qa_access TINYINT(1) NOT NULL DEFAULT 1 AFTER coupon_enabled;
