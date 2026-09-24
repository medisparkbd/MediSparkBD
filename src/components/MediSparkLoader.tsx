"use client";

import { DEFAULT_LOGO } from "@/lib/logo";

type LoaderSize = "small" | "medium" | "large";

type MediSparkLoaderProps = {
  size?: LoaderSize;
  fullscreen?: boolean;
  label?: string;
  className?: string;
  /** Show MediSpark BD branding text (default true for fullscreen, false for inline) */
  withBranding?: boolean;
  showDots?: boolean;
};

const sizeMap: Record<LoaderSize, { container: number; logoW: number; logoH: number; ringInset: string }> = {
  small: { container: 48, logoW: 28, logoH: 12, ringInset: "inset-[6px]" },
  medium: { container: 72, logoW: 40, logoH: 18, ringInset: "inset-[8px]" },
  large: { container: 92, logoW: 52, logoH: 24, ringInset: "inset-[10px]" },
};

function LoaderCore({
  size = "medium",
  label,
  withBranding,
  showDots = true,
}: Pick<MediSparkLoaderProps, "size" | "label" | "withBranding" | "showDots">) {
  const cfg = sizeMap[size ?? "medium"];
  const showBranding = withBranding ?? false;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: cfg.container, height: cfg.container }}
        aria-hidden="true"
      >
        {/* outer subtle ring */}
        <span className="absolute inset-0 rounded-full border border-white/10" />
        {/* spinning ring: MediSpark red */}
        <span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-600 animate-spin"
          style={{ animationDuration: "0.9s" }}
        />
        <span className="absolute inset-[10px] rounded-full bg-white/5 backdrop-blur" />
        <img
          src={DEFAULT_LOGO.url}
          alt=""
          width={cfg.logoW}
          height={cfg.logoH}
          draggable={false}
          className="relative h-6 w-auto max-w-[60%] select-none object-contain"
          style={{ width: cfg.logoW }}
        />
      </div>

      {showBranding && (
        <>
          <p className="mt-5 text-sm font-extrabold tracking-tight text-white">
            MediSpark <span className="font-semibold text-primary-400">BD</span>
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-neutral-400">
            Together we Achieve Dream
          </p>
        </>
      )}

      {label ? (
        <p className="mt-3 text-sm text-slate-500 admin-dark:text-slate-400 text-center max-w-xs">
          {label}
        </p>
      ) : null}

      {showDots && (
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-600" />
        </div>
      )}
    </div>
  );
}

export default function MediSparkLoader({
  size = "medium",
  fullscreen = false,
  label,
  className = "",
  withBranding,
  showDots,
}: MediSparkLoaderProps) {
  const content = (
    <LoaderCore size={size} label={label} withBranding={withBranding ?? fullscreen} showDots={showDots} />
  );

  if (fullscreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label ?? "Loading MediSpark"}
        className={`fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-dark-950 px-6 ${className}`}
      >
        {/* subtle glows - lightweight, no images */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary-600/10 blur-[70px]" />
          <div className="absolute bottom-[-80px] right-[-60px] h-[360px] w-[360px] rounded-full bg-primary-900/25 blur-[60px]" />
        </div>
        <div className="relative">{content}</div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Loading"}
      className={`flex w-full items-center justify-center px-4 py-10 ${className}`}
    >
      {content}
    </div>
  );
}

// Aliases for spec requirement
export const GlobalLoader = MediSparkLoader;
export const MediSparkFullScreenLoader = (props: Omit<MediSparkLoaderProps, "fullscreen">) => (
  <MediSparkLoader {...props} fullscreen />
);

// Inline small variant helper for tables/cards
export function MediSparkInlineLoader({ label }: { label?: string }) {
  return <MediSparkLoader size="small" label={label} showDots={false} />;
}
