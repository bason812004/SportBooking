import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPROVAL_REVOKE_HOURS, approvalRevocableUntil, courtReviewChecks, type CourtReviewInput } from "./admin.courtReview.js";

const now = new Date("2026-10-22T10:00:00Z");
const trusted: CourtReviewInput = {
  courtStatus: "PENDING",
  partnerStatus: "APPROVED",
  publishedImages: 0,
  pendingImages: 0,
  duplicateAddressCourts: 0,
  partnerRejectedCourts: 0,
  accountCreatedAt: new Date("2026-09-01T00:00:00Z"),
  emailVerified: true,
  phone: "0901234567",
  taxCode: "0312345678",
  verificationDocumentUrl: "https://example.com/gpkd.pdf",
  bankAccountHolder: "NGUYEN VAN A",
  now
};
const check = (input: CourtReviewInput, key: string) => courtReviewChecks(input).checks.find((item) => item.key === key);

describe("court review checks", () => {
  it("only an approved partner with a pending court can be approved", () => {
    assert.deepEqual(courtReviewChecks(trusted).blockers, []);
    assert.equal(courtReviewChecks(trusted).canApprove, true);
    for (const partnerStatus of ["PENDING", "REJECTED"]) {
      const review = courtReviewChecks({ ...trusted, partnerStatus });
      assert.equal(review.canApprove, false);
      assert.equal(review.blockers.length, 1);
      assert.equal(check({ ...trusted, partnerStatus }, "partner_approved")?.status, "missing");
    }
    assert.match(courtReviewChecks({ ...trusted, partnerStatus: "REJECTED" }).blockers[0], /bị từ chối/);
    assert.deepEqual(courtReviewChecks({ ...trusted, courtStatus: "APPROVED" }).blockers, ["Sân không còn ở trạng thái chờ duyệt"]);
  });

  it("warnings never block approval", () => {
    const review = courtReviewChecks({ ...trusted, duplicateAddressCourts: 2, partnerRejectedCourts: 1, accountCreatedAt: now, emailVerified: false, phone: " ", taxCode: null });
    assert.equal(review.canApprove, true);
    assert.equal(check({ ...trusted, duplicateAddressCourts: 2 }, "duplicate_address")?.label, "Địa chỉ trùng với 2 sân của đối tác khác");
    assert.equal(check({ ...trusted, partnerRejectedCourts: 1 }, "rejected_history")?.status, "warning");
    assert.equal(check({ ...trusted, phone: " " }, "phone")?.status, "missing");
  });

  it("flags a venue without photos and counts pending photos, which are approved with the court", () => {
    assert.equal(check(trusted, "images")?.label, "Sân chưa có ảnh nào");
    const withPhotos = { ...trusted, publishedImages: 1, pendingImages: 2 };
    assert.deepEqual(check(withPhotos, "images"), { key: "images", status: "ok", label: "Có 3 ảnh sân" });
    assert.equal(check(withPhotos, "pending_images"), undefined);
  });

  it("treats accounts younger than a week as new", () => {
    assert.equal(check({ ...trusted, accountCreatedAt: new Date("2026-10-22T01:00:00Z") }, "account_age")?.label, "Tài khoản mới tạo hôm nay");
    assert.equal(check({ ...trusted, accountCreatedAt: new Date("2026-10-17T09:00:00Z") }, "account_age")?.status, "warning");
    assert.equal(check({ ...trusted, accountCreatedAt: new Date("2026-10-15T09:00:00Z") }, "account_age")?.status, "ok");
  });
});

describe("revoking a court approval", () => {
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const approved = (hours: number) => ({ action: "APPROVED", createdAt: hoursAgo(hours) });

  it("is open until APPROVAL_REVOKE_HOURS after the approval", () => {
    assert.equal(APPROVAL_REVOKE_HOURS, 24);
    assert.deepEqual(approvalRevocableUntil("APPROVED", approved(1), now), new Date("2026-10-23T09:00:00Z"));
    // Dates read back from the database as strings work the same.
    assert.deepEqual(approvalRevocableUntil("APPROVED", { action: "APPROVED", createdAt: hoursAgo(23).toISOString() }, now), new Date("2026-10-22T11:00:00Z"));
    assert.equal(approvalRevocableUntil("APPROVED", approved(24), now), null);
    assert.equal(approvalRevocableUntil("APPROVED", approved(30), now), null);
  });

  it("needs an approved court whose latest decision is that approval", () => {
    // Sent back to PENDING since (partner edit or an earlier revocation), or rejected.
    assert.equal(approvalRevocableUntil("PENDING", approved(1), now), null);
    assert.equal(approvalRevocableUntil("REJECTED", approved(1), now), null);
    assert.equal(approvalRevocableUntil("APPROVED", { action: "APPROVAL_REVOKED", createdAt: hoursAgo(1) }, now), null);
    // Approved before decisions were recorded (sample data): no approval time, so no revocation.
    assert.equal(approvalRevocableUntil("APPROVED", null, now), null);
    assert.equal(approvalRevocableUntil("APPROVED", undefined, now), null);
  });
});
