import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let failure: "court" | "surface" | null;
let failOnCourt: number;
let calls: string[];
let transactionActive = false;
let courtData: any[];
let surfaceData: any[];
const tx = {
  court: { create: async ({ data }: any) => {
    assert.equal(transactionActive, true);
    calls.push("court");
    courtData.push(data);
    if (failure === "court" && courtData.length === failOnCourt) throw new Error("court failed");
    return { id: `c-new${courtData.length}`, ...data };
  } },
  courtSurface: { createManyAndReturn: async ({ data }: any) => {
    assert.equal(transactionActive, true);
    calls.push("surfaces");
    if (failure === "surface") throw new Error("surface failed");
    surfaceData.push(data);
    // Prisma does not guarantee the order of returned rows; the repository sorts them.
    return data.map((row: any, index: number) => ({ id: `s-${row.courtId}-${index}`, ...row })).reverse();
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
beforeEach(() => { failure = null; failOnCourt = 1; calls = []; courtData = []; surfaceData = []; });

test("venue and default surface use the same transaction and response includes the surface", async () => {
  const result = await partnerRepository.createCourt(input, 30);
  assert.deepEqual(calls, ["begin", "court", "surfaces", "commit"]);
  assert.equal(courtData[0].courtCount, 1);
  assert.equal(courtData[0].deposit_percent, 30);
  assert.equal(courtData[0].approvalStatus, "PENDING");
  assert.equal(result.depositPercent, 30);
  assert.deepEqual(result.surfaces, [
    { id: "s-c-new1-0", courtId: "c-new1", code: "S01", name: "Venue - Sân 01", surface: null, size: null, sortOrder: 0, status: "ACTIVE" }
  ]);
});

for (const value of [undefined, null, 0]) {
  test(`existing deposit normalization is preserved for ${value}`, async () => {
    const result = await partnerRepository.createCourt(input, value);
    assert.equal(courtData[0].deposit_percent, null);
    assert.equal(result.depositPercent, null);
  });
}

test("surface failure escapes the transaction callback so venue creation is rolled back", async () => {
  failure = "surface";
  await assert.rejects(partnerRepository.createCourt(input), /surface failed/);
  assert.deepEqual(calls, ["begin", "court", "surfaces", "rollback"]);
});

test("venue failure does not attempt to create a surface", async () => {
  failure = "court";
  await assert.rejects(partnerRepository.createCourt(input), /court failed/);
  assert.deepEqual(calls, ["begin", "court", "rollback"]);
});

const registration = [
  { data: { ...input, name: "Venue - Pickleball", slug: "venue-pickleball" }, surfaces: [
    { name: "Sân VIP", surface: "Acrylic", size: null }, { name: "Sân 2" }, { name: "Sân 3" }
  ] },
  { data: { ...input, categoryId: "cat2", name: "Venue - Cầu lông", slug: "venue-cau-long" }, surfaces: [{ name: "Sân 1" }, { name: "Sân 2" }] }
];

test("registration creates every court with its declared sub-courts in one transaction", async () => {
  const courts = await partnerRepository.createCourts(registration, 20);
  assert.deepEqual(calls, ["begin", "court", "surfaces", "court", "surfaces", "commit"]);
  assert.deepEqual(courtData.map((data) => [data.categoryId, data.courtCount, data.deposit_percent]), [["cat1", 3, 20], ["cat2", 2, 20]]);
  assert.deepEqual(courts.map((court) => court.depositPercent), [20, 20]);
  assert.deepEqual(courts[0].surfaces.map((s) => [s.code, s.name, s.surface, s.size, s.sortOrder, s.status]), [
    ["S01", "Sân VIP", "Acrylic", null, 0, "ACTIVE"],
    ["S02", "Sân 2", null, null, 1, "ACTIVE"],
    ["S03", "Sân 3", null, null, 2, "ACTIVE"]
  ]);
  assert.deepEqual(courts[1].surfaces.map((s) => [s.courtId, s.code]), [["c-new2", "S01"], ["c-new2", "S02"]]);
  // One insert per court keeps a 30-sub-court venue well inside the interactive transaction timeout.
  assert.equal(surfaceData.length, 2);
});

test("registration rolls back every court when a later one fails", async () => {
  failure = "court";
  failOnCourt = 2;
  await assert.rejects(partnerRepository.createCourts(registration, 20), /court failed/);
  assert.deepEqual(calls, ["begin", "court", "surfaces", "court", "rollback"]);
});
