import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let current: { id: string; name: string; slug: string } | null;
let conflict: { id: string } | null;
let conflictChecks: unknown[][];
let writes: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  categoryById: async () => current,
  categoryConflict: async (...args: unknown[]) => { conflictChecks.push(args); return conflict; },
  createCategory: async (data: any) => { writes.push(["create", data]); return { id: "cc9", ...data }; },
  updateCategory: async (id: string, data: any) => { writes.push(["update", id, data]); return { id, ...data }; },
  deleteCategory: async (id: string) => { writes.push(["disable", id]); return { id, status: "INACTIVE" }; }
} } });
mock.module("./admin.audit.js", { namedExports: { recordAdminAction: async () => ({}), verifyAuditChain: async () => ({}) } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async () => ({}) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

const rejects = (promise: Promise<unknown>, statusCode: number, message: RegExp) =>
  assert.rejects(promise, (error: any) => {
    assert.equal(error.statusCode, statusCode);
    assert.match(error.message, message);
    return true;
  });

beforeEach(() => {
  current = { id: "cc1", name: "Bóng đá mini", slug: "bong-da-mini" };
  conflict = null;
  conflictChecks = [];
  writes = [];
});

describe("admin categories", () => {
  it("creates a category with a slug that keeps the d of đ", async () => {
    await adminService.createCategory("admin1", { name: "Bóng đá 7 người" });
    assert.deepEqual(writes, [["create", { name: "Bóng đá 7 người", slug: "bong-da-7-nguoi" }]]);
  });

  it("reports a duplicate name plainly instead of the database error", async () => {
    conflict = { id: "cc2" };
    await rejects(adminService.createCategory("admin1", { name: "cầu lông" }), 409, /da ton tai/);
    assert.deepEqual(writes, []);
  });

  it("keeps the slug when only the description changes, even though the form resends the name", async () => {
    await adminService.updateCategory("admin1", "cc1", { name: "Bóng đá mini", description: "Sân 5-7 người" });
    assert.deepEqual(writes, [["update", "cc1", { name: "Bóng đá mini", description: "Sân 5-7 người", slug: undefined }]]);
    assert.deepEqual(conflictChecks, [], "an unchanged name needs no duplicate check");
  });

  it("follows a rename with a new slug, checked against the other categories", async () => {
    await adminService.updateCategory("admin1", "cc1", { name: "Bóng đá 5 người" });
    assert.deepEqual(writes, [["update", "cc1", { name: "Bóng đá 5 người", slug: "bong-da-5-nguoi" }]]);
    assert.deepEqual(conflictChecks, [["Bóng đá 5 người", "bong-da-5-nguoi", "cc1"]]);
  });

  it("restores a hidden category through a status-only update", async () => {
    await adminService.updateCategory("admin1", "cc1", { status: "ACTIVE" });
    assert.deepEqual(writes, [["update", "cc1", { status: "ACTIVE", slug: undefined }]]);
  });

  it("answers 404 for an unknown category instead of a database error", async () => {
    current = null;
    await rejects(adminService.updateCategory("admin1", "nope", { name: "Tennis" }), 404, /Khong tim thay danh muc/);
    await rejects(adminService.deleteCategory("admin1", "nope"), 404, /Khong tim thay danh muc/);
    assert.deepEqual(writes, []);
  });
});
