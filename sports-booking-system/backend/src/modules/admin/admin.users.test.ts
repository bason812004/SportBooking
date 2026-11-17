import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let target: { id: string; role: string; status: string; email: string } | null;
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  userById: async () => target,
  activeAdminCount: async () => 2,
  setUserStatus: async (id: string, status: string) => { calls.push(["setStatus", id, status]); return { id, status }; }
} } });
mock.module("../auth/accountStatus.js", { namedExports: {
  forgetAccountStatus: (id: string) => calls.push(["forget", id]),
  isAccountActive: async () => true
} });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (...args: unknown[]) => { calls.push(["audit", args[1], args[4]]); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async () => ({}) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {
  toPublic: () => {},
  toAdmin: () => {},
  toPartner: () => {},
  toUser: () => {},
  disconnectUser: (id: string) => calls.push(["disconnect", id])
} } });
const { adminService } = await import("./admin.service.js");

beforeEach(() => {
  target = { id: "u2", role: "PARTNER", status: "ACTIVE", email: "partner@example.com" };
  calls = [];
});

describe("admin locks and unlocks accounts", () => {
  it("a lock takes effect at once: status cache cleared, sockets dropped, reason audited", async () => {
    await adminService.lockUser("admin1", "u2", "Gian lận giá sân");
    // The lock and its audit entry commit together; the cache and sockets follow once it is committed, so a request
    // in between cannot cache the old status again.
    assert.deepEqual(calls, [
      ["setStatus", "u2", "LOCKED"],
      ["audit", "USER_LOCKED", { email: "partner@example.com", reason: "Gian lận giá sân" }],
      ["forget", "u2"],
      ["disconnect", "u2"]
    ]);
  });

  it("an unlock clears the cached status so the account works again at once", async () => {
    target = { ...target!, status: "LOCKED" };
    await adminService.unlockUser("admin1", "u2");
    assert.deepEqual(calls, [["setStatus", "u2", "ACTIVE"], ["audit", "USER_UNLOCKED", undefined], ["forget", "u2"]]);
  });

  it("answers 404 for an unknown account instead of a database error", async () => {
    target = null;
    await assert.rejects(adminService.unlockUser("admin1", "nope"), (error: any) => error.statusCode === 404);
    assert.deepEqual(calls, []);
  });
});
