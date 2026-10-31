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
