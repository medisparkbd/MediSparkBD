// Internal reference: how the MediSpark BD website actually functions.
// READ-ONLY. Every entry describes behavior already enforced or documented in
// the current codebase — nothing here is proposed or invented. Each item cites
// the source file/doc where the behavior lives, so admins can trace anything.

export type RuleDocItem = {
  id: string;
  title: string;
  text: string;
  source: string;
};

export type RuleDocSection = {
  id: string;
  category: string;
  title: string;
  intro: string;
  items: RuleDocItem[];
};

export const RULE_DOC_CATEGORIES = [
  "Authentication",
  "Admin & Roles",
  "Students",
  "Courses",
  "Enrollment & Payments",
  "Exams",
  "Q&A",
  "Content & Marketing",
  "Media",
  "Admin Panel",
  "APIs",
  "Database",
  "Website Settings",
  "Notifications",
  "Deployment",
  "Limitations",
] as const;

export const RULE_DOC_UPDATED = "27 Sep 2026";

export const RULE_DOC_SECTIONS: RuleDocSection[] = [
  {
    id: "authentication",
    category: "Authentication",
    title: "1. Authentication & Session",
    intro: "One auth system only: Firebase Google sign-in. No second login system exists.",
    items: [
      {
        id: "AUTH-01",
        title: "Google sign-in is the only login method",
        text: "Users sign in with Firebase Google Sign-In via popup, with redirect as fallback. The session persists in the browser (browserLocalPersistence), so users stay logged in across visits.",
        source: "src/lib/auth-context.tsx, CODEBASE_SUMMARY.md",
      },
      {
        id: "AUTH-02",
        title: "Every API call carries a Firebase Bearer token",
        text: "The client mints an ID token (user.getIdToken()) and sends it as Authorization: Bearer <token>. The server extracts it and verifies with the Firebase Admin SDK. Missing or invalid token means no identity — the route returns 401.",
        source: "src/lib/auth-api.ts, src/lib/firebase-admin.ts, API_REFERENCE.md",
      },
      {
        id: "AUTH-03",
        title: "ID tokens rotate; the admin shell keeps them fresh",
        text: "Firebase rotates ID tokens about hourly. The admin gate listens for token changes and refreshes silently, and a failed refresh never wipes the stored token (otherwise every later request would falsely 401).",
        source: "src/components/admin/admin-ui.ts",
      },
      {
        id: "AUTH-04",
        title: "Login loads profile + enrollments automatically",
        text: "After sign-in the client calls /api/me (profile) and loads active enrollments, then adjusts the UI (dashboard visible, login hidden). Redirect sign-in errors are captured via sessionStorage.",
        source: "src/lib/auth-context.tsx, CODEBASE_SUMMARY.md",
      },
    ],
  },
  {
    id: "admin-roles",
    category: "Admin & Roles",
    title: "2. Admin Authorization & Roles",
    intro: "Admin rights come from the admins table + role matrix. UI hiding is never the enforcement — every mutation is gated server-side.",
    items: [
      {
        id: "ADM-01",
        title: "Admin check is UID or verified-email, active only",
        text: "A caller is admin if their Firebase UID — or their verified email as fallback (survives Firebase project changes) — matches a row in admins with is_active = 1. Inactive admins are always denied.",
        source: "src/lib/admin.ts → isAdminUid, requireAdmin",
      },
      {
        id: "ADM-02",
        title: "Three roles, ten permissions, fail-closed",
        text: "Roles: admin (all 10 permissions), moderator (9 — everything except manageAdmins), teacher (exactly 6: manageContent, manageExams, manageCourseContent, managePublicExam, manageQa, manageResults). Unknown controls, missing roles, or missing permissions deny access. Only admin bypasses.",
        source: "src/lib/admin-access.ts, tests/admin-authorization.test.ts",
      },
      {
        id: "ADM-03",
        title: "manageAdmins can never be delegated",
        text: "Even an admin cannot persist manageAdmins for moderator/teacher — the server strips it on save. Admin Center and Administration pages require it, so they stay admin-only.",
        source: "src/lib/administration.ts → saveRolePermissions",
      },
      {
        id: "ADM-04",
        title: "Every admin action is audit-logged",
        text: "Mutations write to admin_activity_logs (admin_uid, admin_email, action, detail, IP). Logging is best-effort and never breaks the request. Logins are recorded at most once per 30 minutes per admin.",
        source: "src/lib/administration.ts → logAdminAction, recordAdminLogin",
      },
      {
        id: "ADM-05",
        title: "Admin gate result is cached briefly, then rechecked",
        text: "The client caches the /api/admin gate per user for 5 minutes (memory + sessionStorage) so page-to-page navigation is instant, but always revalidates server-side in the background so permission changes apply.",
        source: "src/components/admin/admin-ui.ts, src/app/api/admin/route.ts",
      },
    ],
  },
  {
    id: "students",
    category: "Students",
    title: "3. Students & Registration",
    intro: "Student identity is Firebase UID plus a human-readable MS-XXXXXXXX handle.",
    items: [
      {
        id: "STU-01",
        title: "Profile row is created at registration",
        text: "students.uid (Firebase UID) is the primary key; student_id is a unique MS-XXXXXXXX handle backed by the student_ids table. /api/me supports GET (fetch), POST (register with form data), PATCH (update + profile picture).",
        source: "CODEBASE_SUMMARY.md, API_REFERENCE.md → /api/me",
      },
      {
        id: "STU-02",
        title: "Enrollments drive what a student can access",
        text: "enrollments rows carry course_id, kind (free/paid), fee, and status (pending/active/cancelled/completed). Only active enrollments unlock course content and exam access.",
        source: "CODEBASE_SUMMARY.md → enrollments",
      },
    ],
  },
  {
    id: "courses",
    category: "Courses",
    title: "4. Courses & Catalog",
    intro: "Public catalog plus admin-managed course structure with layout flows.",
    items: [
      {
        id: "CRS-01",
        title: "Only published + available courses are public",
        text: "catalog_courses rows use slug as key and carry status (published/unpublished) and availability (available/hidden), plus kind (free/paid), fee, discount_fee, image, batch, and coupon_enabled. Admins manage them via /api/admin/courses (create/update/delete with validation).",
        source: "CODEBASE_SUMMARY.md, API_REFERENCE.md → /api/admin/courses",
      },
      {
        id: "CRS-02",
        title: "Course content follows layout flows 1–5",
        text: "Each course picks a content flow (Flow 1 = direct subject→chapters … Flow 5 = exam-centric). Content is organized through chapters, subjects, and course_content_flow configuration, managed under Course Content Control.",
        source: "CODEBASE_SUMMARY.md → Flow-Based Course Content, src/lib/course-content.ts",
      },
      {
        id: "CRS-03",
        title: "Categories, batches, and featured lists are admin-driven",
        text: "Courses group by category (SSC/HSC/Medical/Varsity) and batch. Homepage visibility comes from featured_courses and homepage section settings — all admin-configurable.",
        source: "CODEBASE_SUMMARY.md → catalog_courses, featured_courses",
      },
    ],
  },
  {
    id: "enrollment-payments",
    category: "Enrollment & Payments",
    title: "5. Enrollment & Payments",
    intro: "Free enrollment is instant; paid enrollment is proof + manual approval.",
    items: [
      {
        id: "ENR-01",
        title: "Free courses enroll instantly (still validated)",
        text: "One POST creates an active enrollment, but the server still checks the course exists and the student is not already enrolled.",
        source: "src/app/api/enrollments (via CODEBASE_SUMMARY.md flow)",
      },
      {
        id: "ENR-02",
        title: "Paid enrollment requires payment proof",
        text: "Paid POST must include transactionId (4–64 chars), senderMobile in 01XXXXXXXXX format, and paymentMethod (bkash/nagad), plus optional couponCode. The server validates: registered student, course exists, no active enrollment, unique transaction ID, max one pending application per course — then creates a pending enrollment + payment application record.",
        source: "CODEBASE_SUMMARY.md → Course Enrollment, API_REFERENCE.md → /api/enrollments",
      },
      {
        id: "ENR-03",
        title: "Admin approval flips pending → active",
        text: "Paid enrollments start pending. An admin approves or rejects via /api/admin/enrollments; only active enrollments unlock content, course exams, and Q&A asking rights.",
        source: "CODEBASE_SUMMARY.md, API_REFERENCE.md → /api/admin/enrollments",
      },
      {
        id: "ENR-04",
        title: "Coupon discounts are recalculated server-side",
        text: "Client-sent discount values are never trusted. The server revalidates the coupon (existence, window, usage limit) and recomputes the discounted fee on both coupon validation and enrollment.",
        source: "src/lib/coupons.ts, API_REFERENCE.md",
      },
      {
        id: "ENR-05",
        title: "Duplicate transaction IDs are rejected",
        text: "Payment transaction IDs must be unique, blocking double-spend proofs. Application creation runs transactionally with row locks against races.",
        source: "CODEBASE_SUMMARY.md → withTransaction, SELECT … FOR UPDATE",
      },
    ],
  },
  {
    id: "exams",
    category: "Exams",
    title: "6. Exams — Taking, Scoring, Sessions",
    intro: "One unified engine powers public, practice, and enrolled exams; access control sits on top.",
    items: [
      {
        id: "EXM-01",
        title: "Exam kinds and states are the source of truth",
        text: "kind is public / practice / enrolled; status is draft / published / closed. Draft is invisible, published is attemptable inside its window, closed blocks new attempts.",
        source: "CODEBASE_SUMMARY.md → Unified Exam Engine, exams table",
      },
      {
        id: "EXM-02",
        title: "Correct answers never reach the browser during exams",
        text: "The start endpoint returns sanitized questions only. Scoring runs entirely server-side after submit, so the client never holds the answer key.",
        source: "src/lib/exam-taking.ts, src/app/api/exams/[id]",
      },
      {
        id: "EXM-03",
        title: "Start is validated five ways",
        text: "Starting checks: authenticated user, exam published + active, inside the exam window, attempt limit not exceeded, and (for course exams) active enrollment. Then the server creates an in-progress attempt plus a device session.",
        source: "CODEBASE_SUMMARY.md → Exam Taking, src/lib/exam-lifecycle.ts",
      },
      {
        id: "EXM-04",
        title: "Score = correct×marks − wrong×penalty (minus second-timer cut)",
        text: "Each correct answer earns full marks, each wrong answer deducts negative_per_wrong (configurable per exam, e.g. 0.25) when negative marking is enabled. A repeat (second-timer) attempt can lose an extra percentage; first attempts never do.",
        source: "src/lib/exam-taking.ts, exams table columns",
      },
      {
        id: "EXM-05",
        title: "Sessions lock to one device; timers auto-submit",
        text: "Starting on a new device ends the old session and auto-submits its locked answers. Timer expiry auto-submits too. Results land in exam_results with snapshots, and leaderboards pre-compute into exam_rankings.",
        source: "CODEBASE_SUMMARY.md → Exam Taking, exam_sessions table",
      },
      {
        id: "EXM-06",
        title: "Per-exam display rules are strictly exam-scoped",
        text: "Rows in exam_rules belong to exactly one exam_id and are never shared. Updates, deletes, and reorders always filter by (id AND exam_id). New exams are seeded with the standard 8-rule Bangla set, editable afterwards.",
        source: "src/lib/exam-rules.ts, src/app/api/admin/exam-rules/route.ts",
      },
    ],
  },
  {
    id: "qa",
    category: "Q&A",
    title: "7. Q&A Forum",
    intro: "Async teacher-answered model, gated to paying students.",
    items: [
      {
        id: "QA-01",
        title: "Asking requires an active paid enrollment",
        text: "POST /api/qa enforces: signed in, actively enrolled in the submitted course, at least one active paid enrollment, valid category→course→subject chain, and text of 5–2000 chars.",
        source: "CODEBASE_SUMMARY.md → Q&A flow, API_REFERENCE.md → POST /api/qa",
      },
      {
        id: "QA-02",
        title: "Images allowed, audio not accepted",
        text: "Questions may attach an image URL; audio submissions are not accepted (legacy references may remain in code). New questions appear as unanswered until a teacher answers via the admin panel.",
        source: "CODEBASE_SUMMARY.md → Q&A, src/lib/qa-store.ts",
      },
    ],
  },
  {
    id: "content-marketing",
    category: "Content & Marketing",
    title: "8. Content & Marketing",
    intro: "Public lists only ever show publishable states; admins moderate the rest.",
    items: [
      {
        id: "CNT-01",
        title: "Reviews, FAQs, banners, mentors respect publish flags",
        text: "The reviews API returns published rows only; FAQs, banner slides, and mentors use is_active / status flags. Admins publish, reject, or delete through the panel, with VM file cleanup on media changes.",
        source: "src/app/api/reviews, src/lib/reviews-store.ts, src/lib/faq-store.ts",
      },
      {
        id: "CNT-02",
        title: "Coupons carry type, value, limits, and windows",
        text: "Coupons store code, discount_type (fixed/percent), discount_value, usage_limit/used_count, valid_from/until, and is_active. Managed under /api/admin/coupons; validated server-side at use time.",
        source: "CODEBASE_SUMMARY.md → coupons, API_REFERENCE.md",
      },
    ],
  },
  {
    id: "media",
    category: "Media",
    title: "9. Media & Uploads",
    intro: "Files live on the self-hosted VM; the database stores URLs only.",
    items: [
      {
        id: "MED-01",
        title: "Uploads and deletes need the shared media token",
        text: "nginx serves /var/www/medispark-uploads/ at medispark.duckdns.org/medifiles. Upload/delete endpoints require the MEDIA_UPLOAD_TOKEN (X-Medifiles-Token header). MIME type derives from file extension.",
        source: "src/lib/storage.ts, server/medifiles-server.mjs, CODEBASE_SUMMARY.md",
      },
      {
        id: "MED-02",
        title: "Legacy binary fallback still exists",
        text: "Very old uploads stored as MySQL blobs remain readable via /api/files/<id>; everything new is VM-hosted by URL.",
        source: "CODEBASE_SUMMARY.md → Media VM",
      },
    ],
  },
  {
    id: "admin-panel",
    category: "Admin Panel",
    title: "10. Admin Panel Structure",
    intro: "Sidebar navigation + hub cards, both filtered by the same permission map.",
    items: [
      {
        id: "PNL-01",
        title: "Sidebar holds the control sections",
        text: "HOME plus Website, Enrollment, Home Page, Course, Course Content, Material PDF, Public Exam, Q&A, Dashboard, Student, Result, Notification Control, Rules, and Admin Center — each item hidden unless the signed-in role grants it.",
        source: "src/components/admin/AdminShell.tsx",
      },
      {
        id: "PNL-02",
        title: "Route guard denies with an explanation, never a loop",
        text: "If a role opens a control it lacks, the shell shows an access-denied card with a back-to-home link. The /admin hub and /admin/profile stay reachable for every signed-in admin; all real data behind them stays permission-gated.",
        source: "src/components/admin/AdminShell.tsx, src/lib/admin-access.ts",
      },
      {
        id: "PNL-03",
        title: "Admin search only suggests permitted sections",
        text: "The header search (and mobile search) filters the section index through the same control map and shows nothing until the gate resolves — fail-closed.",
        source: "src/components/admin/AdminSearch.tsx",
      },
    ],
  },
  {
    id: "apis",
    category: "APIs",
    title: "11. API Conventions",
    intro: "REST under /api, admin mutations under /api/admin, one error shape.",
    items: [
      {
        id: "API-01",
        title: "Public vs student vs admin routes",
        text: "Public reads (courses, public-exams, qa browse, reviews, faqs, settings) need no token. Student writes need a Bearer token. Everything under /api/admin needs token + admin + (for mutations) the matching permission.",
        source: "API_REFERENCE.md, src/app/api/admin/*",
      },
      {
        id: "API-02",
        title: "Errors share one JSON shape",
        text: "Failures return { error: \"human-readable message\" } with standard codes: 400 bad input, 401 missing/invalid token, 403 forbidden, 404 missing, 409 conflict (e.g. duplicate rule/transaction), 500 server error.",
        source: "API_REFERENCE.md → Error Responses",
      },
      {
        id: "API-03",
        title: "Lists paginate; no rate limiting exists yet",
        text: "List endpoints accept page/limit and return total/hasMore. Rate limiting is not implemented — noted as a DDoS risk in the codebase docs.",
        source: "API_REFERENCE.md → Pagination, CODEBASE_SUMMARY.md → Limitations",
      },
    ],
  },
  {
    id: "database",
    category: "Database",
    title: "12. Database Rules",
    intro: "Azure MySQL over TLS, pooled and cached, migrated additively.",
    items: [
      {
        id: "DB-01",
        title: "TLS pool of 8 with safe placeholders",
        text: "mysql2 pool (8 connections, fast idle release for serverless). All queries use placeholders; the text protocol is used to halve WAN round-trips vs prepared statements. TLS is enforced for *.azure.com hosts.",
        source: "src/lib/mysql.ts",
      },
      {
        id: "DB-02",
        title: "SELECTs cache 5 seconds, writes invalidate",
        text: "In-memory LRU cache (500 entries, 5s TTL) applies to plain SELECTs only — never locking reads or schema introspection. Every INSERT/UPDATE/DELETE clears matching table keys.",
        source: "src/lib/mysql.ts → query cache",
      },
      {
        id: "DB-03",
        title: "Money-sensitive writes run in transactions",
        text: "Enrollment + payment-proof creation runs in withTransaction with SELECT … FOR UPDATE row locks, so concurrent requests cannot double-create.",
        source: "src/lib/mysql.ts → withTransaction, CODEBASE_SUMMARY.md",
      },
      {
        id: "DB-04",
        title: "Schema evolves additively and self-heals",
        text: "Migrations live in src/sql/*.sql and must never destructively delete tables. Runtime code uses CREATE TABLE IF NOT EXISTS plus ensureColumn (information_schema check), because Azure MySQL lacks ADD COLUMN IF NOT EXISTS.",
        source: "src/lib/mysql.ts → ensureColumn, CODEBASE_SUMMARY.md",
      },
    ],
  },
  {
    id: "website-settings",
    category: "Website Settings",
    title: "13. Website Customization",
    intro: "Branding, homepage, and navigation are database-driven and admin-edited.",
    items: [
      {
        id: "WEB-01",
        title: "Global branding, hero, theme, navbar, SEO are table-backed",
        text: "website_settings, hero_settings, theme_settings (light/dark + colors), navbar_settings, seo-settings, logos, banners, homepage sections, mentors, and footer/contact info are all admin-editable; writes require admin authorization.",
        source: "CODEBASE_SUMMARY.md → Website Configuration Tables, src/lib/website-settings.ts",
      },
    ],
  },
  {
    id: "notifications",
    category: "Notifications",
    title: "14. Notifications & Push",
    intro: "Token-based push to student segments, best-effort delivery.",
    items: [
      {
        id: "NTF-01",
        title: "Tokens registered per device, sends are bulk and best-effort",
        text: "Push tokens store in push_tokens; admins send bulk messages to segments (all / paid / free). Delivery has no retry logic.",
        source: "CODEBASE_SUMMARY.md → Push Notification Model, API_REFERENCE.md",
      },
    ],
  },
  {
    id: "deployment",
    category: "Deployment",
    title: "15. Deployment & Environments",
    intro: "Vercel web app + Azure database + VM media + Firebase auth.",
    items: [
      {
        id: "DEP-01",
        title: "Vercel auto-deploys main; Next.js standalone output",
        text: "Pushes to main auto-deploy. Runtime config comes from environment (Vercel dashboard or .env): MYSQL_*, NEXT_PUBLIC_FIREBASE_*, FIREBASE_* admin credentials, MEDIA_* URLs/token. Secrets never live in code; production strips non-error console output.",
        source: "CODEBASE_SUMMARY.md, next.config.ts",
      },
    ],
  },
  {
    id: "limitations",
    category: "Limitations",
    title: "16. Known Limitations (documented, not yet fixed)",
    intro: "Taken directly from the codebase docs so nobody mistakes these for working features.",
    items: [
      {
        id: "LIM-01",
        title: "Manual migrations, manual backups, no rate limiting",
        text: "Migrations must be applied to Azure by hand; MySQL backups are manual; no API rate limiting. Audio question support was removed (stale references may linger); PDF materials are partial; Flow 5 shows as “Course Flow 4” in UI; student MS-IDs are locally (not globally) unique; second-timer edge cases are complex.",
        source: "CODEBASE_SUMMARY.md → Known Limitations & Tech Debt",
      },
    ],
  },
];
