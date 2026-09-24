export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <section className="border-t border-ink/5 bg-dark-950">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex justify-center">
          <div className="h-10 w-64 animate-pulse rounded-2xl bg-white/[0.06]" />
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-ink/10 bg-dark-900 p-6">
              <div className="h-12 w-12 rounded-full bg-white/10" />
              <div className="mt-4 h-3 w-3/4 rounded bg-white/10" />
              <div className="mt-2 h-3 w-full rounded bg-white/[0.06]" />
              <div className="mt-2 h-3 w-5/6 rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden bg-dark-950">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="mx-auto h-10 w-3/4 animate-pulse rounded-xl bg-white/10" />
        <div className="mx-auto mt-4 h-4 w-1/2 animate-pulse rounded bg-white/[0.06]" />
        <div className="mx-auto mt-8 h-11 w-40 animate-pulse rounded-xl bg-white/10" />
      </div>
    </section>
  );
}

export function BannerSkeleton() {
  return (
    <div className="aspect-[64/35] w-full animate-pulse bg-white/5 sm:aspect-[32/15]" />
  );
}
