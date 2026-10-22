import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { walletRepository } from "./wallet.repository.js";

function fakeDb(overrides: Partial<Record<string, (...args: any[]) => any>> = {}) {
  return {
    partnerWallet: {
      upsert: async () => {
        throw new Error("upsert not stubbed");
      },
      updateMany: async () => {
        throw new Error("updateMany not stubbed");
      },
      update: async () => {
        throw new Error("update not stubbed");
      },
      ...overrides
    }
  } as any;
}

describe("wallet.repository money mutators", () => {
  it("creditPending increments both pendingBalance and totalEarned", async () => {
    let call: any = null;
    const db = fakeDb({
      upsert: async (args: any) => {
        call = args;
        return { partnerId: "p1", pendingBalance: 100 };
      }
    });

    await walletRepository.creditPending("p1", 100, db);

    assert.equal(call.where.partnerId, "p1");
    assert.equal(call.create.pendingBalance, 100);
    assert.equal(call.create.totalEarned, 100);
    assert.deepEqual(call.update.pendingBalance, { increment: 100 });
    assert.deepEqual(call.update.totalEarned, { increment: 100 });
  });

  it("settlePending only matches wallets with enough pendingBalance and moves it to availableBalance", async () => {
    let call: any = null;
    const db = fakeDb({
      updateMany: async (args: any) => {
        call = args;
        return { count: 1 };
      }
    });

    const count = await walletRepository.settlePending("p1", 5000, db);

    assert.equal(count, 1);
    assert.equal(call.where.partnerId, "p1");
    assert.deepEqual(call.where.pendingBalance, { gte: 5000 });
    assert.deepEqual(call.data.pendingBalance, { decrement: 5000 });
    assert.deepEqual(call.data.availableBalance, { increment: 5000 });
  });

  it("settlePending returns 0 when pendingBalance guard fails (insufficient funds)", async () => {
    const db = fakeDb({ updateMany: async () => ({ count: 0 }) });

    const count = await walletRepository.settlePending("p1", 999999, db);

    assert.equal(count, 0);
  });

  it("rollbackPending moves pendingBalance back out without touching availableBalance", async () => {
    let call: any = null;
    const db = fakeDb({
      updateMany: async (args: any) => {
        call = args;
        return { count: 1 };
      }
    });

    await walletRepository.rollbackPending("p1", 3000, db);

    assert.deepEqual(call.where.pendingBalance, { gte: 3000 });
    assert.deepEqual(call.data.pendingBalance, { decrement: 3000 });
    assert.deepEqual(call.data.totalEarned, { decrement: 3000 });
    assert.equal("availableBalance" in call.data, false);
  });

  it("holdAvailable guards on availableBalance >= amount before decrementing", async () => {
    let call: any = null;
    const db = fakeDb({
      updateMany: async (args: any) => {
        call = args;
        return { count: 1 };
      }
    });

    const count = await walletRepository.holdAvailable("p1", 20000, db);

    assert.equal(count, 1);
    assert.deepEqual(call.where.availableBalance, { gte: 20000 });
    assert.deepEqual(call.data.availableBalance, { decrement: 20000 });
  });

  it("holdAvailable returns 0 without throwing when balance is insufficient", async () => {
    const db = fakeDb({ updateMany: async () => ({ count: 0 }) });

    const count = await walletRepository.holdAvailable("p1", 10_000_000, db);

    assert.equal(count, 0);
  });

  it("debitAvailable decrements both availableBalance and totalEarned under the same guard", async () => {
    let call: any = null;
    const db = fakeDb({
      updateMany: async (args: any) => {
        call = args;
        return { count: 1 };
      }
    });

    await walletRepository.debitAvailable("p1", 15000, db);

    assert.deepEqual(call.where.availableBalance, { gte: 15000 });
    assert.deepEqual(call.data.availableBalance, { decrement: 15000 });
    assert.deepEqual(call.data.totalEarned, { decrement: 15000 });
  });

  it("releaseHold increments availableBalance back", async () => {
    let call: any = null;
    const db = fakeDb({
      update: async (args: any) => {
        call = args;
        return { partnerId: "p1" };
      }
    });

    await walletRepository.releaseHold("p1", 8000, db);

    assert.equal(call.where.partnerId, "p1");
    assert.deepEqual(call.data.availableBalance, { increment: 8000 });
  });

  it("markWithdrawn increments totalWithdrawn only", async () => {
    let call: any = null;
    const db = fakeDb({
      update: async (args: any) => {
        call = args;
        return { partnerId: "p1" };
      }
    });

    await walletRepository.markWithdrawn("p1", 8000, db);

    assert.deepEqual(call.data.totalWithdrawn, { increment: 8000 });
    assert.equal("availableBalance" in call.data, false);
  });
});
