-- MediSparkBD — Internal Site Rules (Admin-only) migration
-- Tables are also self-healed at runtime via ensureSiteRulesTables()
-- (src/lib/site-rules.ts), so this file is the auditable source of truth.
-- Additive only: never drops existing tables.

CREATE TABLE IF NOT EXISTS site_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rule_id VARCHAR(32) NOT NULL UNIQUE,
  category VARCHAR(32) NOT NULL DEFAULT 'General',
  title VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'Normal',
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  origin VARCHAR(16) NOT NULL DEFAULT 'existing',
  source_ref VARCHAR(255) NULL,
  reference_note TEXT NULL,
  created_by VARCHAR(191) NULL,
  updated_by VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,
  KEY site_rules_category_idx (category),
  KEY site_rules_status_idx (status),
  KEY site_rules_priority_idx (priority),
  KEY site_rules_updated_idx (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_rule_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rule_id VARCHAR(32) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  title VARCHAR(191) NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'Normal',
  status VARCHAR(16) NOT NULL DEFAULT 'Active',
  changed_by VARCHAR(191) NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY site_rule_versions_unique (rule_id, version),
  KEY site_rule_versions_rule_idx (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_rule_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rule_id VARCHAR(32) NOT NULL,
  action VARCHAR(16) NOT NULL DEFAULT 'Updated',
  old_data JSON NULL,
  new_data JSON NULL,
  performed_by VARCHAR(191) NULL,
  performed_by_uid VARCHAR(191) NULL,
  performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY site_rule_audit_rule_idx (rule_id),
  KEY site_rule_audit_time_idx (performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
