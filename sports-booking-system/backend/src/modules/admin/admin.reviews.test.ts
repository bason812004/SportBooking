import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let review: any;
let moved: boolean;
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  reviewForModeration: async () => review,
  setReviewDisplay: async (id: string, status: string, from: string) => { calls.push(["display", id, status, from]); return moved; },
  deleteReview: async (id: string) => { calls.push(["delete", id]); return true; },
  addModerationHistory: async (entry: any) => { calls.push(["history", entry.action, entry.reason]); return {}; }
} } });
mock.module("../reviews/review.repository.js", { namedExports: { reviewRepository: {
  deleteReply: async (id: string) => { calls.push(["unreply", id]); return true; }
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (_actor: string, action: string, _type: string, _id: string, metadata: any) => { calls.push(["audit", action, metadata]); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { calls.push(["notify", notice.userId, notice.type, notice.content]); return {}; }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

beforeEach(() => {
  review = {
    id: "rv1", userId: "u1", courtId: "c1", rating: 1, comment: "Tệ", displayStatus: "VISIBLE",
    reply: null, court: { name: "Sân A", partner: { userId: "pu1" } }
  };
  moved = true;
  calls = [];
});

describe("admin review moderation", () => {
  it("hides a review with a reason kept in the history and sent to its author", async () => {
    await adminService.setReviewDisplay("admin1", "rv1", "HIDDEN", "Ngôn từ xúc phạm.");
    assert.deepEqual(calls, [
      ["display", "rv1", "HIDDEN", "VISIBLE"],
      ["history", "HIDDEN", "Ngôn từ xúc phạm."],
      ["audit", "REVIEW_HIDDEN", { reason: "Ngôn từ xúc phạm." }],
      ["notify", "u1", "REVIEW_HIDDEN", "Đánh giá của bạn về sân Sân A đã bị ẩn khỏi trang sân. Lý do: Ngôn từ xúc phạm."]
    ]);
  });

  it("refuses to hide twice and says to reload when the review changed meanwhile", async () => {
    review = { ...review, displayStatus: "HIDDEN" };
    await assert.rejects(adminService.setReviewDisplay("admin1", "rv1", "HIDDEN", "Lý do"), (error: any) => error.statusCode === 400);
    review = { ...review, displayStatus: "VISIBLE" };
    moved = false;
    await assert.rejects(adminService.setReviewDisplay("admin1", "rv1", "HIDDEN", "Lý do"), (error: any) => error.statusCode === 409);
    assert.equal(calls.some((call) => call[0] === "notify"), false);
  });

  it("keeps a deleted review's content in the audit log", async () => {
    await adminService.deleteReview("admin1", "rv1", "Spam");
    const audit = calls.find((call) => call[0] === "audit")!;
    assert.deepEqual(audit, ["audit", "REVIEW_DELETED", { reason: "Spam", userId: "u1", courtId: "c1", rating: 1, comment: "Tệ" }]);
    assert.equal(calls.at(-1)![2], "REVIEW_DELETED");
  });

  it("takes down a court owner's reply with a reason, keeping it in the audit log and telling the partner", async () => {
    await assert.rejects(adminService.removeReviewReply("admin1", "rv1", "Xúc phạm khách"), (error: any) => error.statusCode === 400);
    review = { ...review, reply: { content: "Khách nói sai", authorId: "pu1" } };
    await adminService.removeReviewReply("admin1", "rv1", "Xúc phạm khách.");
    assert.deepEqual(calls, [
      ["unreply", "rv1"],
      ["history", "REPLY_REMOVED", "Xúc phạm khách."],
      ["audit", "REVIEW_REPLY_REMOVED", { reason: "Xúc phạm khách.", reply: "Khách nói sai", repliedBy: "pu1" }],
      ["notify", "pu1", "REVIEW_REPLY_REMOVED", "Quản trị viên đã gỡ phản hồi của bạn cho một đánh giá về sân Sân A. Lý do: Xúc phạm khách."]
    ]);
  });

  it("answers 404 for a review that does not exist instead of a database error", async () => {
    review = null;
    await assert.rejects(adminService.setReviewDisplay("admin1", "nope", "HIDDEN", "Lý do"), (error: any) => error.statusCode === 404);
    await assert.rejects(adminService.deleteReview("admin1", "nope", "Lý do"), (error: any) => error.statusCode === 404);
  });
});
