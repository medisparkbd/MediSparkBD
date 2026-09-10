import { fetchActiveSocialLinks } from "@/lib/social-links";
import { fetchHomepageSections } from "@/lib/homepage-sections";
import { getSocialPlatformIcon } from "@/components/social-icons";
import SectionHeading, { JoinIcon } from "@/components/home/SectionHeading";

const JOIN_DESCRIPTIONS: Record<string, string> = {
  facebook: "Follow us on Facebook",
  youtube: "Subscribe to our YouTube channel",
  telegram: "Join our Telegram community",
  instagram: "Follow us on Instagram",
  linkedin: "Connect on LinkedIn",
  whatsapp: "Chat with us on WhatsApp",
  tiktok: "Follow us on TikTok",
};

const JOIN_BUTTON_LABELS: Record<string, string> = {
  facebook: "Follow on Facebook",
  youtube: "Subscribe on YouTube",
  telegram: "Join on Telegram",
  instagram: "Follow on Instagram",
  linkedin: "Connect on LinkedIn",
  whatsapp: "Chat on WhatsApp",
  tiktok: "Follow on TikTok",
};

function getJoinDescription(label: string, key: string): string {
  return JOIN_DESCRIPTIONS[key] ?? `Connect with us on ${label}`;
}
function getJoinButtonLabel(label: string, key: string): string {
  return JOIN_BUTTON_LABELS[key] ?? `Join on ${label}`;
}

export default async function JoinWithUs({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title: _titleProp,
  description: descriptionProp,
}: {
  title?: string;
  description?: string;
} = {}) {
  const [activeLinks, sections] = await Promise.all([
    fetchActiveSocialLinks(),
    fetchHomepageSections().catch(() => [] as any),
  ]);
  // Respect homepage_sections toggle — if join-with-us is disabled, hide section entirely
  const joinSection = (sections as any[])?.find((s: any) => s.key === "join-with-us" || s.section_key === "join-with-us");
  if (joinSection && joinSection.isActive === false) return null;
  // Heading is fixed to "Join With Us Now!" per design spec; description remains DB-driven
  const description = descriptionProp ?? joinSection?.description ?? "Connect with MediSpark on your favourite platforms and never miss an update.";

  // DB-driven: any active platform with URL, in admin-defined sort_order
  const visible = activeLinks
    .filter((link) => link.url)
    .map((link) => ({
      key: link.key,
      label: link.label,
      url: link.url as string,
      iconPath: link.icon || getSocialPlatformIcon(link.key),
      description: getJoinDescription(link.label, link.key),
      buttonLabel: getJoinButtonLabel(link.label, link.key),
    }));

  if (visible.length === 0) return null;

  return (
    <section id="join-with-us" className="scroll-mt-24 border-t border-ink/5 bg-dark-950">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading icon={JoinIcon}>Join With Us Now!</SectionHeading>
        {description ? (
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-relaxed text-neutral-400">
            {description}
          </p>
        ) : null}

        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
          {visible.map((platform) => {
            const iconPath = platform.iconPath;
            const isUrlIcon = Boolean(iconPath && (iconPath.startsWith("http") || iconPath.startsWith("data:")));
            return (
              <a
                key={platform.key}
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl border border-ink/10 bg-dark-900 p-4 shadow-lg shadow-black/20 transition duration-300 hover:border-primary-600/50 hover:shadow-primary-900/20 hover:-translate-y-0.5"
              >
                {/* Top Row — Horizontal: Logo + Platform Name */}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600/15 text-primary-500 transition group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-primary-900/40">
                    {isUrlIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconPath!} alt="" className="h-5 w-5 rounded object-contain" />
                    ) : iconPath ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5">
                        <path d={iconPath} />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">{platform.label.charAt(0)}</span>
                    )}
                  </span>
                  <h3 className="min-w-0 flex-1 truncate text-sm font-extrabold leading-none text-heading">{platform.label}</h3>
                </div>
                {/* Below Platform Name — Description */}
                <p className="mt-3 text-[13px] leading-snug text-neutral-400">
                  {platform.description}
                </p>
                {/* Below Description — Action Button */}
                <span className="mt-3 inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary-900/30 transition group-hover:bg-primary-700">
                  {platform.buttonLabel}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M17 7H7m10 0v10" />
                  </svg>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
