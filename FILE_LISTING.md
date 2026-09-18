# MediSparkBD - Complete File Listing

## Root Configuration Files

```
package.json                 # Dependencies (React 19, Next 16, Firebase, MySQL2)
tsconfig.json              # TypeScript config (ES2017, strict mode)
next.config.ts             # Next.js config (standalone output, image optimization)
tailwind.config.ts         # Tailwind CSS v4 configuration
postcss.config.mjs         # PostCSS configuration
eslint.config.mjs          # ESLint configuration
pnpm-lock.yaml             # PNPM lock file
pnpm-workspace.yaml        # Workspace config
.npmrc                     # NPM registry config
.gitignore                 # Git ignore rules
README.md                  # Project documentation
all.env                    # Environment variables template
local.env                  # Local development env (not committed)
vercel.env                 # Vercel deployment env

```

---

## `/src/app` - Next.js App Router (Page Routes)

### Root Layout & Pages
```
src/app/
├── layout.tsx              # Root layout (global providers, Navbar, Footer)
├── page.tsx                # Homepage (dynamic sections, featured courses)
├── globals.css             # Global Tailwind CSS
├── error.tsx               # Global error boundary
├── loading.tsx             # Global loading skeleton
├── robots.ts               # robots.txt generator
├── sitemap.ts              # XML sitemap generator
├── favicon.ico             # Browser favicon

```

### Admin Panel (`src/app/admin/`)
```
src/app/admin/
├── layout.tsx              # Admin layout (sidebar, breadcrumbs)
├── page.tsx                # Admin dashboard
├── loading.tsx             # Admin loading state
├── error.tsx               # Admin error boundary
├── not-found.tsx           # 404 page

├── dashboard/              # Dashboard overview
│   └── page.tsx

├── courses/                # Course management
│   └── page.tsx

├── course/                 # Single course edit
│   └── [...slug]/page.tsx

├── enrolled-courses/       # Course preview for admins
│   └── page.tsx

├── course-content/         # Course content/chapters
│   └── page.tsx

├── course-content-control/ # Course content visibility
│   └── page.tsx

├── course-control/         # Course metadata editor
│   └── page.tsx

├── course-exams/           # Exams linked to courses
│   └── page.tsx

├── exams/                  # Exam management
│   └── page.tsx

├── course-categories/      # Category management
│   └── page.tsx

├── public-exam/            # Public exam management
│   └── page.tsx

├── public-exam-control/    # Public exam settings
│   └── page.tsx

├── students/               # Student list & management
│   └── page.tsx

├── student-control/        # Student lookup
│   └── page.tsx

├── enrolled-exams/         # Course exam enrollments
│   └── page.tsx

├── enrollment-control/     # Enrollment settings
│   └── page.tsx

├── qa/                     # Q&A moderation
│   └── page.tsx

├── qa-control/             # Q&A settings
│   └── page.tsx

├── content/                # Homepage content sections
│   └── page.tsx

├── home-control/           # Homepage section visibility
│   └── page.tsx

├── homepage-courses/       # Featured courses on home
│   └── page.tsx

├── dashboard-control/      # Dashboard card settings
│   └── page.tsx

├── mentors/                # Mentor profile management
│   └── page.tsx

├── marketing/              # Promotions, coupons, campaigns
│   └── page.tsx

├── material-pdf/           # PDF material management
│   └── page.tsx

├── notification-control/   # Notification settings
│   └── page.tsx

├── branding/               # Logo, colors, theme
│   └── page.tsx

├── website/                # Website settings (meta, title)
│   └── page.tsx

├── website-information/    # Contact, address, links
│   └── page.tsx

├── administration/         # Admin accounts, roles
│   └── page.tsx

├── profile/                # Admin's own profile
│   └── page.tsx

├── settings/               # General settings
│   └── page.tsx

├── system/                 # System info, backups
│   └── page.tsx

├── access-denied/          # 403 error page
│   └── page.tsx

└── [...notfound]/          # Catch-all 404
    └── page.tsx

```

### Student Pages (`src/app/courses/`, `src/app/exam/`, etc.)

```
src/app/courses/
├── page.tsx                # Courses catalog main
├── [...category]/page.tsx  # Category courses page

src/app/exam/
├── page.tsx                # Exams listing
├── [...slug]/page.tsx      # Exam details & taking page

src/app/dashboard/
├── page.tsx                # Student dashboard

src/app/qa/
├── page.tsx                # Q&A explorer

src/app/login/
├── page.tsx                # Login page

src/app/register/
├── page.tsx                # Registration page

```

---

## `/src/app/api` - REST API Routes (140+ routes)

### Admin APIs (`api/admin/`)

```
src/app/api/admin/
├── route.ts                # GET admin auth gate

├── accounts/               # Admin user management
│   └── route.ts

├── activity-logs/          # Audit trail
│   └── route.ts

├── backup/                 # Database backup
│   └── route.ts

├── chapters/               # Course chapters
│   └── route.ts

├── classes/                # Classes/sections
│   └── route.ts

├── content-control/        # Content visibility
│   └── route.ts

├── coupons/                # Coupon management
│   └── route.ts

├── course-categories/      # Category CRUD
│   └── route.ts

├── course-filters/         # Filter options
│   └── route.ts

├── course-subjects/        # Subject assignment
│   └── route.ts

├── courses/                # Course CRUD
│   └── route.ts

├── dashboard-cards/        # Dashboard config
│   └── route.ts

├── enrollment-control/     # Enrollment settings
│   └── route.ts

├── enrollment-settings/    # Auto-approval, delays
│   └── route.ts

├── enrollments/            # Enrollment CRUD
│   └── route.ts

├── exam-rules/             # Exam rule templates
│   └── route.ts

├── exams/                  # Exam CRUD
│   └── route.ts

├── flow4/                  # Flow 4 course exams
│   └── route.ts

├── home-cards/             # Home card config
│   └── route.ts

├── jerseys/                # Jersey gallery
│   └── route.ts

├── logout/                 # Admin logout
│   └── route.ts

├── materials/              # Course materials
│   └── route.ts

├── media/                  # File upload/delete
│   └── route.ts

├── notifications/          # Push notifications
│   └── route.ts

├── papers/                 # Exam papers/PDFs
│   └── route.ts

├── pdf-materials/          # PDF upload
│   └── route.ts

├── profile/                # Admin profile
│   └── route.ts

├── push/                   # Push token management
│   └── route.ts

├── qa/                     # Q&A moderation
│   └── route.ts

├── roles/                  # Role management
│   └── route.ts

├── security-settings/      # Admin security
│   └── route.ts

├── students/               # Student list/manage
│   └── route.ts

└── system/                 # System info
    └── route.ts

```

### Public/Student APIs

```
src/app/api/
├── me/                     # Student profile
│   └── route.ts

├── enrollments/            # Student enrollments
│   └── route.ts

├── exams/                  # Exam access & taking
│   ├── [id]/
│   │   └── route.ts
│   ├── mine/
│   │   └── route.ts
│   └── completed-public/
│       └── route.ts

├── courses/                # Course catalog
│   ├── route.ts
│   └── category-counts/
│       └── route.ts

├── public-exams/           # Public exam listing
│   └── route.ts

├── qa/                     # Q&A forum
│   └── route.ts

├── reviews/                # Student reviews
│   └── route.ts

├── coupons/                # Coupon validation
│   └── route.ts

├── notifications/          # Notification count
│   └── route.ts

├── push/                   # Push token registration
│   └── route.ts

├── files/                  # Legacy file upload serving
│   └── [id]/route.ts

```

### Website Configuration APIs

```
src/app/api/
├── hero/                   # Hero section settings
│   └── route.ts

├── homepage-sections/      # Section visibility
│   └── route.ts

├── homepage-courses/       # Featured courses config
│   └── route.ts

├── dashboard-cards/        # Student dashboard config
│   └── route.ts

├── featured-courses/       # Featured courses list
│   └── route.ts

├── featured-slides/        # Banner carousel
│   └── route.ts

├── banners/                # Banner management
│   └── route.ts

├── faqs/                   # FAQ content
│   └── route.ts

├── website-settings/       # Site title, meta
│   └── route.ts

├── theme-settings/         # Light/dark theme
│   └── route.ts

├── navbar-settings/        # Navbar config
│   └── route.ts

├── logo/                   # Logo management
│   └── route.ts

├── seo-settings/           # SEO meta tags
│   └── route.ts

├── social-links/           # Social media links
│   └── route.ts

├── mentors/                # Mentor profiles
│   └── route.ts

├── promotions/             # Promotions/campaigns
│   └── route.ts

└── uploads/                # File uploads
    └── route.ts

```

---

## `/src/lib` - Shared Business Logic (120+ files)

### Core Infrastructure
```
src/lib/
├── mysql.ts                # MySQL pool, query cache, transactions
├── firebase.ts             # Firebase client initialization
├── firebase-admin.ts       # Firebase Admin SDK
├── auth-api.ts             # Token verification from Bearer header
├── auth-context.tsx        # React context for auth state
├── storage.ts              # Media upload/delete operations
├── api-cache.ts            # Response caching helpers

```

### Authentication & Authorization
```
src/lib/
├── admin.ts                # isAdminUid(), requireAdmin(), requirePermission()
├── administration.ts       # Admin accounts, roles, activity logs
├── roles.ts                # Role & permission types

```

### Student & Profile
```
src/lib/
├── enrollments.ts          # Enrollment types, fetchEnrollments()
├── student-id.ts           # Generate MS-XXXXXXXX IDs
├── students-admin.ts       # Admin student operations

```

### Courses & Curriculum
```
src/lib/
├── courses.ts              # Course types, batches, categories
├── course-catalog.ts       # Live course catalog fetching
├── course-categories.ts    # Category data access
├── course-categories-store.ts  # Category store operations
├── course-content.ts       # Content layouts (Flow 1–5)
├── course-content-structure.ts # Content structure helpers
├── course-filters.ts       # Course filtering logic
├── featured-courses.ts     # Featured/promoted courses
├── courses-admin.ts        # Admin course operations
├── category-courses-client.ts  # Client category access
├── course-papers.ts        # Exam papers/PDFs
├── course-routine-viewer.ts    # Course routine/schedule
├── pdf-materials.ts        # PDF material handling

```

### Exams
```
src/lib/
├── exams-admin.ts          # Exam CRUD, admin operations (200+ lines)
├── exam-taking.ts          # Student exam experience, scoring
├── exam-lifecycle.ts       # Exam state (Upcoming/Live/Closed)
├── exam-rules.ts           # Rule templates (medical, academic)
├── exam-variants.ts        # Question versioning (Bangla/English)
├── flow4.ts                # Flow 4 exam system
├── flow4-exam-lifecycle.ts # Flow 4 exam states
├── flow5.ts                # Flow 5 exam system
├── flow5-shared.ts         # Flow 5 shared logic
├── enrolled-exam-lifecycle.ts  # Course exam lifecycle
├── public-exams.ts         # Public exam types
├── public-exams-server.ts  # Public exam data fetching
├── public-exam-access.ts   # Public exam access control
├── public-exam-structure.ts    # Exam structure
├── public-exam-view.ts     # Exam display logic
├── public-exam-results.ts  # Results display
├── exam-rules-settings.ts  # Rule configuration
├── my-exam-results.ts      # Student's results

```

### Enrollments & Applications
```
src/lib/
├── enrollments.ts          # Enrollment types, fetching
├── enrollments-admin.ts    # Admin enrollment operations
├── enrollment-applications.ts  # Paid course applications
├── enrollment-approval.ts  # Approval workflow
├── course-access.ts        # Course access checks
├── course-exam-access.ts   # Exam access for enrolled students
├── eligibility.ts          # Eligibility checks

```

### Q&A System
```
src/lib/
├── qa.ts                   # Q&A types (Question, Answer, Subject)
├── qa-store.ts             # Q&A data access (fetch, insert)
├── qa-ask-card-settings.ts # Ask card config

```

### Website & Branding
```
src/lib/
├── website-settings.ts     # Global site config
├── website-settings-constants.ts   # Default settings
├── hero-settings.ts        # Hero section config
├── theme-settings.ts       # Light/dark theme + colors
├── navbar.ts               # Navigation config
├── navbar-constants.ts     # Default navbar
├── seo-settings.ts         # Meta tags + OpenGraph
├── logo.ts                 # Logo management
├── logo-store.ts           # Logo data access
├── logo-background.ts      # Logo backgrounds

```

### Marketing & Promotions
```
src/lib/
├── reviews.ts              # Review types
├── reviews-store.ts        # Review data access
├── faq.ts                  # FAQ types
├── faq-store.ts            # FAQ data access
├── faq-sanitize.ts         # FAQ HTML sanitization
├── banners.ts              # Banner types
├── banner-slides.ts        # Banner carousel
├── banner-store.ts         # Banner data access
├── mentors.ts              # Mentor profiles
├── promotions.ts           # Promotions/campaigns
├── coupons.ts              # Coupon validation + discounts
├── payment-card.ts         # Payment card config
├── payment-card-config.ts  # Card display settings
├── jerseys.ts              # Jersey gallery

```

### Dashboard & Home
```
src/lib/
├── dashboard.tsx           # Student dashboard component
├── dashboard-cards.ts      # Dashboard card configs
├── glance-stats.ts         # Stats display
├── home-cards.ts           # Home card configs
├── homepage-sections.ts    # Dynamic sections
├── homepage-sections-constants.ts  # Section definitions
├── homepage-courses.ts     # Featured courses
├── homepage-courses-constants.ts   # Featured config

```

### Utilities & Helpers
```
src/lib/
├── nav-links.ts            # Navigation link helpers
├── social-links.ts         # Social media links
├── social-links-constants.ts   # Default social links
├── video-embed.ts          # Video embedding
├── image-dimensions.ts     # Image size helpers
├── success.ts              # Success state types
├── paste-mcq-parser.ts     # MCQ parser from paste
├── openrouter.ts           # AI service integration
├── push.ts                 # Push notifications
├── push-admin.ts           # Admin push operations
├── access.ts               # Access control helpers
├── content-control.ts      # Content visibility control
├── content-admin.ts        # Admin content operations
├── backup.ts               # Database backup operations

```

---

## `/src/components` - React Components (100+ files)

### Root Layout Components
```
src/components/
├── Navbar.tsx              # Top navigation (logo, menu, auth, notifications)
├── Footer.tsx              # Footer (links, social, contact)
├── BottomNav.tsx           # Mobile bottom navigation
├── Logo.tsx                # Logo component
├── LogoProvider.tsx        # Logo context provider
├── ThemeProvider.tsx       # Theme context (dark/light)
├── ThemeToggle.tsx         # Theme switcher button
├── WebsiteSettingsProvider.tsx  # Global settings provider

```

### Homepage Components (`src/components/home/`)
```
src/components/home/
├── Hero.tsx                # Hero banner with CTA
├── FeaturedCourses.tsx     # Featured courses carousel
├── BannerSlider.tsx        # Rotating banners
├── Mentors.tsx             # Mentor profiles gallery
├── StudentReviews.tsx      # Testimonials carousel
├── FaqSection.tsx          # FAQ accordion
├── GlanceSection.tsx       # Stats glance
├── WhyMediSpark.tsx        # Why choose us
├── JerseyGallery.tsx       # Media gallery
├── JoinWithUs.tsx          # Social links CTA
├── OurSuccess.tsx          # Success stories
├── AnnouncementBar.tsx     # Top announcement
├── HomepageCourses.tsx     # Homepage courses display
├── SectionHeading.tsx      # Section title helper
├── PromotionsSection.tsx   # Promotions display

```

### Course Components
```
src/components/
├── CourseCard.tsx          # Course preview card
├── CoursesView.tsx         # Course list layout
├── CategoryCard.tsx        # Category preview
├── ExamCard.tsx            # Exam preview card
├── ExamCategoryCards.tsx   # Exam category grid
├── ExamDetailInfo.tsx      # Exam metadata display
├── ExamRules.tsx           # Exam rules display
├── ExamRulesGate.tsx       # Rules acceptance gate
├── BatchCourseList.tsx     # Batch-filtered courses
├── CourseRoutineViewer.tsx # Course schedule display
├── StartExamButton.tsx     # Exam start button
├── MyEnrolledExams.tsx     # Student's exams list
├── PublicExamList.tsx      # Public exam listing
├── PublicExamCategoryView.tsx  # Category exam view
├── TimerSelection.tsx      # Timer choice UI

```

### Exam Components (`src/components/exam/`)
```
src/components/exam/
├── ExamLockContext.tsx     # Prevents navigation during exam
├── ExamResultClient.tsx    # Result display
├── HideDuringExam.tsx      # Hide content during exam

```

### Q&A Components
```
src/components/
├── QaExplorer.tsx          # Q&A browsing interface
├── QaAskForm.tsx           # Question submission form
├── QaAnswer.tsx            # Answer display
├── QaQuestionItem.tsx      # Question list item
├── QaSubjectPicker.tsx     # Subject selector
├── QaGuideline.tsx         # Guidelines modal

```

### General Components
```
src/components/
├── SectionHeader.tsx       # Section title template
├── CategoryCard.tsx        # Category card (generic)

```

### Admin Components (`src/components/admin/`)
```
src/components/admin/
├── AdminShell.tsx          # Admin layout wrapper
├── AdminPageHeader.tsx     # Admin page header
├── AdminCategoryPage.tsx   # Category page template
├── AdminEnrolledCourses.tsx    # Enrolled courses viewer
├── AdminCoursesReplica.tsx # Courses replica
├── CourseManager.tsx       # Course CRUD interface
├── CategoryCourseManager.tsx   # Category course editor
├── CourseCategoryManager.tsx   # Category management
├── CourseManagerChip.tsx   # Course chip component
├── ExamManager.tsx         # Exam CRUD + management
├── ExamManageClient.tsx    # Exam client component
├── ExamQuestions.tsx       # Question bank editor
├── ExamPaperEditor.tsx     # Exam paper editor
├── ExamRulesEditor.tsx     # Rules editor
├── FaqManager.tsx          # FAQ management
├── LogoManager.tsx         # Logo upload + variants
├── MediaUploadField.tsx    # Reusable upload UI
├── HeroTextEditor.tsx      # Hero section editor
├── PushManager.tsx         # Push notification UI
├── PromotionManager.tsx    # Coupon management
├── FaviconManager.tsx      # Favicon upload
├── PublicExamCategoryManager.tsx   # Category manager
├── PublicExamHub.tsx       # Exam hub display
├── PublicExamCategory.tsx  # Category view
├── PublicExamResultDetailView.tsx  # Result details
├── AdminSearch.tsx         # Search component
├── AdminConfirmDialog.tsx  # Confirm dialog
├── AdminEmptyState.tsx     # Empty state
├── AdminPlaceholder.tsx    # Placeholder
├── AdminSectionManage.tsx  # Section editor
├── AdminSectionHold.tsx    # Section container
├── HomeControlBar.tsx      # Home control UI
├── EnrollmentControlShared.tsx  # Shared enrollment UI
├── AdminThemeProvider.tsx  # Admin theme
├── AdminThemeToggle.tsx    # Admin theme switcher
├── AdminToastProvider.tsx  # Toast notifications
├── HideOnAdmin.tsx         # Hide on admin pages
├── AdminSkeleton.tsx       # Loading skeleton
├── LegacyCourseContent.tsx # Legacy content
├── MaterialPdf/            # PDF material components
├── SectionToggle.tsx       # Section visibility toggle
├── WebsiteAdminShell.tsx   # Website config shell
├── MaterialPdf/            # PDF materials folder
├── admin-ui.ts             # Admin UI utilities
├── hub-ui.tsx              # Hub UI components
└── icons.tsx               # Admin icons

```

### Auth Components (`src/components/auth/`)
```
src/components/auth/
└── (various auth-related components)

```

### Dashboard Components (`src/components/dashboard/`)
```
src/components/dashboard/
└── (various dashboard components)

```

### Navigation Components (`src/components/navigation/`)
```
src/components/navigation/
└── (various navigation components)

```

### Utilities
```
src/components/
├── lazy-components.tsx     # Lazy-loaded components
├── social-icons.ts         # Social media icons

```

---

## `/src/sql` - Database Migrations (90+ files)

### Core Schema Migrations
```
src/sql/
├── exam-system-architecture-migration.sql       # Exam engine foundation
├── students-enrollments-migration.sql           # Student & enrollment tables
├── courses-migration.sql                        # Course registry
├── catalog-courses-*.sql                        # Course catalog variants
├── exam-system-v2-migration.sql                 # Exam system v2
├── exam-unified-scope-migration.sql             # Unified exam scope
├── exams-enrolled-migration.sql                 # Enrolled exam support
├── exams-ends-at-migration.sql                  # Exam end times
├── exams-public-page-migration.sql              # Public exam pages
├── exams-course-type-migration.sql              # Course types for exams
├── exam-mode-migration.sql                      # Live vs practice mode

```

### Admin & Security
```
src/sql/
├── admins-management-migration.sql              # Admin accounts table
├── admin-backend-migration.sql                  # Admin backend
├── staff-roles-migration.sql                    # Staff roles
├── role-permissions-migration.sql               # Permission system
├── admin-courses-migration.sql                  # Admin courses

```

### Course Content
```
src/sql/
├── course-categories-migration.sql              # Category table
├── course-category-id-migration.sql             # Category ID mapping
├── course-content-structure-migration.sql       # Content hierarchy
├── course-content-flow-migration.sql            # Flow layouts
├── course-types-migration.sql                   # Course type enum
├── course-filter-options-migration.sql          # Filter options
├── course-subject-assignments-migration.sql     # Subject assignment
├── course-routine-migration.sql                 # Schedule/routine

```

### Exams & Questions
```
src/sql/
├── exam-results-migration.sql                   # Result storage
├── exam-rules-settings-migration.sql            # Rule templates
├── exam-language-sets-migration.sql             # Bangla/English variants
├── exam-ranking-indexes-migration.sql           # Leaderboard indexes
├── flow4-exam-batch-lifecycle-migration.sql     # Flow 4 batches
├── flow4-course-content-migration.sql           # Flow 4 content
├── flow4-subject-direct-migration.sql           # Flow 4 subjects
├── flow4-to-flow5-migration.sql                 # Flow 4→5 migration
├── flow5-exam-flow-migration.sql                # Flow 5 exam structure
├── exam-system-architecture-migration.sql       # Arch (includes options)

```

### Enrollments
```
src/sql/
├── enrollment-approval-migration.sql            # Approval workflow
├── enrollment-applications-migration.sql        # Payment applications
├── enrollment-payment-card-coupon-toggle-migration.sql  # Coupon support

```

### Q&A System
```
src/sql/
├── qa-migration.sql                             # Q&A tables
├── qa-context-migration.sql                     # Context (course/category)
├── qa-ask-card-migration.sql                    # Ask form config

```

### Marketing & Content
```
src/sql/
├── banners-migration.sql                        # Banner storage
├── featured-courses-migration.sql               # Featured list
├── catalog-courses-featured-migration.sql       # Featured variants
├── catalog-courses-category-migration.sql       # Category variants
├── faqs-migration.sql                           # FAQ storage
├── faqs-video-migration.sql                     # Video FAQs
├── faq-answer-types-migration.sql               # FAQ types
├── reviews-migration.sql                        # Review storage
├── marketing-promotions-migration.sql           # Promotions
├── mentors-migration.sql                        # Mentor profiles
├── mentors-card-migration.sql                   # Mentor cards
├── mentors-extended-migration.sql               # Extended mentors
├── mentor-cofounder-migration.sql               # Cofounder flag
├── jerseys-link-migration.sql                   # Jersey gallery
├── social-links-migration.sql                   # Social links
├── social-links-extended-migration.sql          # Extended links

```

### Website Config
```
src/sql/
├── website-settings-migration.sql               # Site config
├── theme-settings-migration.sql                 # Theme customization
├── seo-settings-migration.sql                   # SEO meta
├── hero-settings-migration.sql                  # Hero section
├── navbar-settings-migration.sql                # Navbar config
├── footer-settings-migration.sql                # Footer config
├── logo-admin-migration.sql                     # Logo management
├── logo-theme-migration.sql                     # Theme logos

```

### Dashboard & Home
```
src/sql/
├── dashboard-cards-migration.sql                # Dashboard card config
├── home-cards-migration.sql                     # Home card config
├── homepage-sections-migration.sql              # Section visibility
├── homepage-courses-migration.sql               # Featured on home
├── glance-base-student-migration.sql            # Glance stats

```

### Student & Support
```
src/sql/
├── student-profile-migration.sql                # Profile data
├── student-learning-migration.sql               # Learning progress
├── student-recent-views-migration.sql           # Recently viewed
├── students-admin-migration.sql                 # Admin student ops
├── student-categories-migration.sql             # Student categories

```

### Notifications & Files
```
src/sql/
├── push-tokens-migration.sql                    # Push token storage
├── notification-reads-migration.sql             # Notification read status
├── uploads-migration.sql                        # Legacy file blob storage
├── pdf-materials-migration.sql                  # PDF materials
├── contact-settings-migration.sql               # Contact info
├── join-with-us-migration.sql                   # Join section
└── why-cards-replace.sql                        # Why section update

```

### Coupons
```
src/sql/
├── payment-card-migration.sql                   # Payment card
├── payment-card-full-config-migration.sql       # Full card config
├── payment-card-coupon-toggle-migration.sql     # Coupon support
├── payment-settings-migration.sql               # Payment settings

```

### Miscellaneous
```
src/sql/
├── announcement-settings.sql                    # Announcements
├── content-control-migration.sql                # Content visibility
├── contact-settings-migration.sql               # Contact info
└── favourites-dashboard-migration.sql           # Favorites

```

---

## Root Files Summary

| File | Purpose |
|------|---------|
| `package.json` | Dependencies (React 19, Next 16, Firebase, MySQL2) |
| `tsconfig.json` | TypeScript compilation config |
| `next.config.ts` | Next.js build & image optimization |
| `postcss.config.mjs` | CSS processing |
| `tailwind.config.ts` | Tailwind CSS v4 configuration |
| `eslint.config.mjs` | Code quality rules |
| `README.md` | Project documentation |
| `.npmrc` | NPM registry |
| `.gitignore` | Git excludes |
| `pnpm-lock.yaml` | Dependency lock file |
| `pnpm-workspace.yaml` | Workspace configuration |
| `next-env.d.ts` | Next.js TypeScript definitions |

---

## Summary Statistics

- **Total App Routes**: 50+ pages (admin + student)
- **Total API Routes**: 140+ endpoints
- **Library Files**: 120+ utility/business logic files
- **Components**: 100+ React components
- **SQL Migrations**: 90+ database schema files
- **Total Files**: 560+

---

## Key Insights

### The Largest Domains
1. **Admin Panel** (40+ pages) - Comprehensive management UI
2. **API Routes** (140+ routes) - Full REST API surface
3. **Library Logic** (120+ files) - Complex business rules (courses, exams, enrollments)
4. **Components** (100+ files) - Reusable UI modules
5. **Database** (90+ migrations) - Rich schema supporting all features

### Code Organization
- **Lib files** are organized by feature domain (courses, exams, qa, etc.)
- **API routes** follow Next.js App Router structure
- **Components** grouped by feature area (home, admin, exam, etc.)
- **SQL migrations** named after feature + "migration" suffix

### Tech Stack Highlights
- **Frontend**: React 19 + Next.js 16 (App Router, SSR/SSG)
- **Styling**: Tailwind CSS v4 (utility-first)
- **Backend**: Node.js (Next.js API routes)
- **Database**: MySQL (via mysql2)
- **Auth**: Firebase (Google OAuth)
- **Media**: Self-hosted VM (nginx + Node.js service)
- **Deployment**: Vercel (auto-deploy from main)
