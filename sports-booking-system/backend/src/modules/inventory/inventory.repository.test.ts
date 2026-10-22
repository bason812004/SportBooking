import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import type { InventoryActor } from "./inventory.types.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
mock.module("../services/service.repository.js", { namedExports: { ensureServiceTables: async () => {}, serviceRepository: {} } });
const { inventoryService } = await import("./inventory.service.js");

const PARTNER: InventoryActor = { userId: "u-owner", role: "PARTNER", partnerId: "p1", courtId: null };
// Receptionist of court c1 of the same partner.
const STAFF: InventoryActor = { userId: "u-staff", role: "RECIPIENT", partnerId: "p1", courtId: "c1" };

type Order = {
  id: string;
  partnerId: string;
  courtId: string | null;
  orderCode: string;
  status: string;
  supplierId: string | null;
  note: string | null;
  totalAmount: number;
  orderedAt?: Date | null;
  [key: string]: unknown;
};
type Item = { id: string; purchaseOrderId: string; serviceId: string; quantity: number; receivedQuantity: number | null; unitCost: number; totalPrice: number };

const matchesOrder = (order: Order, where: any) =>
  order.id === where.id &&
  order.partnerId === where.partnerId &&
  (where.courtId === undefined || order.courtId === where.courtId) &&
  (where.status === undefined || (typeof where.status === "string" ? order.status === where.status : where.status.in.includes(order.status)));

// In-memory stand-in for the tables the purchase-order flow touches, so assertions are about
// resulting stock and audit data rather than about which Prisma calls were made.
function setup(initial: { orders?: Order[]; items?: Item[]; stock?: Record<string, number>; suggestionRows?: any[] } = {}) {
  const courts = [
    { id: "c1", partnerId: "p1" },
    { id: "c2", partnerId: "p1" },
    { id: "c9", partnerId: "p2" }
  ];
  const services = [
    { id: "sv-water", partnerId: "p1", courtId: "c1", unit: "chai", costPrice: 0 },
    { id: "sv-towel", partnerId: "p1", courtId: "c1", unit: "cái", costPrice: 0 },
    { id: "sv-water-c2", partnerId: "p1", courtId: "c2", unit: "chai", costPrice: 0 },
    { id: "sv-foreign", partnerId: "p2", courtId: "c9", unit: "lon", costPrice: 0 }
  ];
  const suppliers = [
    { id: "11111111-1111-4111-8111-111111111111", partnerId: "p1" },
    { id: "22222222-2222-4222-8222-222222222222", partnerId: "p2" }
  ];
  const store = {
    orders: [...(initial.orders ?? [])],
    items: [...(initial.items ?? [])],
    stock: new Map(Object.entries(initial.stock ?? {})),
    imports: [] as Array<{ serviceId: string; quantity: number; referenceId: string | null }>,
    rawQueries: [] as unknown[][]
  };
  const withItems = (id: string) => {
    const po = store.orders.find((order) => order.id === id);
    if (!po) return null;
    const items = store.items
      .filter((item) => item.purchaseOrderId === id)
      .map((item) => ({ ...item, service: services.find((service) => service.id === item.serviceId) }));
    return { ...po, supplier: null, items };
  };

  fake.setModels(
    {
      court: {
        findFirst: async ({ where }: any) => courts.find((c) => c.id === where.id && c.partnerId === where.partnerId) ?? null
      },
      service: {
        count: async ({ where }: any) => services.filter((service) => service.partnerId === where.partnerId).length,
        findMany: async ({ where }: any) => services.filter((s) => where.id.in.includes(s.id) && (!where.partnerId || s.partnerId === where.partnerId)),
        update: async ({ where, data }: any) => Object.assign(services.find((service) => service.id === where.id)!, data)
      },
      supplier: {
        findFirst: async ({ where }: any) => suppliers.find((s) => s.id === where.id && s.partnerId === where.partnerId) ?? null
      },
      purchaseOrder: {
        create: async ({ data }: any) => {
          const po = { id: `po-new-${store.orders.length + 1}`, ...data };
          store.orders.push(po);
          return po;
        },
        updateMany: async ({ where, data }: any) => {
          const matches = store.orders.filter((o) => matchesOrder(o, where));
          matches.forEach((o) => Object.assign(o, data));
          return { count: matches.length };
        },
        findFirst: async ({ where }: any) => {
          const po = store.orders.find((o) => matchesOrder(o, where));
          return po ? withItems(po.id) : null;
        },
        findUnique: async ({ where }: any) => withItems(where.id)
      },
      purchaseOrderItem: {
        createMany: async ({ data }: any) => {
          store.items.push(...data.map((line: any, i: number) => ({ id: `item-${store.items.length + i + 1}`, ...line })));
          return { count: data.length };
        },
        deleteMany: async ({ where }: any) => {
          store.items = store.items.filter((item) => item.purchaseOrderId !== where.purchaseOrderId);
          return { count: 0 };
        },
        update: async ({ where, data }: any) => Object.assign(store.items.find((item) => item.id === where.id)!, data)
      },
      serviceInventory: {
        upsert: async ({ where, create, update }: any) => {
          const current = store.stock.get(where.serviceId);
          store.stock.set(where.serviceId, current === undefined ? create.quantity : current + update.quantity.increment);
        }
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          store.imports.push(data);
          return data;
        }
      }
    },
    {
      queryRaw: async (_sql: string, ...params: unknown[]) => {
        store.rawQueries.push(params);
        return initial.suggestionRows ?? [];
      }
    }
  );
  return store;
}

const order = (id: string, status: string, courtId = "c1"): Order => ({
  id,
  partnerId: "p1",
  courtId,
  orderCode: `CODE-${id}`,
  status,
  supplierId: null,
  note: null,
  totalAmount: 0,
  orderedAt: status === "DRAFT" ? null : new Date("2026-10-01")
});
const item = (id: string, purchaseOrderId: string, serviceId: string, quantity: number, unitCost = 5000): Item => ({
  id,
  purchaseOrderId,
  serviceId,
  quantity,
  receivedQuantity: null,
  unitCost,
  totalPrice: quantity * unitCost
});
const line = (serviceId: string, quantity = 5, unitCost = 4000) => ({ serviceId, quantity, unitCost });

it("receiving an ordered purchase order adds each line to stock exactly once and records who received it", async () => {
  const store = setup({
    orders: [order("po-1", "ORDERED")],
    items: [item("i1", "po-1", "sv-water", 10), item("i2", "po-1", "sv-towel", 4)],
    stock: { "sv-water": 3 }
  });

  const received = await inventoryService.receivePurchaseOrder(STAFF, "po-1");
  assert.equal(received?.status, "COMPLETED");
  assert.equal(received?.receivedById, "u-staff");
  assert.equal(received?.receivedAmount, 70000);
  assert.equal(store.stock.get("sv-water"), 13);
  // No stock row yet: the received quantity becomes the starting stock.
  assert.equal(store.stock.get("sv-towel"), 4);
  assert.deepEqual(store.items.map((line) => line.receivedQuantity), [10, 4]);
  assert.deepEqual(
    store.imports.map((tx) => [tx.serviceId, tx.quantity, tx.referenceId]),
    [["sv-water", 10, "po-1"], ["sv-towel", 4, "po-1"]]
  );

  // A second receive (double click, second tab) must not add the goods again.
  await assert.rejects(inventoryService.receivePurchaseOrder(PARTNER, "po-1"), ConflictError);
  assert.equal(store.stock.get("sv-water"), 13);
  assert.equal(store.imports.length, 2);
});

it("stock grows by the counted quantity when fewer goods arrive than were ordered", async () => {
  const store = setup({
    orders: [order("po-1", "ORDERED")],
    items: [item("i1", "po-1", "sv-water", 10), item("i2", "po-1", "sv-towel", 4)],
    stock: { "sv-water": 3, "sv-towel": 1 }
  });

  const received = await inventoryService.receivePurchaseOrder(STAFF, "po-1", {
    items: [
      { itemId: "i1", receivedQuantity: 7 },
      { itemId: "i2", receivedQuantity: 0 }
    ],
    note: "Thiếu 3 chai, khăn giao sau"
  });
  assert.equal(store.stock.get("sv-water"), 10);
  assert.equal(store.stock.get("sv-towel"), 1);
  assert.deepEqual(store.items.map((line) => line.receivedQuantity), [7, 0]);
  // A line that did not arrive leaves no IMPORT transaction behind.
  assert.deepEqual(store.imports.map((tx) => [tx.serviceId, tx.quantity]), [["sv-water", 7]]);
  assert.equal(received?.receivedAmount, 35000);
  assert.equal(received?.receiveNote, "Thiếu 3 chai, khăn giao sau");
});

it("rejects counts above the ordered quantity or for lines of another order, without touching stock", async () => {
  const store = setup({ orders: [order("po-1", "ORDERED")], items: [item("i1", "po-1", "sv-water", 10)], stock: { "sv-water": 3 } });

  await assert.rejects(inventoryService.receivePurchaseOrder(PARTNER, "po-1", { items: [{ itemId: "i1", receivedQuantity: 11 }] }), ValidationError);
  await assert.rejects(inventoryService.receivePurchaseOrder(PARTNER, "po-1", { items: [{ itemId: "other", receivedQuantity: 1 }] }), ValidationError);
  assert.equal(store.orders[0].status, "ORDERED");
  assert.equal(store.stock.get("sv-water"), 3);
  assert.equal(store.imports.length, 0);
});

it("cancelling is only possible before the goods are received and never touches stock", async () => {
  const store = setup({
    orders: [order("po-done", "COMPLETED"), order("po-open", "ORDERED")],
    items: [item("i1", "po-open", "sv-water", 10)],
    stock: { "sv-water": 3 }
  });

  await assert.rejects(inventoryService.cancelPurchaseOrder(PARTNER, "po-done"), ConflictError);
  const cancelled = await inventoryService.cancelPurchaseOrder(PARTNER, "po-open");
  assert.equal(cancelled?.status, "CANCELLED");
  assert.equal(cancelled?.cancelledById, "u-owner");
  assert.equal(store.stock.get("sv-water"), 3);
  assert.equal(store.imports.length, 0);
  await assert.rejects(inventoryService.receivePurchaseOrder(PARTNER, "po-open"), ConflictError);
});

it("transitions on an unknown or foreign order are reported as not found", async () => {
  setup({ orders: [{ ...order("po-other", "ORDERED"), partnerId: "p2" }] });
  await assert.rejects(inventoryService.receivePurchaseOrder(PARTNER, "po-missing"), NotFoundError);
  await assert.rejects(inventoryService.receivePurchaseOrder(PARTNER, "po-other"), NotFoundError);
});

it("a partner's draft does not touch stock while 'nhập kho ngay' adds it immediately", async () => {
  const store = setup({ stock: { "sv-water": 3 } });

  const draft = await inventoryService.createPurchaseOrder(PARTNER, { items: [line("sv-water")], status: "DRAFT" });
  assert.equal(draft?.status, "DRAFT");
  assert.equal(draft?.courtId, "c1", "court is inferred from the products");
  assert.equal(draft?.createdById, "u-owner");
  assert.equal(draft?.totalAmount, 20000);
  assert.equal(store.stock.get("sv-water"), 3);

  const received = await inventoryService.createPurchaseOrder(PARTNER, { items: [line("sv-water")], status: "COMPLETED" });
  assert.equal(received?.status, "COMPLETED");
  assert.equal(received?.receivedById, "u-owner");
  assert.equal(store.stock.get("sv-water"), 8);
  assert.deepEqual(store.imports.map((tx) => tx.referenceId), [received?.id]);
  assert.deepEqual(received?.items.map((l) => l.receivedQuantity), [5]);
});

it("each purchase order restocks exactly one court of the partner", async () => {
  const store = setup();

  await assert.rejects(inventoryService.createPurchaseOrder(PARTNER, { items: [line("sv-water"), line("sv-water-c2")] }), ValidationError);
  await assert.rejects(inventoryService.createPurchaseOrder(PARTNER, { courtId: "c2", items: [line("sv-water")] }), ValidationError);
  await assert.rejects(inventoryService.createPurchaseOrder(PARTNER, { courtId: "c9", items: [line("sv-water")] }), NotFoundError);
  await assert.rejects(inventoryService.createPurchaseOrder(PARTNER, { items: [line("sv-foreign")] }), NotFoundError);
  await assert.rejects(
    inventoryService.createPurchaseOrder(PARTNER, { supplierId: "22222222-2222-4222-8222-222222222222", items: [line("sv-water")] }),
    NotFoundError
  );
  assert.equal(store.orders.length, 0);

  const c2 = await inventoryService.createPurchaseOrder(PARTNER, { courtId: "c2", items: [line("sv-water-c2")] });
  assert.equal(c2?.courtId, "c2");
});

it("a receptionist can only propose drafts for their own court", async () => {
  const store = setup({ stock: { "sv-water": 3 } });

  // Asking for an immediate receipt at another court still yields a draft at the receptionist's court.
  const proposal = await inventoryService.createPurchaseOrder(STAFF, { courtId: "c2", items: [line("sv-water")], status: "COMPLETED" });
  assert.equal(proposal?.status, "DRAFT");
  assert.equal(proposal?.courtId, "c1");
  assert.equal(proposal?.createdById, "u-staff");
  assert.equal(store.stock.get("sv-water"), 3);

  await assert.rejects(inventoryService.createPurchaseOrder(STAFF, { items: [line("sv-water-c2")] }), ValidationError);
});

it("a receptionist counts goods in only after the partner has ordered them, and only at their court", async () => {
  const store = setup({
    orders: [order("po-draft", "DRAFT"), order("po-c1", "ORDERED"), order("po-c2", "ORDERED", "c2")],
    items: [item("i1", "po-draft", "sv-water", 5), item("i2", "po-c1", "sv-water", 5), item("i3", "po-c2", "sv-water-c2", 5)]
  });

  await assert.rejects(inventoryService.orderPurchaseOrder(STAFF, "po-draft"), ForbiddenError);
  await assert.rejects(inventoryService.receivePurchaseOrder(STAFF, "po-draft"), ConflictError);
  await assert.rejects(inventoryService.receivePurchaseOrder(STAFF, "po-c2"), NotFoundError);
  await assert.rejects(inventoryService.cancelPurchaseOrder(STAFF, "po-c1"), ConflictError);

  const ordered = await inventoryService.orderPurchaseOrder(PARTNER, "po-draft");
  assert.equal(ordered?.status, "ORDERED");
  assert.equal(ordered?.orderedById, "u-owner");

  await inventoryService.receivePurchaseOrder(STAFF, "po-c1");
  assert.equal(store.stock.get("sv-water"), 5);
  assert.equal(store.stock.get("sv-water-c2"), undefined, "other courts' stock is untouched");
});

it("a receptionist may withdraw their own draft proposal", async () => {
  setup({ orders: [order("po-draft", "DRAFT"), order("po-draft-c2", "DRAFT", "c2")] });
  const withdrawn = await inventoryService.cancelPurchaseOrder(STAFF, "po-draft");
  assert.equal(withdrawn?.status, "CANCELLED");
  await assert.rejects(inventoryService.cancelPurchaseOrder(STAFF, "po-draft-c2"), NotFoundError);
});

it("a receptionist only lists their own court's orders", async () => {
  const listed: any[] = [];
  fake.setModels({
    purchaseOrder: {
      findMany: async ({ where }: any) => {
        listed.push(where);
        return [];
      }
    }
  });
  await inventoryService.listPurchaseOrders(STAFF, { courtId: "c2" });
  await inventoryService.listPurchaseOrders(PARTNER, { courtId: "c2", status: "ORDERED" });
  await inventoryService.listPurchaseOrders(PARTNER);
  assert.deepEqual(listed, [
    { partnerId: "p1", courtId: "c1" },
    { partnerId: "p1", courtId: "c2", status: "ORDERED" },
    { partnerId: "p1" }
  ]);
});

it("only drafts can be edited, and editing replaces the item list", async () => {
  const store = setup({
    orders: [order("po-draft", "DRAFT"), order("po-ordered", "ORDERED")],
    items: [item("i1", "po-draft", "sv-water", 10), item("i2", "po-ordered", "sv-water", 10)]
  });

  await assert.rejects(inventoryService.updatePurchaseOrder(PARTNER, "po-ordered", { items: [line("sv-towel", 2, 1000)] }), ConflictError);
  await assert.rejects(inventoryService.updatePurchaseOrder(PARTNER, "po-draft", { items: [line("sv-water-c2", 2, 1000)] }), ValidationError);

  const updated = await inventoryService.updatePurchaseOrder(STAFF, "po-draft", {
    supplierId: "11111111-1111-4111-8111-111111111111",
    items: [line("sv-towel", 2, 1500)]
  });
  assert.equal(updated?.totalAmount, 3000);
  assert.equal(updated?.supplierId, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(updated?.items.map((l) => [l.serviceId, l.quantity]), [["sv-towel", 2]]);
  assert.equal(store.stock.size, 0);
});

it("builds one draft per court from that court's reorder suggestions", async () => {
  const lowWater = {
    serviceId: "sv-water",
    serviceName: "Nước suối",
    unit: "chai",
    costPrice: 4000,
    courtId: "c1",
    courtName: "Cụm 1",
    quantity: 2,
    minimumStock: 5,
    totalSold: 0,
    saleCount: 0,
    firstSaleAt: null
  };
  const store = setup({ suggestionRows: [lowWater] });

  const draft = await inventoryService.createDraftFromSuggestions(STAFF, "c2");
  assert.ok(store.rawQueries[0].includes("c1"), "suggestions are read for the receptionist's own court");
  assert.equal(draft?.status, "DRAFT");
  assert.equal(draft?.courtId, "c1");
  // Not enough sales history: restock to twice the minimum (2 * 5 - 2 on hand).
  assert.deepEqual(draft?.items.map((l) => [l.serviceId, l.quantity, l.unitCost]), [["sv-water", 8, 4000]]);

  await assert.rejects(inventoryService.createDraftFromSuggestions(PARTNER), ValidationError);
  setup({ suggestionRows: [] });
  await assert.rejects(inventoryService.createDraftFromSuggestions(PARTNER, "c1"), ValidationError);
});
