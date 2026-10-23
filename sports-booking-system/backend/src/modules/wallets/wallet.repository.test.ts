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

describe("wallet.repository commission debt", () => {
  // Captures each tagged-template $executeRaw call as normalized SQL text plus its bound values.
  function rawDb(overrides: Partial<Record<string, (...args: any[]) => any>> = {}) {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db = fakeDb(overrides) as any;
    db.$executeRaw = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push({ sql: strings.join("?").replace(/\s+/g, " ").trim(), values });
      return 1;
    };
    return { db, statements };
  }

  it("chargeCommission takes what the available balance covers and turns the rest into debt in one statement", async () => {
    let upserted: any = null;
    const { db, statements } = rawDb({ upsert: async (args: any) => (upserted = args) });

    await walletRepository.chargeCommission("p1", 40000, db);

    assert.deepEqual(upserted.create, { partnerId: "p1" });
    assert.equal(statements.length, 1);
    const [{ sql, values }] = statements;
    assert.match(sql, /available_balance = available_balance - least\(available_balance, \?::numeric\)/);
    assert.match(sql, /total_earned = total_earned - least\(available_balance, \?::numeric\)/);
    assert.match(sql, /commission_debt = commission_debt \+ \?::numeric - least\(available_balance, \?::numeric\)/);
    assert.deepEqual(values, [40000, 40000, 40000, 40000, "p1"]);
  });

  it("chargeCommission does nothing for a zero commission", async () => {
    const { db, statements } = rawDb();
    await walletRepository.chargeCommission("p1", 0, db);
    assert.equal(statements.length, 0);
  });

  it("offsetDebt pays debt from the available balance only when both are positive", async () => {
    const { db, statements } = rawDb();
    await walletRepository.offsetDebt("p1", db);
    assert.match(statements[0].sql, /commission_debt = commission_debt - least\(available_balance, commission_debt\)/);
    assert.match(statements[0].sql, /where partner_id = \? and commission_debt > 0 and available_balance > 0$/);
    assert.deepEqual(statements[0].values, ["p1"]);
  });

  it("refundCommission clears debt first and returns the rest to the available balance", async () => {
    const { db, statements } = rawDb();
    await walletRepository.refundCommission("p1", 25000, db);
    assert.match(statements[0].sql, /commission_debt = commission_debt - least\(commission_debt, \?::numeric\)/);
    assert.match(statements[0].sql, /available_balance = available_balance \+ \?::numeric - least\(commission_debt, \?::numeric\)/);
    assert.equal(statements[0].values.at(-1), "p1");
  });

  it("payDebt only succeeds when the debt covers the amount", async () => {
    let call: any = null;
    const db = fakeDb({ updateMany: async (args: any) => { call = args; return { count: 0 }; } });
    assert.equal(await walletRepository.payDebt("p1", 50000, db), 0);
    assert.deepEqual(call.where, { partnerId: "p1", commissionDebt: { gte: 50000 } });
    assert.deepEqual(call.data, { commissionDebt: { decrement: 50000 } });
  });
});
