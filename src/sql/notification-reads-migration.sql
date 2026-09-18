-- Notification read/unread persistence (additive, no data loss).
--
-- One row per (notification, student) in `notification_reads` marks that
-- student as having read the notification. The header indicator shows only
-- while unread rows exist; read state survives refresh and devices.
-- Notification creation, targeting (all/enrolled/student), and delivery are
-- unchanged — existing notification rows are never modified by this script.

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id VARCHAR(64) NOT NULL,
  student_uid VARCHAR(191) NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, student_uid),
  KEY idx_notification_reads_student (student_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
