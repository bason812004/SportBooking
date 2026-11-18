import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import { rankCourts, rankPartners, reviewTrend, summarizeRatings } from "./review.calculations.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let reviewable: any;
let completedCount: number;
let existing: any;
let createFailure: unknown;
let calls: unknown[][];
mock.module("./review.repository.js", { namedExports: { reviewRepository: {
  reviewableBooking: async (userId: string, courtId: string, bookingId?: string | null) => {
    calls.push(["reviewable", userId, courtId, bookingId ?? null]);
    return reviewable;
  },
  completedBookingCount: async () => completedCount,
  create: async (data: any) => {
    if (createFailure) throw createFailure;
    calls.push(["create", data.bookingId]);
    return [{ id: "rv9" }];
  },
  findById: async () => (existing ? [existing] : []),
  update: async (id: string) => { calls.push(["update", id]); return [{ id }]; },
  delete: async (id: string) => { calls.push(["delete", id]); return true; }
} } });
mock.module("../courts/court.repository.js", { namedExports: { courtRepository: { findPublicById: async () => ({ id: "c1", name: "Sân A" }) } } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { notifyCourtStaff: async () => {} } } });
const { reviewService } = await import("./review.service.js");

beforeEach(() => {
  fake.setModels({ user: { findUnique: async () => ({ fullName: "Khách" }) } });
  reviewable = { id: "bk1", bookingCode: "BK1", bookingDate: new Date() };
  completedCount = 1;
  existing = { id: "rv1", user: { id: "u1" } };
  createFailure = null;
  calls = [];
});

describe("who may review a court", () => {
  it("attaches the review to the customer's completed, not yet reviewed booking at that court", async () => {
    await reviewService.create("u1", { courtId: "c1", rating: 5 });
    assert.deepEqual(calls, [["reviewable", "u1", "c1", null], ["create", "bk1"]]);
  });

  it("refuses a customer who never completed a booking there, and says so when every booking is reviewed", async () => {
    reviewable = null;
    completedCount = 0;
    await assert.rejects(reviewService.create("u1", { courtId: "c1", rating: 5 }), /hoàn thành một lượt đặt sân/);
    completedCount = 2;
    await assert.rejects(reviewService.create("u1", { courtId: "c1", rating: 5 }), /đã đánh giá tất cả/);
    assert.equal(calls.some((call) => call[0] === "create"), false);
  });

  it("refuses a booking that is not the customer's completed booking at that court", async () => {
    reviewable = null;
    await assert.rejects(reviewService.create("u1", { courtId: "c1", bookingId: "bk-other", rating: 4 }), /mỗi đơn một lần/);
    assert.deepEqual(calls, [["reviewable", "u1", "c1", "bk-other"]]);
  });

  it("answers a booking reviewed twice at once with a clear conflict", async () => {
    createFailure = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "P2010", meta: { code: "23505" } });
    await assert.rejects(reviewService.create("u1", { courtId: "c1", rating: 5 }), (error: any) => error.statusCode === 409 && error.code === "REVIEW_EXISTS");
  });

  it("tells staff and partners on the court page that only customers who played there review", async () => {
    assert.equal((await reviewService.eligibility("p1", "PARTNER", "c1")).canReview, false);
    assert.equal((await reviewService.eligibility("u1", "USER", "c1")).canReview, true);
  });
});

describe("editing and deleting a review", () => {
  it("lets only the author edit or delete it, not even an admin from the court page", async () => {
    await assert.rejects(reviewService.update("rv1", "admin1", { rating: 1 }), (error: any) => error.statusCode === 403);
    await assert.rejects(reviewService.delete("rv1", "admin1"), (error: any) => error.statusCode === 403);
    await reviewService.update("rv1", "u1", { rating: 4 });
    assert.deepEqual(calls, [["update", "rv1"]]);
  });
});

describe("rating summary", () => {
  it("averages visible reviews only and counts hidden ones apart", () => {
    const summary = summarizeRatings([
      { rating: 5, displayStatus: "VISIBLE", _count: { _all: 3 } },
      { rating: 2, displayStatus: "VISIBLE", _count: { _all: 1 } },
      { rating: 1, displayStatus: "HIDDEN", _count: { _all: 4 } }
    ]);
    assert.equal(summary.total, 4);
    assert.equal(summary.averageRating, 4.3);
    assert.equal(summary.hiddenCount, 4);
    assert.deepEqual(summary.distribution.map((row) => row.count), [3, 0, 0, 1, 0]);
  });
});

describe("review statistics", () => {
  const court = (id: string, partnerId: string, visibleCount: number, ratingSum: number, extra: Partial<{ hiddenCount: number; repliedCount: number; lowCount: number }> = {}) => ({
    id,
    name: `San ${id}`,
    partnerId,
    partnerName: `Doi tac ${partnerId}`,
    visibleCount,
    ratingSum,
    hiddenCount: 0,
    repliedCount: 0,
    lowCount: 0,
    ...extra
  });

  it("fills months without reviews and goes day by day over a short span", () => {
    const days = [
      { day: "2026-05-20", count: 2, ratingSum: 9 },
      { day: "2026-05-28", count: 1, ratingSum: 5 },
      { day: "2026-07-03", count: 1, ratingSum: 4 }
    ];
    const months = reviewTrend(days, undefined, "2026-08-15");
    assert.equal(months.unit, "month");
    assert.deepEqual(months.points, [
      { period: "2026-05", count: 3, averageRating: 4.7 },
      { period: "2026-06", count: 0, averageRating: null },
      { period: "2026-07", count: 1, averageRating: 4 },
      { period: "2026-08", count: 0, averageRating: null }
    ]);

    const daily = reviewTrend([{ day: "2026-10-22", count: 1, ratingSum: 5 }], "2026-10-04", "2026-11-02");
    assert.equal(daily.unit, "day");
    assert.equal(daily.points.length, 30);
    assert.deepEqual(daily.points[0], { period: "2026-10-04", count: 0, averageRating: null });
    assert.deepEqual(daily.points.find((point) => point.count), { period: "2026-10-22", count: 1, averageRating: 5 });
    assert.equal(daily.points.at(-1)?.period, "2026-11-02");
  });

  it("ranks courts lowest average first, more reviews first on a tie, and leaves out courts with only hidden reviews", () => {
    const ranked = rankCourts([court("a", "p1", 2, 10), court("b", "p1", 1, 4), court("c", "p2", 3, 12), court("d", "p2", 0, 0, { hiddenCount: 2 })]);
    assert.deepEqual(ranked.map((row) => [row.id, row.averageRating, row.count]), [["c", 4, 3], ["b", 4, 1], ["a", 5, 2]]);
  });

  it("weighs every review alike in a partner's average", () => {
    const partners = rankPartners([court("a", "p1", 1, 1, { lowCount: 1 }), court("b", "p1", 9, 45, { repliedCount: 3 }), court("c", "p2", 0, 0, { hiddenCount: 1 })]);
    // (1 + 45) / 10 reviews = 4.6, not the 3.0 an average of the two courts' averages would give.
    assert.deepEqual(partners, [{ id: "p1", name: "Doi tac p1", courtCount: 2, count: 10, hiddenCount: 0, repliedCount: 3, lowCount: 1, averageRating: 4.6 }]);
  });
});
