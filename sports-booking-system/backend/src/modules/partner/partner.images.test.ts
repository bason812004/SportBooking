import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let approvalStatus = "APPROVED";
let ownsImage = true;
let calls: string[] = [];

mock.module("../../config/db.js", { namedExports: { prisma: {} } });
for (const [path, name] of [
  ["../commission/commission.service.js", "commissionService"],
  ["../realtime/realtime.service.js", "realtimeService"],
  ["../settlements/settlement.service.js", "settlementService"],
  ["../vouchers/voucher.service.js", "voucherService"],
  ["../users/user.repository.js", "userRepository"],
  ["../cashier/cashier.repository.js", "cashierRepository"]
]) {
  mock.module(path, { namedExports: { [name]: {} } });
}
mock.module("../auth/auth.security.js", { namedExports: { hashPassword: async () => "unused" } });
mock.module("../../shared/services/cloudinary.service.js", {
  namedExports: { cloudinaryService: { deleteImage: async (id: string) => { calls.push(`cloud:${id}`); } } }
});
mock.module("./partner.repository.js", {
  namedExports: {
    partnerRepository: {
      profileByUser: async () => ({ id: "partner1" }),
      imageByPartner: async (imageId: string, partnerId: string) => {
        assert.equal(imageId, "image1");
        assert.equal(partnerId, "partner1");
        return ownsImage ? { id: "image1", courtId: "court1", publicId: "court/photo" } : null;
      },
      deleteImage: async (id: string) => { calls.push(`db:${id}`); return { publicId: "court/photo" }; },
      updateCourt: async (_id: string, data: { approvalStatus: string }) => {
        approvalStatus = data.approvalStatus;
        calls.push("updateCourt");
      }
    }
  }
});
const { partnerService } = await import("./partner.service.js");

beforeEach(() => {
  ownsImage = true;
  calls = [];
});

for (const status of ["APPROVED", "PENDING", "REJECTED"]) {
  test(`deleting an owned image preserves ${status} court approval`, async () => {
    approvalStatus = status;
    assert.deepEqual(await partnerService.deleteImage("user1", "image1"), { id: "image1" });
    assert.equal(approvalStatus, status);
    assert.deepEqual(calls, ["db:image1", "cloud:court/photo"]);
  });
}

test("another partner's image cannot be deleted or change court approval", async () => {
  ownsImage = false;
  await assert.rejects(partnerService.deleteImage("user1", "image1"), { statusCode: 404 });
  assert.deepEqual(calls, []);
});
