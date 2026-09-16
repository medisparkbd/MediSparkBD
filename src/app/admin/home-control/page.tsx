import BannerSlider from "@/components/home/BannerSlider";
import Hero from "@/components/home/Hero";
import FeaturedCourses from "@/components/home/FeaturedCourses";
import WhyMediSpark from "@/components/home/WhyMediSpark";
import GlanceSection from "@/components/home/GlanceSection";
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
import { getSectionConfig } from "@/lib/homepage-sections-constants";
import type { StudentReview } from "@/lib/reviews";
import type { HomepageSection } from "@/lib/homepage-sections-constants";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Admin → Home Control: the exact Main Website Home Page (same structure,
 * layout, design, content and responsiveness) with one admin-only control
 * bar BELOW each section: [Edit] everywhere, plus [+ Add ...] only where
 * new items can be added. Every section also has an ON/OFF toggle that
 * controls its visibility on the live public website.
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
      case "glance":
        return <GlanceSection />;
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

  /** Section content + its bottom control bar ([Edit] / [+ Add ...] / ON-OFF toggle). */
  function controlled(
    key: string,
    node: ReactNode | null,
    editHref: string,
    section: HomepageSection,
    add?: { href: string; label: string },
  ): ReactNode | null {
    if (node === null) return null;
    const config = getSectionConfig(section.key);
    return (
      <div
        key={key}
        className={!section.isActive ? "opacity-60" : undefined}
      >
        {node}
        <HomeControlBar
          sectionKey={key}
          sectionLabel={config.label}
          editHref={editHref}
          add={add}
          isActive={section.isActive}
        />
      </div>
    );
  }

  function renderControlledSection(section: HomepageSection): ReactNode | null {
    switch (section.key) {
      case "banner":
        return controlled("banner", renderSectionNode(section), "/admin/home-control/banner", section);
      case "hero":
        return (
          <div key="hero" className={!section.isActive ? "opacity-60" : undefined}>
            {renderSectionNode(section)}
            <HomeControlBar
              sectionKey="hero"
              sectionLabel="Hero Section"
              editHref="/admin/website/homepage/hero"
              isActive={section.isActive}
            />
            <div className="flex justify-center px-4 pb-4">
              <HeroTextEditor />
            </div>
          </div>
        );
      case "featured-courses":
        return controlled("featured-courses", renderSectionNode(section), "/admin/marketing/featured-courses", section, {
          href: "/admin/marketing/featured-courses",
          label: "Course",
        });
      case "why-medispark":
        return controlled("why-medispark", renderSectionNode(section), "/admin/website/homepage/cards", section);
      case "glance":
        return controlled("glance", renderSectionNode(section), "/admin/home-control", section);
      case "our-success":
        return controlled("our-success", renderSectionNode(section), "/admin/website/homepage/cards", section);
      case "mentors":
        return controlled("mentors", renderSectionNode(section), "/admin/mentors/all", section, {
          href: "/admin/mentors/all",
          label: "Mentor",
        });
      case "faq":
        return controlled("faq", renderSectionNode(section), "/admin/content/faq", section, {
          href: "/admin/content/faq",
          label: "FAQ",
        });
      case "join-with-us":
        return controlled("join-with-us", renderSectionNode(section), "/admin/website/social-links", section, {
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

  function controlledJersey(): ReactNode {
    const config = getSectionConfig("jersey");
    return (
      <div
        key="jersey"
        className={!jerseySection?.isActive ? "opacity-60" : undefined}
      >
        {jerseyNode}
        <HomeControlBar
          sectionKey="jersey"
          sectionLabel={config.label}
          editHref="/admin/content/jersey"
          add={{ href: "/admin/content/jersey", label: "Jersey" }}
          isActive={jerseySection?.isActive ?? true}
        />
      </div>
    );
  }

  const glanceActive = sections.some((section) => section.key === "glance" && section.isActive);

  const joinSection = sections.find((s) => s.key === "join-with-us");
  const joinNode: ReactNode = (
    <JoinWithUs
      key="join-with-us"
      title={joinSection?.title ?? undefined}
      description={joinSection?.description ?? undefined}
    />
  );
  const joinControlledNode: ReactNode = (
    <div key="join-with-us-controlled" className={joinSection?.isActive === false ? "opacity-60" : undefined}>
      {joinNode}
      <HomeControlBar
        sectionKey="join-with-us"
        sectionLabel="Join With Us Now!"
        editHref="/admin/website/social-links"
        add={{ href: "/admin/website/social-links", label: "Social Media" }}
        isActive={joinSection?.isActive ?? true}
      />
    </div>
  );

  return (
    <section className="pb-10">
      <PromotionsSection />
      {sections
        .filter((section) => section.key !== "jersey" && section.key !== "join-with-us")
        .flatMap((section) => {
          const nodes = [renderControlledSection(section)];
          if (showJersey && section.key === "glance") {
            nodes.push(controlledJersey());
          } else if (showJersey && !glanceActive && section.key === "mentors") {
            nodes.unshift(controlledJersey());
          }
          if (section.key === "faq") {
            nodes.push(joinControlledNode);
          }
          return nodes;
        })}
      {/* Jersey fallback: both neighbours disabled but jersey still published. */}
      {showJersey &&
      !sections.some((section) => (section.key === "glance" || section.key === "mentors") && section.isActive)
        ? controlledJersey()
        : null}
      {/* If FAQ is disabled/hidden, still show Join With Us before Footer */}
      {!sections.some((s) => s.key === "faq" && s.isActive) ? joinControlledNode : null}

      {/* Footer */}
      <div>
        <Footer />
        <HomeControlBar
          sectionKey="footer"
          sectionLabel="Footer"
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
