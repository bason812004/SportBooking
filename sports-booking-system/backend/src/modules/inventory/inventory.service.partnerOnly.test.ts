import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

let calls: string[];
mock.module("./inventory.repository.js", { namedExports: { inventoryRepository: {
  createPurchaseOrder: async () => {
    calls.push("create");
    return { id: "po1" };
  },
  getReorderSuggestions: async () => [{ serviceId: "sv1", suggestedQuantity: 10, costPrice: 6000 }],
  updatePurchaseOrder: async () => {
    calls.push("update");
    return { id: "po1" };
  },
  transitionPurchaseOrder: async () => {
    calls.push("transition");
    return { id: "po1" };
  },
  listPurchaseOrders: async () => {
    calls.push("list");
    return [];
  }
} } });
const { inventoryService } = await import("./inventory.service.js");

const staff = { userId: "u0005", role: "RECIPIENT" as const, partnerId: "p1", courtId: "c1" };
const partner = { userId: "u0002", role: "PARTNER" as const, partnerId: "p1", courtId: null };

beforeEach(() => {
  calls = [];
});

describe("buying stock in is the partner's", () => {
  it("staff can neither draft, edit, order, receive, cancel nor list purchase orders", async () => {
    const refused = /đối tác thực hiện/;
    await assert.rejects(inventoryService.createPurchaseOrder(staff as any, { courtId: "c1", items: [] } as any), refused);
    await assert.rejects(inventoryService.createDraftFromSuggestions(staff as any), refused);
    await assert.rejects(inventoryService.updatePurchaseOrder(staff as any, "po1", {} as any), refused);
    await assert.rejects(inventoryService.orderPurchaseOrder(staff as any, "po1"), refused);
    await assert.rejects(inventoryService.receivePurchaseOrder(staff as any, "po1"), refused);
    await assert.rejects(inventoryService.cancelPurchaseOrder(staff as any, "po1"), refused);
    await assert.rejects(inventoryService.listPurchaseOrders(staff as any), refused);
    assert.deepEqual(calls, []);
  });

  it("the partner runs the whole purchase order", async () => {
    await inventoryService.createPurchaseOrder(partner as any, { courtId: "c1", items: [] } as any);
    await inventoryService.createDraftFromSuggestions(partner as any, "c1");
    await inventoryService.receivePurchaseOrder(partner as any, "po1");
    await inventoryService.listPurchaseOrders(partner as any);
    assert.deepEqual(calls, ["create", "create", "transition", "list"]);
  });
});
