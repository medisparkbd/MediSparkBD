export type SocialPlatformKey = string;

export type SocialLink = {
  key: SocialPlatformKey;
  label: string;
  url: string | null;
  isActive: boolean;
  icon?: string | null;
  sortOrder?: number;
};

export const SOCIAL_PLATFORMS: Array<{
  key: SocialPlatformKey;
  label: string;
}> = [
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "telegram", label: "Telegram" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "tiktok", label: "TikTok" },
];

export function isSocialPlatformKey(key: string): boolean {
  if (SOCIAL_PLATFORMS.some((platform) => platform.key === key)) return true;
  return /^[a-z0-9][a-z0-9-_]{1,49}$/.test(key);
}

export function getSocialLabel(key: SocialPlatformKey): string {
  return SOCIAL_PLATFORMS.find((platform) => platform.key === key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function isValidSocialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
