-- Add base_student_count to website_settings for the "MediSpark at a Glance" section.
-- Admin can set a manual base number; dynamic student count is added on top.

ALTER TABLE website_settings
  ADD COLUMN base_student_count INT NOT NULL DEFAULT 0
  AFTER show_contact;
