import assert from "node:assert/strict";
import { it } from "node:test";
import { bookingStartsAt, timeToDate, toDbDate } from "./time.js";

it("bookingStartsAt reads the DATE and TIME columns as Vietnam time, whatever the server timezone", () => {
  // 18:00 on 2026-10-01 in Vietnam is 11:00 UTC. Without the +07:00 pin a UTC server read it as 18:00 UTC.
  assert.equal(bookingStartsAt(toDbDate("2026-10-01"), timeToDate("18:00")).toISOString(), "2026-10-01T11:00:00.000Z");
  assert.equal(bookingStartsAt(toDbDate("2026-10-01"), timeToDate("05:00")).toISOString(), "2026-09-30T22:00:00.000Z");
});
