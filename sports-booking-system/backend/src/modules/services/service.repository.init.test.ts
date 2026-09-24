import assert from "node:assert/strict";
import { it, mock } from "node:test";

let executeCalls = 0;
let failNext = true;
const fakePrisma = {
  async $executeRawUnsafe() {
    executeCalls += 1;
    if (failNext) {
      failNext = false;
      throw new Error("schema init failed");
    }
    return 0;
  }
};

mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma } });

const { ensureServiceTables } = await import("./service.repository.js");

it("shares initialization between concurrent callers and retries after a failure", async () => {
  const failed = ensureServiceTables();
  await assert.rejects(failed, /schema init failed/);

  const retry = ensureServiceTables();
  const concurrent = ensureServiceTables();

  assert.equal(retry, concurrent);
  await Promise.all([retry, concurrent]);

  const callsAfterSuccess = executeCalls;
  await ensureServiceTables();
  assert.equal(executeCalls, callsAfterSuccess);
});
