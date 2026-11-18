import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pricesChanged, toPriceHistoryEntry } from "./service.priceHistory.js";

// What Prisma hands over for a DECIMAL column: an object whose toString() is the value.
const decimal = (value: string) => ({ toString: () => value });

describe("pricesChanged", () => {
  it("compares to the đồng, whatever form the value comes in", () => {
    assert.equal(pricesChanged({ price: decimal("15000.00"), costPrice: decimal("10000.00") }, { price: 15000, costPrice: 10000 }), false);
    assert.equal(pricesChanged({ price: "15000", costPrice: null }, { price: 15000, costPrice: 0 }), false);
  });

  it("sees a change of either price", () => {
    assert.equal(pricesChanged({ price: 15000, costPrice: 10000 }, { price: 18000, costPrice: 10000 }), true);
    assert.equal(pricesChanged({ price: 15000, costPrice: 10000 }, { price: 15000, costPrice: 11000 }), true);
    assert.equal(pricesChanged({ price: 15000.5, costPrice: 0 }, { price: 15000.49, costPrice: 0 }), true);
  });
});

describe("toPriceHistoryEntry", () => {
  const at = new Date("2026-11-06T07:30:00Z");

  it("marks which price a change moved", () => {
    const entry = toPriceHistoryEntry({
      id: "sph00012",
      kind: "CHANGED",
      oldPrice: decimal("15000.00"),
      newPrice: decimal("18000.00"),
      oldCostPrice: decimal("10000.00"),
      newCostPrice: decimal("10000.00"),
      changedAt: at,
      changedById: "u0002",
      changedByName: "Đối tác 1"
    });
    assert.deepEqual(entry, {
      id: "sph00012",
      kind: "CHANGED",
      oldPrice: 15000,
      newPrice: 18000,
      oldCostPrice: 10000,
      newCostPrice: 10000,
      priceChanged: true,
      costPriceChanged: false,
      changedAt: "2026-11-06T07:30:00.000Z",
      changedBy: { id: "u0002", fullName: "Đối tác 1" }
    });
  });

  it("a starting point moves nothing and may have nobody behind it", () => {
    const entry = toPriceHistoryEntry({
      id: "sph00001",
      kind: "INITIAL",
      oldPrice: null,
      newPrice: "20000",
      oldCostPrice: null,
      newCostPrice: "12000",
      changedAt: at.toISOString(),
      changedById: null,
      changedByName: null
    });
    assert.equal(entry.kind, "INITIAL");
    assert.equal(entry.priceChanged, false);
    assert.equal(entry.costPriceChanged, false);
    assert.equal(entry.oldPrice, null);
    assert.equal(entry.newPrice, 20000);
    assert.equal(entry.changedBy, null);
  });
});
