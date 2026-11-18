import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { HISTORY_MAX_DAYS, historyRange, likePattern, pageOf, paginationOf } from "./inventory.history.js";

describe("history ranges and pages", () => {
  it("covers today when no day is given, one day when one end is", () => {
    assert.deepEqual(historyRange(undefined, undefined, "2026-11-07"), { from: "2026-11-07", to: "2026-11-07" });
    assert.deepEqual(historyRange("2026-11-01", undefined, "2026-11-07"), { from: "2026-11-01", to: "2026-11-01" });
    assert.deepEqual(historyRange(undefined, "2026-11-03", "2026-11-07"), { from: "2026-11-03", to: "2026-11-03" });
  });

  it("swaps ends given the wrong way round and caps the span", () => {
    assert.deepEqual(historyRange("2026-11-07", "2026-11-01", "2026-11-07"), { from: "2026-11-01", to: "2026-11-07" });
    const long = historyRange("2025-01-01", "2026-11-07", "2026-11-07");
    assert.equal(long.to, "2026-11-07");
    const days = (Date.parse(long.to) - Date.parse(long.from)) / 86_400_000 + 1;
    assert.equal(days, HISTORY_MAX_DAYS);
  });

  it("pages: 20 rows by default, at most 100, never below page 1", () => {
    assert.deepEqual(pageOf(), { page: 1, limit: 20, offset: 0 });
    assert.deepEqual(pageOf(3, 10), { page: 3, limit: 10, offset: 20 });
    assert.deepEqual(pageOf(0, 500), { page: 1, limit: 100, offset: 0 });
    assert.deepEqual(paginationOf(41, { page: 2, limit: 20 }), { page: 2, limit: 20, total: 41, totalPages: 3 });
    assert.equal(paginationOf(0, { page: 1, limit: 20 }).totalPages, 1);
  });

  it("a search matches its text literally", () => {
    assert.equal(likePattern("  nước "), "%nước%");
    assert.equal(likePattern("50%_off"), "%50\\%\\_off%");
    assert.equal(likePattern("   "), null);
    assert.equal(likePattern(undefined), null);
  });
});

// The service, with the repository replaced: who sees what.
let calls: unknown[][];
mock.module("./inventory.repository.js", { namedExports: { inventoryRepository: {
  transactionsPage: async (partnerId: string, filter: any) => {
    calls.push(["ledger", partnerId, filter]);
    return { items: [], total: 45 };
  },
  salesPage: async (courtId: string, filter: any) => {
    calls.push(["sales", courtId, filter]);
    return { items: [], summary: { lines: 21, quantity: 30, amount: 450000 } };
  },
  rentalsPage: async (courtId: string, filter: any) => {
    calls.push(["rentals", courtId, filter]);
    return { items: [], total: 4, summary: { out: 4, returned: 0, damaged: 0, lost: 0 } };
  }
} } });
const { inventoryService } = await import("./inventory.service.js");

const staff = { userId: "u0005", role: "RECIPIENT" as const, partnerId: "p1", courtId: "c0001" };
const partner = { userId: "u0002", role: "PARTNER" as const, partnerId: "p1", courtId: null };

beforeEach(() => {
  calls = [];
});

describe("the partner's stock ledger", () => {
  it("always reads the partner's own products, a page at a time", async () => {
    const result = await inventoryService.getTransactions("p1", { page: 3, limit: 20, type: "SALE", search: "nước" });
    const [, partnerId, filter] = calls[0] as [string, string, any];
    assert.equal(partnerId, "p1");
    assert.deepEqual(filter, { courtId: undefined, type: "SALE", search: "%nước%", from: undefined, to: undefined, limit: 20, offset: 40 });
    assert.deepEqual(result.pagination, { page: 3, limit: 20, total: 45, totalPages: 3 });
  });

  it("filters by days only when asked", async () => {
    await inventoryService.getTransactions("p1", { from: "2026-11-07", to: "2026-11-01" });
    const filter = (calls[0] as any[])[2];
    assert.equal(filter.from, "2026-11-01");
    assert.equal(filter.to, "2026-11-07");
  });
});

describe("staff sales and rentals", () => {
  it("read the staff member's own court, today by default", async () => {
    const result = await inventoryService.salesHistory(staff as any, {});
    const [kind, courtId, filter] = calls[0] as [string, string, any];
    assert.equal(kind, "sales");
    assert.equal(courtId, "c0001");
    assert.equal(filter.from, filter.to, "one day");
    assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 21, totalPages: 2 });
    assert.deepEqual(result.summary, { lines: 21, quantity: 30, amount: 450000 });
  });

  it("rentals show the pieces out with customers unless another status is asked", async () => {
    const out = await inventoryService.rentalHistory(staff as any, {});
    assert.equal(out.status, "OUT");
    assert.equal((calls[0] as any[])[2].status, "OUT");
    await inventoryService.rentalHistory(staff as any, { status: "LOST", from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual((calls[1] as any[]).slice(1, 2), ["c0001"]);
    assert.equal((calls[1] as any[])[2].status, "LOST");
    assert.equal((calls[1] as any[])[2].from, "2026-10-01");
  });

  it("are not for a partner account (the partner reads the stock ledger)", async () => {
    await assert.rejects(inventoryService.salesHistory(partner as any, {}), /dành cho nhân viên/);
    await assert.rejects(inventoryService.rentalHistory(partner as any, {}), /dành cho nhân viên/);
    assert.deepEqual(calls, []);
  });
});
