import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conflictingBand, coverWithPrices, piecesTotal, priceBands, priceOrThrow } from "./courtPricing.js";

const at = (clock: string) => new Date(`1970-01-01T${clock}:00Z`);
const row = (dayType: string, start: string, end: string, price: number, created = "2026-01-01") => ({
  dayType,
  startTime: at(start),
  endTime: at(end),
  price,
  createdAt: new Date(`${created}T00:00:00Z`)
});
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

// 2026-10-28 is a Wednesday, 2026-10-31 a Saturday, 2026-09-02 a Wednesday holiday.
const table = priceBands([
  row("WEEKDAY", "06:00", "17:00", 120000),
  row("WEEKDAY", "06:00", "08:00", 150000),
  row("WEEKDAY", "17:00", "22:00", 200000),
  row("WEEKEND", "06:00", "22:00", 250000),
  row("HOLIDAY", "17:00", "22:00", 300000)
]);
const holidays = [{ holidayDate: "2026-09-02", recurring: true }];

describe("court prices", () => {
  it("prices each hour with the narrowest band covering it", () => {
    const { pieces, missing } = coverWithPrices(table, "2026-10-28", minutes("07:00"), minutes("09:00"));
    assert.deepEqual(missing, []);
    assert.deepEqual(pieces.map((p) => [p.start / 60, p.end / 60, p.price]), [[7, 8, 150000], [8, 9, 120000]]);
    assert.equal(piecesTotal(pieces), 270000);
  });

  it("charges a booking across two bands at each band's price, not one price times the hours", () => {
    const pieces = priceOrThrow(table, "2026-10-28", minutes("16:00"), minutes("18:00"));
    assert.equal(piecesTotal(pieces), 120000 + 200000);
  });

  it("uses holiday prices on a holiday, and the usual day's prices where it has none", () => {
    const evening = priceOrThrow(table, "2026-09-02", minutes("18:00"), minutes("19:00"), holidays);
    assert.equal(piecesTotal(evening), 300000);
    const morning = priceOrThrow(table, "2026-09-02", minutes("09:00"), minutes("10:00"), holidays);
    assert.equal(piecesTotal(morning), 120000, "a recurring holiday falls back to its weekday prices");
    assert.equal(piecesTotal(priceOrThrow(table, "2026-10-31", minutes("18:00"), minutes("19:00"), holidays)), 250000);
  });

  it("refuses hours without a price instead of borrowing another day's or another hour's", () => {
    assert.throws(() => priceOrThrow(table, "2026-10-28", minutes("21:00"), minutes("23:00")), /22:00-23:00 ngày 2026-10-28 chưa có bảng giá/);
    assert.throws(() => priceOrThrow(priceBands([row("WEEKDAY", "06:00", "22:00", 100000)]), "2026-10-31", minutes("08:00"), minutes("09:00")));
  });

  it("lets the newer of two equally narrow bands win", () => {
    const bands = priceBands([row("WEEKDAY", "06:00", "08:00", 150000, "2026-01-01"), row("WEEKDAY", "06:00", "08:00", 170000, "2026-05-01")]);
    assert.equal(piecesTotal(priceOrThrow(bands, "2026-10-28", minutes("06:00"), minutes("07:00"))), 170000);
  });

  it("accepts a band nested in another but not one partly overlapping or repeating it", () => {
    const others = priceBands([row("WEEKDAY", "06:00", "17:00", 120000)]);
    assert.equal(conflictingBand({ dayType: "WEEKDAY", start: minutes("06:00"), end: minutes("08:00") }, others), undefined);
    assert.ok(conflictingBand({ dayType: "WEEKDAY", start: minutes("16:00"), end: minutes("18:00") }, others));
    assert.ok(conflictingBand({ dayType: "WEEKDAY", start: minutes("06:00"), end: minutes("17:00") }, others));
    assert.equal(conflictingBand({ dayType: "WEEKEND", start: minutes("16:00"), end: minutes("18:00") }, others), undefined);
  });
});
