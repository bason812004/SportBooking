import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let failure: "court" | "surface" | null;
let calls: string[];
let transactionActive = false;
let courtData: any;
const tx = {
  court: { create: async ({ data }: any) => {
    assert.equal(transactionActive, true);
    calls.push("court");
    if (failure === "court") throw new Error("court failed");
    courtData = data;
    return { id: "c-new", ...data };
  } },
  courtSurface: { create: async ({ data }: any) => {
    assert.equal(transactionActive, true);
    calls.push("surface");
    if (failure === "surface") throw new Error("surface failed");
    assert.equal(data.courtId, "c-new");
    return { id: "s-new", ...data };
  } }
};
mock.module("../../config/db.js", { namedExports: { prisma: {
  $transaction: async (run: any) => {
    calls.push("begin"); transactionActive = true;
    try {
      const result = await run(tx);
      calls.push("commit");
      return result;
    } catch (error) {
      calls.push("rollback");
      throw error;
    } finally { transactionActive = false; }
  }
} } });
const { partnerRepository } = await import("./partner.repository.js");
const input = {
  partnerId: "p1", categoryId: "cat1", name: "Venue", slug: "venue", address: "Address",
  city: "City", district: "District", openingTime: new Date("1970-01-01T06:00:00Z"),
  closingTime: new Date("1970-01-01T22:00:00Z"), approvalStatus: "PENDING" as const
};
beforeEach(() => { failure = null; calls = []; courtData = undefined; });

test("venue and default surface use the same transaction and response includes the surface", async () => {
  const result = await partnerRepository.createCourt(input, 30);
  assert.deepEqual(calls, ["begin", "court", "surface", "commit"]);
  assert.equal(courtData.courtCount, 1);
  assert.equal(courtData.deposit_percent, 30);
  assert.equal(courtData.approvalStatus, "PENDING");
  assert.equal(result.depositPercent, 30);
  assert.deepEqual(result.surfaces, [{ id: "s-new", courtId: "c-new", code: "S01", name: "Venue - Sân 01", sortOrder: 0, status: "ACTIVE" }]);
});

for (const value of [undefined, null, 0]) {
  test(`existing deposit normalization is preserved for ${value}`, async () => {
    const result = await partnerRepository.createCourt(input, value);
    assert.equal(courtData.deposit_percent, null);
    assert.equal(result.depositPercent, null);
  });
}

test("surface failure escapes the transaction callback so venue creation is rolled back", async () => {
  failure = "surface";
  await assert.rejects(partnerRepository.createCourt(input), /surface failed/);
  assert.deepEqual(calls, ["begin", "court", "surface", "rollback"]);
});

test("venue failure does not attempt to create a surface", async () => {
  failure = "court";
  await assert.rejects(partnerRepository.createCourt(input), /court failed/);
  assert.deepEqual(calls, ["begin", "court", "rollback"]);
});
