import type { Metadata } from "next";
import { AccessGate } from "@/components/auth/AccessGuard";
import FavouritesOverview from "@/components/dashboard/FavouritesOverview";

export const metadata: Metadata = {
  title: "Favourite",
  description: "Your saved favourites — classes, exams, materials and Q&A.",
};

export default function FavouritesPage() {
  return (
    <AccessGate requirement="enrolled" loadingLabel="Loading favourites...">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mt-4">
          <FavouritesOverview />
        </div>
      </section>
    </AccessGate>
  );
}