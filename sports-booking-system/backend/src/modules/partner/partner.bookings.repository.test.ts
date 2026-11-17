import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { BookingStatus } from "@prisma/client";

mock.module("../../config/db.js", { namedExports: { prisma: {} } });
const { partnerRepository } = await import("./partner.repository.js");

test("serving filter keeps open bookings that started before now, combined with the other filters", () => {
  const date = new Date("2026-10-24T00:00:00.000Z");
  const time = new Date("1970-01-01T19:30:00.000Z");
  const where = partnerRepository.bookingWhere("p1", {
    status: BookingStatus.CONFIRMED,
    statuses: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
    startedBy: { date, time },
    search: "BK"
  });

  assert.equal(where.bookingStatus, BookingStatus.CONFIRMED);
  assert.equal((where.OR as unknown[]).length, 3, "search OR must not be replaced by the started-by OR");
  assert.deepEqual(where.AND, [
    { bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] } },
    { OR: [{ bookingDate: { lt: date } }, { bookingDate: date, startTime: { lte: time } }] }
  ]);
});

test("without the serving filter no AND clause is added", () => {
  const where = partnerRepository.bookingWhere("p1", { courtId: "c1" });
  assert.equal(where.AND, undefined);
  assert.equal(where.courtId, "c1");
});
