export default function InfoBox({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink/10 bg-dark-900 p-4 shadow-sm admin-dark:border-[#1e1e3a] admin-dark:bg-[#112544] sm:p-5 ${className ?? ""}`}
    >
      {title && (
        <p className="text-sm font-extrabold text-heading admin-dark:text-white">
          {title}
        </p>
      )}
      <div className="mt-1 text-xs leading-relaxed text-neutral-400 admin-dark:text-neutral-300">
        {children}
      </div>
    </div>
  );
}
