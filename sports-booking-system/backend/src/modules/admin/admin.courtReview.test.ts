import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { courtReviewChecks, type CourtReviewInput } from "./admin.courtReview.js";

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

  it("flags a venue without photos and photos still waiting for review", () => {
    assert.equal(check(trusted, "images")?.label, "Sân chưa có ảnh nào");
    assert.equal(check(trusted, "pending_images"), undefined);
    const withPhotos = { ...trusted, publishedImages: 1, pendingImages: 2 };
    assert.deepEqual(check(withPhotos, "images"), { key: "images", status: "ok", label: "Có 3 ảnh sân" });
    assert.deepEqual(check(withPhotos, "pending_images"), { key: "pending_images", status: "warning", label: "Còn 2 ảnh chưa xét duyệt" });
  });

  it("treats accounts younger than a week as new", () => {
    assert.equal(check({ ...trusted, accountCreatedAt: new Date("2026-10-22T01:00:00Z") }, "account_age")?.label, "Tài khoản mới tạo hôm nay");
    assert.equal(check({ ...trusted, accountCreatedAt: new Date("2026-10-17T09:00:00Z") }, "account_age")?.status, "warning");
    assert.equal(check({ ...trusted, accountCreatedAt: new Date("2026-10-15T09:00:00Z") }, "account_age")?.status, "ok");
  });
});
