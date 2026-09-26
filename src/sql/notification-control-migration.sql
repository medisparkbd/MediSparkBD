-- Admin Panel → Notification Control migration mirror.
-- The app self-heals via CREATE TABLE IF NOT EXISTS + guarded ALTERs in
-- src/lib/content-admin.ts and src/lib/notification-events.ts; this file is
-- the reference mirror (repo convention for src/sql/*.sql).
--
-- Scopes: ALL STUDENTS (audience all) / ENROLLED (audience enrolled +
-- target_course_id) / SPECIFIC STUDENT (audience student + target_uid).
-- Origin: manual (admin-composed) vs automatic (system-event generated).

ALTER TABLE notifications
  ADD COLUMN target_course_id VARCHAR(191) NULL AFTER target_email,
  ADD COLUMN origin ENUM('manual','automatic') NOT NULL DEFAULT 'manual' AFTER target_course_id,
  ADD COLUMN event_key VARCHAR(191) NULL AFTER origin,
  ADD UNIQUE KEY uq_notifications_event_key (event_key);

-- Once-only ledger for automatic notifications (INSERT IGNORE = atomic
-- duplicate guard; refreshes and repeated reads can never resend).
CREATE TABLE IF NOT EXISTS notification_events (
  event_key VARCHAR(191) NOT NULL PRIMARY KEY,
  notification_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_events_notification (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin-configurable automatic-event toggles + title/message templates.
CREATE TABLE IF NOT EXISTS notification_settings (
  scope_key VARCHAR(64) NOT NULL PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  title_template VARCHAR(255) NULL,
  message_template TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
