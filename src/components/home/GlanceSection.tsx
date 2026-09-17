import type { SVGProps } from "react";
import { fetchGlanceStats } from "@/lib/glance-stats";
import SectionHeading, { TrophyIcon } from "@/components/home/SectionHeading";

type CardIconProps = SVGProps<SVGSVGElement>;

function UsersIcon(props: CardIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function BookIcon2(props: CardIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function VideoIcon(props: CardIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  );
}

function ClipboardIcon(props: CardIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChatIcon(props: CardIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

function FileIcon(props: CardIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

const cardIcons = [UsersIcon, BookIcon2, VideoIcon, ClipboardIcon, ChatIcon, FileIcon];

type GlanceCard = {
  headline: string;
  value: number;
  description: string;
};

export default async function GlanceSection() {
  const stats = await fetchGlanceStats();

  const cards: GlanceCard[] = [
    {
      headline: "Students Guided",
      value: stats.studentsGuided,
      description:
        "এরও অধিক শিক্ষার্থী আমাদের সাথে যুক্ত হয়ে তাদের স্বপ্ন পূরণের পথে এগিয়ে যাচ্ছে।",
    },
    {
      headline: "Courses Available",
      value: stats.coursesAvailable,
      description:
        "তোমাদের প্রয়োজন অনুযায়ী প্রস্তুতির জন্য রয়েছে বিভিন্ন ধরনের কোর্স।",
    },
    {
      headline: "Classes Available",
      value: stats.classesAvailable,
      description:
        "তোমাদের শেখার জন্য রয়েছে Live ও Recorded—দুই ধরনের অসংখ্য ক্লাস।",
    },
    {
      headline: "Exams Conducted",
      value: stats.examsConducted,
      description:
        "তোমাদের প্রস্তুতি যাচাই ও আরও ভালো করার জন্য নেওয়া হয়েছে অসংখ্য Live ও Practice Exam।",
    },
    {
      headline: "Questions Answered",
      value: stats.questionsAnswered,
      description:
        "তোমাদের জিজ্ঞাসার উত্তর দিয়ে প্রতিটি প্রশ্নের সমাধানের পাশে রয়েছে MediSpark Teacher Panel।",
    },
    {
      headline: "Learning Materials",
      value: stats.learningMaterials,
      description:
        "তোমাদের প্রস্তুতিকে আরও সহজ করতে রয়েছে প্রয়োজনীয় Notes, PDF ও অন্যান্য Learning Materials।",
    },
  ];

  return (
    <section
      id="glance"
      className="relative scroll-mt-24 overflow-hidden border-t border-ink/5 bg-dark-900"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid-lines" />
      <div className="pointer-events-none absolute -left-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-primary-600/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading icon={TrophyIcon}>
          MediSpark at a Glance
        </SectionHeading>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4">
          {cards.map((card, index) => {
            const Icon = cardIcons[index];
            return (
              <article
                key={card.headline}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-ink/10 bg-dark-950/60 p-4 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-primary-600/60 hover:shadow-primary-900/30 sm:gap-5 sm:p-5"
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary-600/70 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600/15 text-primary-400 transition duration-300 group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-primary-900/50 sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-heading sm:text-sm">
                    {card.headline}
                  </h3>
                  <p className="mt-1 bg-gradient-to-br from-primary-400 to-primary-600 bg-clip-text text-2xl font-extrabold tabular-nums tracking-tight text-transparent sm:text-3xl">
                    {card.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-neutral-400 sm:text-xs">
                    {card.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
