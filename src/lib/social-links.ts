import { exec, query, ensureColumn } from "@/lib/mysql";
import { getWebsiteSettingsWithFallback } from "@/lib/website-settings";
import {
  SOCIAL_PLATFORMS,
  getSocialLabel,
  type SocialLink,
  type SocialPlatformKey,
} from "@/lib/social-links-constants";

type SocialLinkRow = {
  platform_key: string;
  label: string | null;
  icon: string | null;
  url: string | null;
  is_active: number | boolean;
  sort_order: number;
};

async function ensureSocialLinksTable(): Promise<void> {
  await exec(
    `CREATE TABLE IF NOT EXISTS social_links (
      platform_key VARCHAR(50) NOT NULL PRIMARY KEY,
      label VARCHAR(100) NULL,
      icon VARCHAR(1024) NULL,
      url VARCHAR(1024) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(191) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  try {
    await ensureColumn("social_links", "label", "`label` VARCHAR(100) NULL");
    await ensureColumn("social_links", "icon", "`icon` VARCHAR(1024) NULL");
  } catch {
    /* ignore if already exists or MySQL unavailable */
  }
}

async function seedDefaults(): Promise<void> {
  for (let index = 0; index < SOCIAL_PLATFORMS.length; index += 1) {
    await query(
      `INSERT IGNORE INTO social_links (platform_key, label, sort_order, is_active)
       VALUES (?, ?, ?, 1)`,
      [SOCIAL_PLATFORMS[index].key, SOCIAL_PLATFORMS[index].label, index + 1],
    );
  }
}

async function ensureSchema(): Promise<void> {
  await ensureSocialLinksTable();
  await seedDefaults();
}

/**
 * All social platforms with their state — fully DB-driven.
 * Supports custom platforms beyond SOCIAL_PLATFORMS.
 * Falls back to website_settings URLs when the table is empty/unavailable
 * so the footer keeps working before the migration is applied.
 */
export async function fetchAllSocialLinks(): Promise<SocialLink[]> {
  try {
    await ensureSchema();
    const rows = await query<SocialLinkRow[]>(
      `SELECT platform_key, label, icon, url, is_active, sort_order FROM social_links ORDER BY sort_order ASC`,
    );

    if (rows.length === 0) return await buildFallback();

    return rows.map((row) => ({
      key: row.platform_key,
      label: row.label?.trim() || getSocialLabel(row.platform_key),
      url: row.url ?? null,
      isActive: Boolean(row.is_active),
      icon: row.icon ?? null,
      sortOrder: Number(row.sort_order) || 0,
    }));
  } catch {
    return buildFallback();
  }
}

/** Active platforms only — used by the live website footer. */
export async function fetchActiveSocialLinks(): Promise<SocialLink[]> {
  const all = await fetchAllSocialLinks();
  return all.filter((link) => link.isActive && link.url);
}

async function buildFallback(): Promise<SocialLink[]> {
  const settings = await getWebsiteSettingsWithFallback();
  return [
    {
      key: "facebook",
      label: "Facebook",
      url: settings.facebookUrl || null,
      isActive: Boolean(settings.facebookUrl),
    },
    {
      key: "youtube",
      label: "YouTube",
      url: settings.youtubeUrl || null,
      isActive: Boolean(settings.youtubeUrl),
    },
    {
      key: "telegram",
      label: "Telegram",
      url: null,
      isActive: false,
    },
  ];
}

export type SocialLinkUpdate = {
  key: SocialPlatformKey;
  label?: string | null;
  icon?: string | null;
  url: string | null;
  isActive: boolean;
};

export async function saveSocialLinks(
  updates: SocialLinkUpdate[],
  adminUid: string,
): Promise<SocialLink[]> {
  await ensureSchema();

  for (const update of updates) {
    if (update.url && !isValidHttpUrl(update.url)) {
      throw new Error(
        `${update.label || getSocialLabel(update.key)} link must be a valid https:// URL.`,
      );
    }
    if (!update.key || update.key.trim().length < 2 || update.key.length > 50) {
      throw new Error("Platform key must be between 2 and 50 characters.");
    }
  }

  for (let index = 0; index < updates.length; index += 1) {
    const update = updates[index];
    const label = update.label?.trim() || getSocialLabel(update.key);
    await query(
      `INSERT INTO social_links (platform_key, label, icon, url, is_active, sort_order, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         icon = VALUES(icon),
         url = VALUES(url),
         is_active = VALUES(is_active),
         sort_order = VALUES(sort_order),
         updated_by = VALUES(updated_by)`,
      [
        update.key.trim().toLowerCase().replace(/\s+/g, "-"),
        label,
        update.icon?.trim() || null,
        update.url?.trim() || null,
        update.isActive ? 1 : 0,
        index + 1,
        adminUid,
      ],
    );
  }

  return fetchAllSocialLinks();
}

export async function deleteSocialLink(key: string): Promise<boolean> {
  await ensureSchema();
  const result = await exec(`DELETE FROM social_links WHERE platform_key = ?`, [key]);
  return result.affectedRows > 0;
}

export async function upsertSocialLink(
  update: SocialLinkUpdate & { sortOrder?: number },
  adminUid: string,
): Promise<SocialLink[]> {
  await ensureSchema();
  if (update.url && !isValidHttpUrl(update.url)) {
    throw new Error(`${update.label || getSocialLabel(update.key)} link must be a valid https:// URL.`);
  }
  const key = update.key.trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9][a-z0-9-_]{1,49}$/.test(key)) {
    throw new Error("Platform key must be a valid slug (2-50 chars, letters/numbers/-/_).");
  }
  const label = update.label?.trim() || getSocialLabel(key);
  let sortOrder = update.sortOrder;
  if (typeof sortOrder !== "number") {
    const rows = await query<{ maxOrder: number | null }[]>(`SELECT MAX(sort_order) AS maxOrder FROM social_links`);
    sortOrder = (rows[0]?.maxOrder ?? 0) + 1;
  }
  await query(
    `INSERT INTO social_links (platform_key, label, icon, url, is_active, sort_order, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       label = VALUES(label),
       icon = VALUES(icon),
       url = VALUES(url),
       is_active = VALUES(is_active),
       sort_order = VALUES(sort_order),
       updated_by = VALUES(updated_by)`,
    [key, label, update.icon?.trim() || null, update.url?.trim() || null, update.isActive ? 1 : 0, sortOrder, adminUid],
  );
  return fetchAllSocialLinks();
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
