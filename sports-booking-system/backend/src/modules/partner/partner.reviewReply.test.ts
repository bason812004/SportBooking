import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

let review: any;
let calls: unknown[][];

mock.module("../../config/db.js", { namedExports: { prisma: {} } });
for (const [path, name] of [
  ["../commission/commission.service.js", "commissionService"],
  ["../realtime/realtime.service.js", "realtimeService"],
  ["../settlements/settlement.service.js", "settlementService"],
  ["../booking-overdue/bookingOverdue.service.js", "bookingOverdueService"],
  ["../vouchers/voucher.service.js", "voucherService"],
  ["../users/user.repository.js", "userRepository"],
  ["../cashier/cashier.repository.js", "cashierRepository"]
]) {
  mock.module(path, { namedExports: { [name]: {} } });
}
mock.module("../auth/auth.security.js", { namedExports: { hashPassword: async () => "unused", comparePassword: async () => false } });
mock.module("../auth/auth.repository.js", { namedExports: { authRepository: {} } });
mock.module("../auth/auth.service.js", { namedExports: { authService: {} } });
mock.module("../email/email.service.js", { namedExports: { emailService: {} } });
mock.module("./partner.repository.js", {
  namedExports: { partnerRepository: { profileByUser: async () => ({ id: "partner1", businessName: "Sala Sport" }) } }
});
let removals = new Map<string, { reason: string | null; removedAt: Date }>();
mock.module("../reviews/review.repository.js", { namedExports: { replyRemovals: async () => removals, reviewRepository: {
  forPartner: async (id: string, partnerId: string) => { calls.push(["find", id, partnerId]); return review; },
  saveReply: async (id: string, content: string, by: string) => { calls.push(["reply", id, content, by]); return {}; },
  deleteReply: async (id: string) => { calls.push(["unreply", id]); return true; }
} } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { calls.push(["notify", notice.userId, notice.type]); return {}; }
} } });
const { partnerService } = await import("./partner.service.js");

beforeEach(() => {
  review = { id: "rv1", userId: "u1", courtId: "c1", displayStatus: "VISIBLE", reply: null, court: { name: "Sân A" } };
  calls = [];
  removals = new Map();
});

describe("partner replies to reviews", () => {
  it("saves a reply on a review of the partner's own court and tells the customer the first time", async () => {
    await partnerService.replyReview("pu1", "rv1", "  Cảm ơn bạn!  ");
    assert.deepEqual(calls, [["find", "rv1", "partner1"], ["reply", "rv1", "Cảm ơn bạn!", "pu1"], ["notify", "u1", "REVIEW_REPLIED"]]);
    review = { ...review, reply: { content: "Cảm ơn bạn!" } };
    calls = [];
    await partnerService.replyReview("pu1", "rv1", "Cảm ơn, hẹn gặp lại!");
    assert.equal(calls.some((call) => call[0] === "notify"), false, "rewriting a reply does not notify again");
  });

  it("refuses reviews of other partners' courts and reviews an admin hid", async () => {
    review = null;
    await assert.rejects(partnerService.replyReview("pu1", "rv9", "Xin chào"), (error: any) => error.statusCode === 404);
    review = { id: "rv1", userId: "u1", courtId: "c1", displayStatus: "HIDDEN", reply: null, court: { name: "Sân A" } };
    await assert.rejects(partnerService.replyReview("pu1", "rv1", "Xin chào"), (error: any) => error.statusCode === 400);
    assert.equal(calls.some((call) => call[0] === "reply"), false);
  });

  it("refuses to post again on a review whose reply an admin took down, saying why", async () => {
    removals = new Map([["rv1", { reason: "Ngôn từ xúc phạm.", removedAt: new Date() }]]);
    await assert.rejects(
      partnerService.replyReview("pu1", "rv1", "Xin lỗi bạn"),
      (error: any) => error.statusCode === 400 && /đã gỡ/.test(error.message) && /Ngôn từ xúc phạm\)/.test(error.message)
    );
    assert.equal(calls.some((call) => call[0] === "reply" || call[0] === "notify"), false);
  });

  it("removes the partner's own reply, and says so when there is none", async () => {
    await assert.rejects(partnerService.deleteReviewReply("pu1", "rv1"), (error: any) => error.statusCode === 404);
    review = { ...review, reply: { content: "Cảm ơn" } };
    await partnerService.deleteReviewReply("pu1", "rv1");
    assert.deepEqual(calls.at(-1), ["unreply", "rv1"]);
  });
});
