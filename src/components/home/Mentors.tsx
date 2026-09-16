import { fetchMentors } from "@/lib/mentors";
import SectionHeading, { MentorIcon } from "@/components/home/SectionHeading";

export default async function Mentors({
  title,
  description,
}: {
  title?: string;
  description?: string;
} = {}) {
  const mentors = (await fetchMentors()).filter((mentor) => mentor.isActive);

  return (
    <section id="mentors" className="relative scroll-mt-24 overflow-hidden border-t border-ink/5 bg-dark-950">
      <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary-600/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading icon={MentorIcon}>Meet With Our Mentors</SectionHeading>

        {mentors.length === 0 ? (
          <p className="mt-12 text-center text-sm text-neutral-500">
            Mentor profiles are coming soon.
          </p>
        ) : (
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2">
            {mentors.map((mentor) => (
              <article
                key={mentor.id}
                className="group flex flex-col rounded-2xl border border-ink/10 bg-dark-900 p-4 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-primary-600/60 hover:shadow-primary-900/30 sm:p-5"
              >
                {/* Top row: photo left + info right */}
                <div className="flex items-start gap-4">
                  {/* Profile photo — rounded-square */}
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-500 to-primary-800 text-xl font-extrabold text-white shadow-lg shadow-primary-900/40 transition group-hover:shadow-primary-800/50 sm:h-24 sm:w-24">
                    {mentor.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mentor.photoUrl}
                        alt={mentor.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      mentor.initials
                    )}
                  </div>

                  {/* Info — right side */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-base font-extrabold leading-snug text-heading sm:text-lg">
                      {mentor.name}
                    </h3>
                    {mentor.qualification ? (
                      <p className="mt-1 text-sm font-semibold text-neutral-300">
                        {mentor.qualification}
                      </p>
                    ) : null}
                    {mentor.subject ? (
                      <p className="mt-2">
                        <span className="inline-flex items-center rounded-lg border border-primary-500/40 bg-dark-950 px-3 py-1 text-xs font-bold tracking-wide text-primary-400">
                          {mentor.subject}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Designation labels — full-width, stacked below */}
                {(mentor.isFounder || mentor.isCoFounder || mentor.isDeveloper) && (
                  <div className="mt-3 flex flex-col gap-2">
                    {mentor.isFounder && (
                      <span className="inline-flex w-full items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/10 px-4 py-2 text-xs font-bold tracking-wide text-blue-400">
                        Founder of MediSpark
                      </span>
                    )}
                    {mentor.isCoFounder && (
                      <span className="inline-flex w-full items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/10 px-4 py-2 text-xs font-bold tracking-wide text-blue-400">
                        Co-Founder of MediSpark
                      </span>
                    )}
                    {mentor.isDeveloper && (
                      <span className="inline-flex w-full items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/10 px-4 py-2 text-xs font-bold tracking-wide text-blue-400">
                        Developer of MediSpark
                      </span>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
