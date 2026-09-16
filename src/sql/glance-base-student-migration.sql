-- Add base_student_count to website_settings for the "MediSpark at a Glance" section.
-- Admin can set a manual base number; dynamic student count is added on top.

ALTER TABLE website_settings
  ADD COLUMN base_student_count INT NOT NULL DEFAULT 0
  AFTER show_contact;

-- Seed the "MediSpark at a Glance" homepage section (inactive by default — admin enables it).
INSERT IGNORE INTO homepage_sections (section_key, title, description, sort_order, is_active, updated_by)
VALUES ('glance', 'MediSpark at a Glance', '', 6, 0, NULL);
