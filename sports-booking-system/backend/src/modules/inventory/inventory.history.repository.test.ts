import assert from "node:assert/strict";
import { beforeEach, it, mock } from "node:test";

let queries: Array<{ sql: string; params: unknown[] }>;
mock.module("../../config/db.js", { namedExports: { prisma: {
  async $queryRawUnsafe(sql: string, ...params: unknown[]) {
    queries.push({ sql, params });
    return sql.includes("count(*)") ? [{ total: 0, lines: 0, quantity: 0, amount: 0, out: 0, returned: 0, damaged: 0, lost: 0 }] : [];
  }
} } });
mock.module("../services/service.repository.js", { namedExports: { ensureServiceTables: async () => {}, serviceRepository: {} } });
const { inventoryRepository } = await import("./inventory.repository.js");

beforeEach(() => {
  queries = [];
});

it("the stock ledger is always limited to the asking partner's products, even with no other filter", async () => {
  const page = await inventoryRepository.transactionsPage("p9", { search: null, limit: 20, offset: 0 });
  assert.equal(page.total, 0);
  assert.deepEqual(page.items, []);
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(query.sql, /WHERE s\.partner_id = \$1/);
    assert.equal(query.params[0], "p9");
  }
});

it("sales and rentals are limited to the one court asked for", async () => {
  await inventoryRepository.salesPage("c0001", { from: "2026-11-07", to: "2026-11-07", search: null, limit: 20, offset: 0 });
  await inventoryRepository.rentalsPage("c0001", { status: "OUT", from: "2026-11-07", to: "2026-11-07", search: null, limit: 20, offset: 0 });
  assert.ok(queries.length >= 5);
  for (const query of queries) {
    assert.match(query.sql, /WHERE b\.court_id = \$1/);
    assert.equal(query.params[0], "c0001");
  }
});
