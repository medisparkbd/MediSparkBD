import type { SVGProps } from "react";
import { fetchHomeCards } from "@/lib/home-cards";
import SectionHeading, { SparkIcon } from "@/components/home/SectionHeading";

type Benefit = {
  key: string;
  title: string;
  description: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
};

function TeacherIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  );
}

function BookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function VideoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  );
}

function ExamIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M9 8h2m-6.75 12h13.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H12L9 6H5.25A1.5 1.5 0 003 7.5v13.5a1.5 1.5 0 001.5 1.5z" />
    </svg>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

const iconRegistry: Record<
  string,
  (props: SVGProps<SVGSVGElement>) => React.JSX.Element
> = {
  teacher: TeacherIcon,
  book: BookIcon,
  video: VideoIcon,
  exam: ExamIcon,
  chat: ChatIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gift: GiftIcon,
};

export default async function WhyMediSpark({
  title,
  description,
}: {
  title?: string;
  description?: string;
} = {}) {
  const records = await fetchHomeCards("why", true);
  const benefits: Benefit[] = records.map((record) => ({
    key: record.key,
    title: record.title,
    description: record.description,
    Icon: iconRegistry[record.icon] ?? BookIcon,
  }));
  return (
    <section className="relative overflow-hidden border-t border-ink/5 bg-dark-900">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines" />
      <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-primary-600/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading icon={SparkIcon}>Why You Should Choose MediSpark?</SectionHeading>

        <div className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          {benefits.length === 0 ? (
            <p className="col-span-2 rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-neutral-500">
              Cards will appear here once published by the admin.
            </p>
          ) : (
            benefits.map((benefit) => (
              <div
                key={benefit.key}
                className="group flex items-start gap-3 rounded-xl border border-ink/10 bg-dark-950/60 p-3.5 shadow-lg shadow-black/20 transition duration-300 hover:border-primary-600/60 hover:shadow-primary-900/30 sm:p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/15 text-primary-400 transition group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-primary-900/50 sm:h-10 sm:w-10">
                  <benefit.Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-sm font-bold leading-snug text-heading">
                    {benefit.title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-400 sm:text-[13px]">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
