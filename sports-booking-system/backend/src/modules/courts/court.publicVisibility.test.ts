import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let wheres: any[];
const court = {
  findFirst: async (args: any) => { wheres.push(args.where); return null; },
  findMany: async (args: any) => { wheres.push(args.where); return []; },
  count: async (args: any) => { wheres.push(args.where); return 0; }
};
mock.module("../../config/db.js", { namedExports: { prisma: { court, $transaction: (operations: Promise<unknown>[]) => Promise.all(operations) } } });
const { courtRepository } = await import("./court.repository.js");

beforeEach(() => {
  wheres = [];
});

test("public court list, detail and nearby skip courts of a locked partner account", async () => {
  await courtRepository.list({} as any, 1, 10);
  await courtRepository.findPublicById("c1");
  await courtRepository.nearby("c1", "TP.HCM");

  assert.equal(wheres.length, 4, "list (rows + count), detail, nearby");
  for (const where of wheres) {
    assert.deepEqual(where.partner, { user: { status: "ACTIVE" } });
    assert.equal(where.approvalStatus, "APPROVED");
  }
});
