import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

// This whole module graph (service -> repository -> "../../config/db.js") is mocked
// exactly once at file scope. See createDynamicFakePrisma's doc comment for why:
// re-mocking per test would only ever affect whichever test's import happens to
// trigger the repository's first (and only, due to ESM caching) module evaluation.
const fakePrisma = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma.client } });
mock.module("../../config/env.js", { namedExports: { env: { WITHDRAWAL_AUTO_APPROVE_LIMIT: 5_000_000 } } });

let currentProfile: any = { id: "partner1", bankName: "VCB", bankAccountNumber: "0011", bankAccountHolder: "Nguyen Van A" };
mock.module("../wallets/wallet.service.js", { namedExports: { getPartnerProfileByUser: async () => currentProfile } });

let currentPayout = {
  createPayout: async () => ({ provider: "fake", externalTransactionId: "PO1", status: "PROCESSING" }),
  verifyWebhook: async () => ({ provider: "fake", externalTransactionId: "PO1", withdrawalId: "wd1", status: "SUCCESS", rawPayload: {} })
};
mock.module("../payouts/providers/index.js", {
  namedExports: {
    payoutProvider: {
      createPayout: (...args: any[]) => currentPayout.createPayout(...(args as [])),
      verifyWebhook: (...args: any[]) => currentPayout.verifyWebhook(...(args as []))
    }
  }
});

const adminActionCalls: any[] = [];
mock.module("../admin/admin.audit.js", {
  namedExports: {
    recordAdminAction: async (...args: any[]) => {
      adminActionCalls.push(args);
    }
  }
});

const notificationCalls: any[] = [];
mock.module("../notifications/notification.service.js", {
  namedExports: {
    notificationService: {
      create: async (input: any) => {
        notificationCalls.push(input);
      }
    }
  }
});

mock.module("../realtime/realtime.service.js", {
  namedExports: {
    realtimeService: { toPartner() {}, toAdmin() {}, toUser() {}, toCourt() {}, toBooking() {}, toTeamPost() {}, toPublic() {} }
  }
});

const { withdrawalService } = (await import("./withdrawal.service.js")) as typeof import("./withdrawal.service.js");

function resetSpies() {
  adminActionCalls.length = 0;
  notificationCalls.length = 0;
  currentProfile = { id: "partner1", bankName: "VCB", bankAccountNumber: "0011", bankAccountHolder: "Nguyen Van A" };
  currentPayout = {
    createPayout: async () => ({ provider: "fake", externalTransactionId: "PO1", status: "PROCESSING" }),
    verifyWebhook: async () => ({ provider: "fake", externalTransactionId: "PO1", withdrawalId: "wd1", status: "SUCCESS", rawPayload: {} })
  };
}

describe("withdrawal.service create", () => {
  it("rejects a non-positive withdrawal amount before touching the wallet", async () => {
    resetSpies();
    let created = false;
    fakePrisma.setModels({ withdrawalRequest: { create: async () => (created = true) } });

    await assert.rejects(() => withdrawalService.create("u1", { amount: 0 } as any));
    assert.equal(created, false);
  });

  it("rejects when no bank info is available from either input or partner profile", async () => {
    resetSpies();
    currentProfile = { id: "partner1", bankName: null, bankAccountNumber: null, bankAccountHolder: null };
    fakePrisma.setModels({});

    await assert.rejects(() => withdrawalService.create("u1", { amount: 100000 } as any));
  });

  it("rejects when available balance is insufficient, without creating the withdrawal request", async () => {
    resetSpies();
    let createCalled = false;
    fakePrisma.setModels({
      partnerWallet: { upsert: async () => ({}), updateMany: async () => ({ count: 0 }) },
      withdrawalRequest: { create: async () => (createCalled = true) }
    });

    await assert.rejects(() => withdrawalService.create("u1", { amount: 1_000_000 } as any));
    assert.equal(createCalled, false);
  });

  it("stays PENDING when the amount is above the auto-approve limit", async () => {
    resetSpies();
    let transitionCalled = false;
    fakePrisma.setModels({
      partnerWallet: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) },
      withdrawalRequest: {
        create: async ({ data }: any) => ({ id: "wd1", status: "PENDING", partnerId: data.partnerId, amount: data.amount }),
        updateMany: async () => {
          transitionCalled = true;
          return { count: 1 };
        }
      }
    });

    const result = await withdrawalService.create("u1", { amount: 6_000_000 } as any);

    assert.equal(result.status, "PENDING");
    assert.equal(transitionCalled, false);
  });

  it("auto-approves and triggers payout when the amount is within the auto-approve limit", async () => {
    resetSpies();
    const transitionCalls: any[] = [];
    let payoutCalled = false;
    currentPayout.createPayout = async () => {
      payoutCalled = true;
      return { provider: "fake", externalTransactionId: "PO1", status: "PROCESSING" };
    };
    fakePrisma.setModels({
      partnerWallet: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) },
      withdrawalRequest: {
        create: async ({ data }: any) => ({ id: "wd1", status: "PENDING", partnerId: data.partnerId, amount: data.amount }),
        updateMany: async (args: any) => {
          transitionCalls.push(args.data.status);
          return { count: 1 };
        },
        findUnique: async () => ({ id: "wd1", status: "PROCESSING", partnerId: "partner1", amount: 1_000_000 })
      }
    });

    const result = await withdrawalService.create("u1", { amount: 1_000_000 } as any);

    assert.deepEqual(transitionCalls, ["APPROVED", "PROCESSING"]);
    assert.equal(payoutCalled, true);
    assert.equal(result.status, "PROCESSING");
    assert.equal(adminActionCalls.length, 1);
  });
});

describe("withdrawal.service reject", () => {
  it("throws NotFoundError when the withdrawal does not exist", async () => {
    resetSpies();
    fakePrisma.setModels({ withdrawalRequest: { findUnique: async () => null } });

    await assert.rejects(() => withdrawalService.reject("admin1", "wd1"));
  });

  it("throws ValidationError when the withdrawal is not PENDING or APPROVED", async () => {
    resetSpies();
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "PAID", partnerId: "partner1", amount: 100000 }),
        updateMany: async () => ({ count: 0 })
      }
    });

    await assert.rejects(() => withdrawalService.reject("admin1", "wd1"));
  });

  it("releases the held amount back to the wallet on a successful reject", async () => {
    resetSpies();
    let releaseCall: any = null;
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "PENDING", partnerId: "partner1", amount: 250000 }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        update: async (args: any) => {
          releaseCall = args;
          return {};
        }
      }
    });

    await withdrawalService.reject("admin1", "wd1", "khong hop le");

    assert.equal(releaseCall.where.partnerId, "partner1");
    assert.deepEqual(releaseCall.data.availableBalance, { increment: 250000 });
  });
});

describe("withdrawal.service markPaid", () => {
  it("throws ValidationError when the withdrawal is not APPROVED", async () => {
    resetSpies();
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "PENDING", partnerId: "partner1", amount: 100000 }),
        updateMany: async () => ({ count: 0 })
      }
    });

    await assert.rejects(() => withdrawalService.markPaid("admin1", "wd1"));
  });

  it("marks totalWithdrawn on the wallet when confirming payment", async () => {
    resetSpies();
    let markCall: any = null;
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "APPROVED", partnerId: "partner1", amount: 300000 }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        update: async (args: any) => {
          markCall = args;
          return {};
        }
      }
    });

    await withdrawalService.markPaid("admin1", "wd1");

    assert.deepEqual(markCall.data.totalWithdrawn, { increment: 300000 });
  });
});

describe("withdrawal.service handleProviderWebhook", () => {
  it("ignores a webhook for an unknown withdrawal without touching the wallet", async () => {
    resetSpies();
    let walletTouched = false;
    fakePrisma.setModels({
      withdrawalRequest: { findUnique: async () => null },
      partnerWallet: { update: async () => (walletTouched = true) }
    });

    const result = await withdrawalService.handleProviderWebhook("fake", {}, {});

    assert.deepEqual(result, { ignored: true });
    assert.equal(walletTouched, false);
  });

  it("ignores a replayed webhook once the withdrawal has already moved past APPROVED/PROCESSING", async () => {
    resetSpies();
    let walletTouched = false;
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "PAID", partnerId: "partner1", amount: 100000, processedBy: "admin1" }),
        updateMany: async () => ({ count: 0 })
      },
      partnerWallet: { update: async () => (walletTouched = true) }
    });

    const result = await withdrawalService.handleProviderWebhook("fake", {}, {});

    assert.deepEqual(result, { ignored: true });
    assert.equal(walletTouched, false);
    assert.equal(notificationCalls.length, 0);
  });

  it("marks the wallet withdrawn and notifies the partner on a SUCCESS webhook", async () => {
    resetSpies();
    currentPayout.verifyWebhook = async () => ({ provider: "fake", externalTransactionId: "PO1", withdrawalId: "wd1", status: "SUCCESS", rawPayload: {} });
    let walletCall: any = null;
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "PROCESSING", partnerId: "partner1", amount: 100000, processedBy: "admin1", partner: { user: { id: "user1" } } }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        update: async (args: any) => {
          walletCall = args;
          return {};
        }
      }
    });

    const result = await withdrawalService.handleProviderWebhook("fake", {}, {});

    assert.deepEqual(walletCall.data.totalWithdrawn, { increment: 100000 });
    assert.equal((result as any).status, "PROCESSING");
    assert.equal(notificationCalls[0].type, "WITHDRAWAL_PAID");
  });

  it("releases the hold and notifies the partner of failure on a FAILED webhook", async () => {
    resetSpies();
    currentPayout.verifyWebhook = async () => ({ provider: "fake", externalTransactionId: "PO1", withdrawalId: "wd1", status: "FAILED", rawPayload: {} });
    let walletCall: any = null;
    fakePrisma.setModels({
      withdrawalRequest: {
        findUnique: async () => ({ id: "wd1", status: "PROCESSING", partnerId: "partner1", amount: 100000, processedBy: "admin1", partner: { user: { id: "user1" } } }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        update: async (args: any) => {
          walletCall = args;
          return {};
        }
      }
    });

    await withdrawalService.handleProviderWebhook("fake", {}, {});

    assert.deepEqual(walletCall.data.availableBalance, { increment: 100000 });
    assert.equal(notificationCalls[0].type, "WITHDRAWAL_FAILED");
  });
});
