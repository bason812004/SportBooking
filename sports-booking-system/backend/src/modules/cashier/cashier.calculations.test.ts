import assert from "node:assert/strict";
import { it } from "node:test";
import { nowWithinPlayWindow, playHasStarted } from "./cashier.calculations.js";

it("auto check-in uses Vietnam time, including exact grace-window boundaries", () => {
  const booking = { bookingDate: new Date("2026-09-19T00:00:00Z"), startTime: new Date("1970-01-01T18:00:00Z"), endTime: "20:00" };
  for (const time of ["17:30", "18:00", "20:00", "21:00"]) assert.equal(nowWithinPlayWindow(booking, new Date(`2026-09-19T${time}:00+07:00`)), true);
  for (const date of ["2026-09-19T17:29:59+07:00", "2026-09-19T21:00:01+07:00", "2026-09-18T18:00:00+07:00"]) assert.equal(nowWithinPlayWindow(booking, new Date(date)), false);
});

it("selling a service checks the guest in only once the booked time has begun", () => {
  const booking = { bookingDate: new Date("2026-09-19T00:00:00Z"), startTime: new Date("1970-01-01T18:00:00Z"), endTime: "20:00" };
  assert.equal(playHasStarted(booking, new Date("2026-09-19T17:59:59+07:00")), false);
  assert.equal(playHasStarted(booking, new Date("2026-09-19T18:00:00+07:00")), true);
});

it("names what the money paid before the session covered", async () => {
  const { prepaidKind } = await import("./cashier.calculations.js");
  assert.equal(prepaidKind(0, 500000), "NONE");
  assert.equal(prepaidKind(250000, 500000), "DEPOSIT");
  assert.equal(prepaidKind(500000, 500000), "COURT_FULL");
  // A voucher lowers what the court costs: paying the rest online covers it.
  assert.equal(prepaidKind(450000, 500000, 50000), "COURT_FULL");
  assert.equal(prepaidKind(400000, 500000, 50000), "DEPOSIT");
});
