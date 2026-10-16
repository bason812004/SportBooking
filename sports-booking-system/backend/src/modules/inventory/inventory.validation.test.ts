import assert from "node:assert/strict";
import { it } from "node:test";
import { adjustStockSchema, createPurchaseOrderSchema, receivePurchaseOrderSchema } from "./inventory.validation.js";

const line = { serviceId: "sv0001", quantity: 5, unitCost: 4000 };

it("purchase orders default to a draft and treat an empty supplier as none", () => {
  const { body } = createPurchaseOrderSchema.parse({ body: { supplierId: "", items: [line] } });
  assert.equal(body.status, "DRAFT");
  assert.equal(body.supplierId, undefined);
});

it("rejects purchase order lines that would remove or misprice stock", () => {
  for (const bad of [{ quantity: -5 }, { quantity: 0 }, { quantity: 1.5 }, { unitCost: -1 }]) {
    assert.equal(createPurchaseOrderSchema.safeParse({ body: { items: [{ ...line, ...bad }] } }).success, false, JSON.stringify(bad));
  }
  assert.equal(createPurchaseOrderSchema.safeParse({ body: { items: [] } }).success, false);
  assert.equal(createPurchaseOrderSchema.safeParse({ body: { items: [line], status: "CANCELLED" } }).success, false);
});

it("receiving accepts an empty body (everything arrived) but not negative or fractional counts", () => {
  const params = { id: "33333333-3333-4333-8333-333333333333" };
  const itemId = "44444444-4444-4444-8444-444444444444";
  assert.deepEqual(receivePurchaseOrderSchema.parse({ params, body: undefined }).body, {});
  assert.equal(receivePurchaseOrderSchema.safeParse({ params, body: { items: [{ itemId, receivedQuantity: 0 }] } }).success, true);
  for (const receivedQuantity of [-1, 2.5]) {
    assert.equal(receivePurchaseOrderSchema.safeParse({ params, body: { items: [{ itemId, receivedQuantity }] } }).success, false);
  }
});

it("rejects negative or unknown stock adjustments", () => {
  assert.equal(adjustStockSchema.safeParse({ body: { serviceId: "sv0001", type: "IMPORT", quantity: -3 } }).success, false);
  assert.equal(adjustStockSchema.safeParse({ body: { serviceId: "sv0001", type: "GIFT", quantity: 3 } }).success, false);
  assert.equal(adjustStockSchema.safeParse({ body: { serviceId: "sv0001", type: "ADJUSTMENT", quantity: 0 } }).success, true);
});
