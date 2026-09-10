-- Social Links extended for Join With Us Now! custom platforms
-- Adds label and icon columns to support arbitrary platforms (Facebook, YouTube, Telegram, Instagram, WhatsApp, TikTok, custom)
-- Existing DBs created before this column will be healed via ensureColumn() but explicit ALTER ensures fresh installs.

ALTER TABLE social_links
  ADD COLUMN IF NOT EXISTS `label` VARCHAR(100) NULL AFTER platform_key,
  ADD COLUMN IF NOT EXISTS `icon` VARCHAR(1024) NULL AFTER label;

-- Backfill labels for existing known keys where label is NULL
UPDATE social_links SET label = 'Facebook' WHERE platform_key = 'facebook' AND (label IS NULL OR label = '');
UPDATE social_links SET label = 'YouTube' WHERE platform_key = 'youtube' AND (label IS NULL OR label = '');
UPDATE social_links SET label = 'Telegram' WHERE platform_key = 'telegram' AND (label IS NULL OR label = '');
UPDATE social_links SET label = 'Instagram' WHERE platform_key = 'instagram' AND (label IS NULL OR label = '');
UPDATE social_links SET label = 'LinkedIn' WHERE platform_key = 'linkedin' AND (label IS NULL OR label = '');
UPDATE social_links SET label = 'WhatsApp' WHERE platform_key = 'whatsapp' AND (label IS NULL OR label = '');
UPDATE social_links SET label = 'TikTok' WHERE platform_key = 'tiktok' AND (label IS NULL OR label = '');

-- Ensure whatsapp/tiktok exist for installations that only had 2-5 rows
INSERT IGNORE INTO social_links (platform_key, label, sort_order, is_active) VALUES
  ('whatsapp', 'WhatsApp', 6, 0),
  ('tiktok', 'TikTok', 7, 0);
