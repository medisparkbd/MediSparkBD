/**
 * Authorization regression tests — Role → Permission → Control.
 * Run with:  node --test tests/admin-authorization.test.ts
 * (Node 22.6+ strips types natively; no test framework dependency.)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  ADMIN_CONTROL_PERMISSIONS,
  hasControlAccess,
  hasAnyPermission,
  resolveControlPermissions,
  normalizeControlPath,
} from "../src/lib/admin-access.ts";

const admin = "admin" as const;
const moderator = "moderator" as const;
const teacher = "teacher" as const;

const MOD_PERMS = [...DEFAULT_PERMISSIONS_BY_ROLE.moderator];
const TEA_PERMS = [...DEFAULT_PERMISSIONS_BY_ROLE.teacher];
const ADMIN_PERMS = [...DEFAULT_PERMISSIONS_BY_ROLE.admin];

describe("role → permission matrix", () => {
  it("defines exactly 10 permissions", () => {
    assert.equal(ALL_PERMISSIONS.length, 10);
  });

  it("admin holds all 10 permissions", () => {
    assert.deepEqual([...ADMIN_PERMS].sort(), [...ALL_PERMISSIONS].sort());
  });

  it("moderator holds 9 permissions and NOT manageAdmins", () => {
    assert.equal(MOD_PERMS.length, 9);
    assert.ok(!MOD_PERMS.includes("manageAdmins"));
    for (const perm of ALL_PERMISSIONS) {
      if (perm === "manageAdmins") continue;
      assert.ok(MOD_PERMS.includes(perm), `moderator missing ${perm}`);
    }
  });

  it("teacher holds exactly the six teaching/content permissions", () => {
    assert.deepEqual(
      [...TEA_PERMS].sort(),
      [
        "manageContent",
        "manageExams",
        "manageCourseContent",
        "managePublicExam",
        "manageQa",
        "manageResults",
      ].sort(),
    );
  });
});

describe("admin bypass", () => {
  it("admin is allowed on every mapped control", () => {
    for (const control of Object.keys(ADMIN_CONTROL_PERMISSIONS)) {
      assert.equal(
        hasControlAccess(admin, ADMIN_PERMS, control),
        true,
        `admin denied on ${control}`,
      );
    }
  });

  it("admin is allowed on nested and unknown paths", () => {
    for (const path of [
      "/admin/public-exam/category/123",
      "/admin/exams/abc/manage",
      "/admin/totally-unknown-xyz",
    ]) {
      assert.equal(hasControlAccess(admin, ADMIN_PERMS, path), true);
    }
  });
});

describe("moderator", () => {
  it("is DENIED admin-center and administration", () => {
    assert.equal(hasControlAccess(moderator, MOD_PERMS, "/admin/admin-center"), false);
    assert.equal(
      hasControlAccess(moderator, MOD_PERMS, "/admin/admin-center/roles"),
      false,
    );
    assert.equal(
      hasControlAccess(moderator, MOD_PERMS, "/admin/administration/roles"),
      false,
    );
  });

  it("is ALLOWED student-control and enrollment-control", () => {
    assert.equal(hasControlAccess(moderator, MOD_PERMS, "/admin/student-control"), true);
    assert.equal(
      hasControlAccess(moderator, MOD_PERMS, "/admin/enrollment-control"),
      true,
    );
    assert.equal(
      hasControlAccess(moderator, MOD_PERMS, "/admin/enrollment-control/paid"),
      true,
    );
  });

  it("is ALLOWED every other mapped control", () => {
    for (const control of Object.keys(ADMIN_CONTROL_PERMISSIONS)) {
      if (
        control === "/admin/admin-center" ||
        control.startsWith("/admin/admin-center/") ||
        control === "/admin/administration" ||
        control.startsWith("/admin/administration/")
      ) {
        continue;
      }
      assert.equal(
        hasControlAccess(moderator, MOD_PERMS, control),
        true,
        `moderator denied on ${control}`,
      );
    }
  });
});

describe("teacher", () => {
  it("is DENIED enrollment-control, course-control, student-control, admin-center", () => {
    for (const denied of [
      "/admin/enrollment-control",
      "/admin/enrollment-control/free",
      "/admin/course-control",
      "/admin/student-control",
      "/admin/students/all",
      "/admin/admin-center",
      "/admin/administration/security",
      "/admin/system/status",
      "/admin/courses/all",
    ]) {
      assert.equal(hasControlAccess(teacher, TEA_PERMS, denied), false, `teacher allowed on ${denied}`);
    }
  });

  it("is ALLOWED exactly its six-permission scope", () => {
    for (const allowed of [
      "/admin/website-information",
      "/admin/home-control",
      "/admin/course-content-control",
      "/admin/public-exam-control",
      "/admin/public-exam",
      "/admin/exams",
      "/admin/qa-control",
      "/admin/qa/subject-1",
      "/admin/dashboard-control",
      "/admin/result-control",
      "/admin/notification-control",
      "/admin/content/faq",
      "/admin/website/header",
    ]) {
      assert.equal(hasControlAccess(teacher, TEA_PERMS, allowed), true, `teacher denied on ${allowed}`);
    }
  });
});

describe("nested/dynamic route handling", () => {
  it("/admin/public-exam/category/123 resolves to the public-exam permission", () => {
    const resolved = resolveControlPermissions("/admin/public-exam/category/123");
    assert.ok(resolved);
    assert.equal(resolved.control, "/admin/public-exam");
    assert.ok(resolved.required.includes("managePublicExam"));
    assert.equal(hasControlAccess(teacher, TEA_PERMS, "/admin/public-exam/category/123"), true);
    assert.equal(hasControlAccess(moderator, MOD_PERMS, "/admin/public-exam/category/123"), true);
  });

  it("deep exam-manage routes inherit the exams grant", () => {
    assert.equal(hasControlAccess(teacher, TEA_PERMS, "/admin/exams/abc/manage"), true);
    assert.equal(hasControlAccess(teacher, TEA_PERMS, "/admin/exams/enrolled"), true);
    assert.equal(
      hasControlAccess(teacher, TEA_PERMS, "/admin/public-exam/category/abc/questions"),
      true,
    );
  });

  it("never matches across a segment boundary (no evil-prefix match)", () => {
    assert.equal(resolveControlPermissions("/admin/public-exam-evil"), null);
    assert.equal(hasControlAccess(teacher, TEA_PERMS, "/admin/public-exam-evil"), false);
    assert.equal(hasControlAccess(moderator, MOD_PERMS, "/admin/public-exam-evil"), false);
  });
});

describe("fail closed", () => {
  it("unknown/unmapped controls are DENIED for non-admin roles", () => {
    for (const unknown of [
      "/admin/some-future-control",
      "/admin/unknown-xyz",
      "/admin/not-a-real-page",
    ]) {
      assert.equal(hasControlAccess(moderator, MOD_PERMS, unknown), false);
      assert.equal(hasControlAccess(teacher, TEA_PERMS, unknown), false);
    }
  });

  it("missing role / missing permissions are DENIED (except the open hub)", () => {
    assert.equal(hasControlAccess(null, [], "/admin/student-control"), false);
    assert.equal(hasControlAccess(undefined, [], "/admin/student-control"), false);
    assert.equal(hasControlAccess("teacher", [], "/admin/qa-control"), false);
    assert.equal(hasControlAccess("teacher", null, "/admin/qa-control"), false);
    assert.equal(hasControlAccess("ghost-role", ["manageContent"], "/admin/student-control"), false);
  });

  it("hasAnyPermission fails closed", () => {
    assert.equal(hasAnyPermission("teacher", [], ["manageQa"]), false);
    assert.equal(hasAnyPermission(null, ["manageQa"], ["manageQa"]), true);
    assert.equal(hasAnyPermission("admin", [], ["manageQa"]), true);
  });

  it("normalizes paths before matching", () => {
    assert.equal(normalizeControlPath("/admin/qa-control/"), "/admin/qa-control");
    assert.equal(normalizeControlPath("/admin/qa-control?x=1"), "/admin/qa-control");
    assert.equal(normalizeControlPath("admin/qa-control"), "/admin/qa-control");
    assert.equal(
      hasControlAccess(teacher, TEA_PERMS, "/admin/qa-control/?tab=1"),
      true,
    );
    assert.equal(
      hasControlAccess(teacher, TEA_PERMS, "/admin/student-control/?tab=1"),
      false,
    );
  });

  it("the open hub stays reachable but does not leak controls", () => {
    assert.equal(hasControlAccess(teacher, TEA_PERMS, "/admin"), true);
    assert.equal(hasControlAccess(moderator, MOD_PERMS, "/admin/profile/security"), true);
    // Hub access must not imply control access.
    assert.equal(hasControlAccess(teacher, TEA_PERMS, "/admin/admin-center"), false);
  });
});
