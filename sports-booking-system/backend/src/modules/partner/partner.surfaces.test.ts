import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { courtSurfaceCreateSchema, courtSurfaceUpdateSchema } from "./partner.validation.js";

let owned = true;
let saved: any;
let emitted = 0;
const court = { id: "c1", openingTime: new Date("1970-01-01T06:00:00Z"), closingTime: new Date("1970-01-01T22:00:00Z") };
mock.module("../../config/db.js", { namedExports: { prisma: {} } });
for (const [path, name] of [
  ["../commission/commission.service.js", "commissionService"],
  ["../settlements/settlement.service.js", "settlementService"],
  ["../vouchers/voucher.service.js", "voucherService"],
  ["../users/user.repository.js", "userRepository"],
  ["../cashier/cashier.repository.js", "cashierRepository"],
  ["../../shared/services/cloudinary.service.js", "cloudinaryService"],
  ["../court-images/courtImage.service.js", "courtImageService"]
]) mock.module(path, { namedExports: { [name]: {} } });
mock.module("../auth/auth.security.js", { namedExports: { hashPassword: async () => "unused" } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toCourt: () => { emitted++; } } } });
mock.module("./partner.repository.js", { namedExports: { partnerRepository: {
  profileByUser: async () => ({ id: "p1" }),
  courtByPartner: async (courtId: string, partnerId: string) => {
    assert.equal(courtId, "c1"); assert.equal(partnerId, "p1"); return owned ? court : null;
  },
  courtSurfaceByPartner: async (surfaceId: string, courtId: string, partnerId: string) => {
    assert.equal(surfaceId, "s1"); assert.equal(courtId, "c1"); assert.equal(partnerId, "p1");
    return owned ? { id: "s1", code: "01", name: "Court 1", openingTime: null, closingTime: null } : null;
  },
  saveCourtSurface: async (_courtId: string, _id: string | null, data: any) => { saved = data; return data; },
  deleteCourtSurface: async () => { saved = "deleted"; return { id: "s1" }; },
  updateCourtSurfaceStatus: async (_id: string, status: string) => { saved = status; return { status }; }
} } });
const { partnerService } = await import("./partner.service.js");
beforeEach(() => { owned = true; saved = undefined; emitted = 0; });

test("validation rejects blank or oversized names, invalid times and injected ownership", () => {
  const parse = (body: unknown) => courtSurfaceCreateSchema.safeParse({ params: { id: "c1" }, body }).success;
  assert.equal(parse({ code: "  ", name: "Court" }), false);
  assert.equal(parse({ code: "01", name: "x".repeat(161) }), false);
  assert.equal(parse({ code: "01", name: "Court", openingTime: "25:00" }), false);
  assert.equal(parse({ code: "01", name: "Court", courtId: "other" }), false);
  assert.equal(courtSurfaceUpdateSchema.safeParse({ params: { id: "c1", surfaceId: "s1" }, body: {} }).success, false);
});

test("new surface inherits venue hours and emits availability invalidation", async () => {
  await partnerService.createCourtSurface("u1", "c1", { code: "02", name: "Court 2" });
  assert.equal(saved.openingTime, null); assert.equal(saved.closingTime, null); assert.equal(emitted, 1);
});

for (const operation of [
  () => partnerService.createCourtSurface("u1", "c1", { code: "02", name: "Court 2" }),
  () => partnerService.updateCourtSurface("u1", "c1", "s1", { name: "New name" }),
  () => partnerService.deleteCourtSurface("u1", "c1", "s1"),
  () => partnerService.updateCourtSurfaceStatus("u1", "c1", "s1", "INACTIVE")
]) {
  test(`ownership is enforced for surface operation ${operation.toString()}`, async () => {
    owned = false;
    await assert.rejects(operation(), { statusCode: 404 });
    assert.equal(saved, undefined); assert.equal(emitted, 0);
  });
}

test("partial hours are validated against inherited venue hours", async () => {
  await assert.rejects(partnerService.createCourtSurface("u1", "c1", { code: "02", name: "Court", closingTime: "05:00" }), { statusCode: 400 });
  await assert.rejects(partnerService.updateCourtSurface("u1", "c1", "s1", { openingTime: "23:00" }), { statusCode: 400 });
  assert.equal(saved, undefined);
});

test("editing metadata preserves name/code and can clear custom times", async () => {
  await partnerService.updateCourtSurface("u1", "c1", "s1", { size: "20 x 10 m", openingTime: null, closingTime: null });
  assert.equal(saved.code, "01"); assert.equal(saved.name, "Court 1"); assert.equal(saved.size, "20 x 10 m");
  assert.equal(saved.openingTime, null); assert.equal(saved.closingTime, null); assert.equal(emitted, 1);
});
