import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
const saved: any[] = [];
mock.module("./partner.repository.js", { namedExports: { partnerRepository: {
  profileByUser: async () => ({ id: "p1", user: { email: "p@x.vn" } }),
  createCourt: async (data: any) => { saved.push(data); return { id: "c1", ...data }; },
  courtByPartner: async () => ({ id: "c1" }),
  updateCourt: async (_id: string, data: any) => { saved.push(data); return { id: "c1", ...data }; }
} } });
const { partnerService } = await import("./partner.service.js");
const { courtWriteSchema } = await import("./partner.validation.js");

const court = {
  categoryId: "cat1", name: "Sân A", address: "12 Lê Lợi", ward: "Phường Bến Thành", city: "TP.HCM",
  openingTime: "06:00", closingTime: "22:00"
};

describe("court address after the 2025 reform (address + ward + city)", () => {
  it("needs a ward and no district", () => {
    assert.equal(courtWriteSchema.safeParse({ body: court }).success, true);
    const { ward: _ward, ...withoutWard } = court;
    assert.equal(courtWriteSchema.safeParse({ body: withoutWard }).success, false);
  });

  it("registers a court without a district", async () => {
    saved.length = 0;
    await partnerService.createCourt("user1", court);
    assert.equal(saved[0].district, null);
    assert.equal(saved[0].ward, "Phường Bến Thành");
  });

  it("re-entering the address drops the old district; other edits leave it alone", async () => {
    saved.length = 0;
    await partnerService.updateCourt("user1", "c1", { address: "12 Lê Lợi", ward: "Phường Bến Thành", city: "TP.HCM" });
    await partnerService.updateCourt("user1", "c1", { name: "Sân A mới" });
    assert.equal(saved[0].district, null);
    assert.equal("district" in saved[1], false);
  });
});
