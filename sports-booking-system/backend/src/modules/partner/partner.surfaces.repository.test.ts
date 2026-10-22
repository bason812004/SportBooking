import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let calls: string[];
let duplicate: boolean;
let counts: { bookings: number; booking_slots: number; bookingSeries: number; availabilityBlocks: number };
let savedCount: number | undefined;
let surfaceCount: number;
const tx = {
  $queryRaw: async () => { calls.push("lock"); return []; },
  courtSurface: {
    findMany: async () => Array.from({ length: surfaceCount }, (_, index) => ({ id: `s${index}`, code: `0${index + 1}`, sortOrder: index })),
    findFirst: async (args: any) => args.include ? { id: "s1", _count: counts } : duplicate ? { id: "s2" } : null,
    create: async ({ data }: any) => { calls.push("create"); return { id: "s1", ...data }; },
    update: async ({ data }: any) => { calls.push("update"); return { id: "s1", ...data }; },
    delete: async () => { calls.push("delete"); },
    count: async () => surfaceCount - (calls.includes("delete") ? 1 : 0),
    aggregate: async () => ({ _max: { sortOrder: 4 } })
  },
  court: { findUniqueOrThrow: async () => ({ courtCount: surfaceCount }), update: async ({ data }: any) => {
    assert.deepEqual(Object.keys(data), ["courtCount"], "must preserve court moderation status");
    savedCount = data.courtCount;
  } }
};
mock.module("../../config/db.js", { namedExports: { prisma: {
  $transaction: async (run: any) => run(tx),
  $queryRaw: async () => [],
  court: { findFirst: async () => ({ id: "c1", courtCount: 3, surfaces: [] }) }
} } });
const { partnerRepository } = await import("./partner.repository.js");

beforeEach(() => {
  calls = []; duplicate = false; savedCount = undefined; surfaceCount = 3;
  counts = { bookings: 0, booking_slots: 0, bookingSeries: 0, availabilityBlocks: 0 };
});

test("creating a surface synchronizes the count and appends display order without changing approval", async () => {
  const row = await partnerRepository.saveCourtSurface("c1", null, { code: "03", name: "Court 3" });
  assert.equal(row.courtId, "c1");
  assert.equal(row.sortOrder, 5);
  assert.equal(savedCount, 3);
  assert.deepEqual(calls, ["lock", "create"]);
});

for (const id of [null, "s1"]) {
  test(`duplicate code rejects ${id ? "rename" : "creation"} before mutation`, async () => {
    duplicate = true;
    await assert.rejects(partnerRepository.saveCourtSurface("c1", id, { code: "01", name: "Court" }), { statusCode: 409 });
    assert.deepEqual(calls, ["lock"]);
    assert.equal(savedCount, undefined);
  });
}

for (const relation of ["bookings", "booking_slots", "bookingSeries", "availabilityBlocks"] as const) {
  test(`deletion preserves existing ${relation}`, async () => {
    counts[relation] = 1;
    await assert.rejects(partnerRepository.deleteCourtSurface("c1", "s1"), { statusCode: 409 });
    assert.deepEqual(calls, ["lock", "lock"]);
    assert.equal(savedCount, undefined);
  });
}

test("deleting an unused surface synchronizes count to prevent legacy auto-fill", async () => {
  assert.deepEqual(await partnerRepository.deleteCourtSurface("c1", "s1"), { id: "s1" });
  assert.deepEqual(calls, ["lock", "lock", "delete"]);
  assert.equal(savedCount, 2);
});

test("last surface is retained to respect the venue minimum count", async () => {
  surfaceCount = 1;
  await assert.rejects(partnerRepository.deleteCourtSurface("c1", "s1"), { statusCode: 409 });
  assert.deepEqual(calls, ["lock", "lock"]);
});

test("a stale detail read cannot recreate a surface deleted since the initial query", async () => {
  surfaceCount = 2;
  const court = await partnerRepository.courtByPartner("c1", "p1");
  assert.equal(court?.surfaces.length, 2);
  assert.equal(court?.courtCount, 2);
  assert.deepEqual(calls, ["lock"]);
});
