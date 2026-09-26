-- Finance & Cost Transparency — manual/physical cost storage.
-- Course income is NOT stored here: it is calculated live from `enrollments`.
-- Additive migration (safe to run multiple times).

CREATE TABLE IF NOT EXISTS finance_manual_costs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cost_date DATE NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'Other',
  item_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_by VARCHAR(191) NOT NULL DEFAULT '',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'Cash',
  status VARCHAR(16) NOT NULL DEFAULT 'paid',
  receipt_url VARCHAR(512) NULL,
  note TEXT NULL,
  created_by_uid VARCHAR(191) NULL,
  created_by_email VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  KEY finance_costs_date_idx (cost_date),
  KEY finance_costs_category_idx (category),
  KEY finance_costs_status_idx (status),
  KEY finance_costs_deleted_idx (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_uid VARCHAR(191) NOT NULL DEFAULT '',
  admin_email VARCHAR(191) NOT NULL DEFAULT '',
  action VARCHAR(64) NOT NULL,
  record_id BIGINT UNSIGNED NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY finance_audit_record_idx (record_id),
  KEY finance_audit_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
