import BannerSlider from "@/components/home/BannerSlider";
import Hero from "@/components/home/Hero";
import FeaturedCourses from "@/components/home/FeaturedCourses";
import WhyMediSpark from "@/components/home/WhyMediSpark";
import OurSuccess from "@/components/home/OurSuccess";
import JerseyGallery from "@/components/home/JerseyGallery";
import Mentors from "@/components/home/Mentors";
import StudentReviews from "@/components/home/StudentReviews";
import FaqSection from "@/components/home/FaqSection";
import JoinWithUs from "@/components/home/JoinWithUs";
import PromotionsSection from "@/components/home/PromotionsSection";
import Footer from "@/components/Footer";
import HomeControlBar from "@/components/admin/HomeControlBar";
import HeroTextEditor from "@/components/admin/HeroTextEditor";
import { fetchHomepageSections } from "@/lib/homepage-sections";
import { fetchHeroSettings } from "@/lib/hero-settings";
import { fetchPublishedReviewRecords } from "@/lib/reviews-store";
import { fetchPublishedFaqs } from "@/lib/faq-store";
import { fetchActiveJerseys } from "@/lib/content-admin";
import type { StudentReview } from "@/lib/reviews";
import type { HomepageSection } from "@/lib/homepage-sections-constants";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Admin → Home Control: the exact Main Website Home Page (same structure,
 * layout, design, content and responsiveness) with one admin-only control
 * bar BELOW each section: [Edit] everywhere, plus [+ Add ...] only where
 * new items can be added. Edit/Add open the section's MySQL-backed
 * interfaces; every target API re-verifies admin authorization.
 */
export default async function HomeControlPage() {
  const [sections, heroSettings, reviewRecords, publishedFaqs, activeJerseys] =
    await Promise.all([
      fetchHomepageSections(),
      fetchHeroSettings(),
      fetchPublishedReviewRecords(),
      fetchPublishedFaqs(),
      fetchActiveJerseys(),
    ]);
  const activeSections = sections.filter((section) => section.isActive);

  const publishedReviews: StudentReview[] = reviewRecords.map((record, index) => ({
    id: record.id,
    studentName: record.studentName,
    studentAvatar: record.studentAvatar ?? "/avatars/student.svg",
    courseName: record.courseName,
    batchLabel: record.batchLabel,
    rating: record.rating,
    text: record.text,
    createdAt: new Date(record.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    order: index,
    status: "published",
  }));

  // Jersey visibility mirrors the Main Website exactly.
  const jerseySection = sections.find((section) => section.key === "jersey");
  const showJersey = Boolean(jerseySection?.isActive) && activeJerseys.length > 0;

  function renderSectionNode(section: HomepageSection): ReactNode | null {
    const textProps = {
      title: section.title ?? undefined,
      description: section.description ?? undefined,
    };

    switch (section.key) {
      case "banner":
        return <BannerSlider />;
      case "hero":
        return heroSettings.isActive ? <Hero hero={heroSettings} /> : null;
      case "featured-courses":
        return <FeaturedCourses {...textProps} />;
      case "why-medispark":
        return <WhyMediSpark {...textProps} />;
      case "our-success":
        return <OurSuccess {...textProps} />;
      case "mentors":
        return <Mentors {...textProps} />;
      case "reviews":
        return <StudentReviews reviews={publishedReviews} {...textProps} />;
      case "faq":
        return <FaqSection faqs={publishedFaqs} {...textProps} />;
      case "join-with-us":
        return <JoinWithUs {...textProps} />;
      default:
        return null;
    }
  }

  /** Section content + its bottom control bar ([Edit] / [+ Add ...]). */
  function controlled(
    key: string,
    node: ReactNode | null,
    editHref: string,
    add?: { href: string; label: string },
  ): ReactNode | null {
    if (node === null) return null;
    return (
      <div key={key}>
        {node}
        <HomeControlBar sectionKey={key} editHref={editHref} add={add} />
      </div>
    );
  }

  function renderControlledSection(section: HomepageSection): ReactNode | null {
    switch (section.key) {
      case "banner":
        return controlled("banner", renderSectionNode(section), "/admin/home-control/banner");
      case "hero":
        return (
          <div key="hero">
            {renderSectionNode(section)}
            <HomeControlBar sectionKey="hero" editHref="/admin/website/homepage/hero" />
            <div className="flex justify-center px-4 pb-4">
              <HeroTextEditor />
            </div>
          </div>
        );
      case "featured-courses":
        return controlled("featured-courses", renderSectionNode(section), "/admin/marketing/featured-courses", {
          href: "/admin/marketing/featured-courses",
          label: "Course",
        });
      case "why-medispark":
        return controlled("why-medispark", renderSectionNode(section), "/admin/website/homepage/cards");
      case "our-success":
        return controlled("our-success", renderSectionNode(section), "/admin/website/homepage/cards");
      case "mentors":
        return controlled("mentors", renderSectionNode(section), "/admin/mentors/all", {
          href: "/admin/mentors/all",
          label: "Mentor",
        });
      case "faq":
        return controlled("faq", renderSectionNode(section), "/admin/content/faq", {
          href: "/admin/content/faq",
          label: "FAQ",
        });
      case "join-with-us":
        return controlled("join-with-us", renderSectionNode(section), "/admin/website/social-links", {
          href: "/admin/website/social-links",
          label: "Social Media",
        });
      default:
        return null;
    }
  }

  const jerseyNode: ReactNode = (
    <JerseyGallery
      jerseys={activeJerseys}
    />
  );

  const ourSuccessActive = activeSections.some((section) => section.key === "our-success");

  // Join With Us Now! — same component, position and data as the Live Website
  const joinSection = sections.find((s) => s.key === "join-with-us");
  const joinNode: ReactNode = (
    <JoinWithUs
      key="join-with-us"
      title={joinSection?.title ?? undefined}
      description={joinSection?.description ?? undefined}
    />
  );
  const joinControlledNode: ReactNode = (
    <div key="join-with-us-controlled">
      {joinNode}
      <HomeControlBar
        sectionKey="join-with-us"
        editHref="/admin/website/social-links"
        add={{ href: "/admin/website/social-links", label: "Social Media" }}
      />
    </div>
  );

  return (
    <section className="pb-10">
      {/* Live copy of the homepage — identical to the Main Website */}
      <PromotionsSection />
      {activeSections
        .filter((section) => section.key !== "jersey" && section.key !== "join-with-us")
        .flatMap((section) => {
          const nodes = [renderControlledSection(section)];
          // Exact website order: Our Success → Jersey → Mentors.
          if (showJersey && section.key === "our-success") {
            nodes.push(
              controlled("jersey", jerseyNode, "/admin/content/jersey", {
                href: "/admin/content/jersey",
                label: "Jersey",
              }),
            );
          } else if (showJersey && !ourSuccessActive && section.key === "mentors") {
            nodes.unshift(
              controlled("jersey", jerseyNode, "/admin/content/jersey", {
                href: "/admin/content/jersey",
                label: "Jersey",
              }),
            );
          }
          // Required order: FAQ → Join With Us Now! (same as Live Website)
          if (section.key === "faq") {
            if (joinSection?.isActive !== false) nodes.push(joinControlledNode);
          }
          return nodes;
        })}
      {/* Fallback: both neighbours disabled but jersey still published. */}
      {showJersey &&
      !activeSections.some((section) => section.key === "our-success" || section.key === "mentors")
        ? controlled("jersey", jerseyNode, "/admin/content/jersey", {
            href: "/admin/content/jersey",
            label: "Jersey",
          })
        : null}
      {/* If FAQ is disabled/hidden, still show Join With Us before Footer (mirrors Live Website fallback) */}
      {!activeSections.some((s) => s.key === "faq") && joinSection?.isActive !== false ? joinControlledNode : null}

      {/* Footer — the EXACT Main Website footer component (same layout,
           design, typography, links, social icons and responsiveness).
           The bar below adds admin-only [Edit] / [+ Add ...] controls; Edit
           opens one dedicated interface for every editable footer element. */}
      <div>
        <Footer />
        <HomeControlBar
          sectionKey="footer"
          editHref="/admin/home-control/footer"
          adds={[
            {
              href: "/admin/home-control/footer?add=footer-link",
              label: "Footer Link",
            },
            {
              href: "/admin/home-control/footer?add=contact-info",
              label: "Contact Info",
            },
          ]}
        />
      </div>
    </section>
  );
}
