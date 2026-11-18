import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

let scope: { partnerId: string; managedCourtId: string | null };
let service: any;
let calls: unknown[][];
let lastChanges: any[] | Error;

mock.module("./service.repository.js", { namedExports: { serviceRepository: {
  partnerScope: async () => scope,
  findServiceById: async () => service,
  partnerCourts: async (_partnerId: string, courtIds: string[]) => courtIds.map((id) => ({ id })),
  sameNameAtCourts: async () => [],
  updateService: async (id: string, data: unknown, actorId: unknown) => {
    calls.push(["update", id, data, actorId]);
    return { ...service, ...(data as object) };
  },
  createService: async (partnerId: string, data: any, actorId: unknown) => {
    calls.push(["create", partnerId, data.courtIds, actorId]);
    return [];
  },
  applyImageToPartnerServices: async () => undefined,
  listPartnerServices: async () => [{ id: "sv0001", name: "Nước suối" }, { id: "sv0002", name: "Vợt thuê" }],
  lastPriceChanges: async (ids: string[]) => {
    calls.push(["last", ids]);
    if (lastChanges instanceof Error) throw lastChanges;
    return lastChanges;
  },
  priceHistory: async (id: string) => {
    calls.push(["history", id]);
    return [
      {
        id: "sph00003",
        kind: "CHANGED",
        oldPrice: "10000",
        newPrice: "12000",
        oldCostPrice: "6000",
        newCostPrice: "6000",
        changedAt: new Date("2026-11-06T08:00:00Z"),
        changedById: "u0002",
        changedByName: "Đối tác 1"
      }
    ];
  }
} } });
const { serviceService } = await import("./service.service.js");

beforeEach(() => {
  scope = { partnerId: "p1", managedCourtId: null };
  service = { id: "sv0001", partnerId: "p1", courtId: "c1", name: "Nước suối", court: { id: "c1", name: "Sân A" } };
  calls = [];
  lastChanges = [{ serviceId: "sv0001", kind: "CHANGED", changedAt: new Date("2026-11-06T08:00:00Z") }];
});

describe("price changes are recorded with who made them", () => {
  it("passes the editing user down with the update", async () => {
    await serviceService.updateService("p1", "sv0001", { price: 12000 }, "u0002");
    assert.deepEqual(calls, [["update", "sv0001", { price: 12000, courtId: undefined }, "u0002"]]);
  });

  it("and with a new service, for its starting price", async () => {
    await serviceService.createService("p1", { name: "Nước suối", type: "PRODUCT", price: 10000, courtIds: ["c1", "c1"] } as any, "u0002");
    assert.deepEqual(calls, [["create", "p1", ["c1"], "u0002"]]);
  });
});

describe("catalog cards carry the latest price line", () => {
  it("adds kind and time to each service, null when it has none", async () => {
    const list = await serviceService.listPartnerServices("p1");
    assert.deepEqual(calls, [["last", ["sv0001", "sv0002"]]]);
    assert.deepEqual(
      list.map((item: any) => [item.id, item.lastPriceChange]),
      [
        ["sv0001", { kind: "CHANGED", changedAt: "2026-11-06T08:00:00.000Z" }],
        ["sv0002", null]
      ]
    );
  });

  it("still lists the catalog when the history cannot be read", async () => {
    lastChanges = new Error("relation does not exist");
    const original = console.error;
    console.error = () => undefined;
    try {
      const list = await serviceService.listPartnerServices("p1");
      assert.equal(list.length, 2);
      assert.ok(list.every((item: any) => item.lastPriceChange === null));
    } finally {
      console.error = original;
    }
  });
});

describe("price history", () => {
  it("the owner sees it, newest first, with the service it belongs to", async () => {
    const result = await serviceService.priceHistory("u0002", "sv0001");
    assert.deepEqual(result.service, { id: "sv0001", name: "Nước suối", court: { id: "c1", name: "Sân A" } });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].oldPrice, 10000);
    assert.equal(result.entries[0].newPrice, 12000);
    assert.equal(result.entries[0].priceChanged, true);
    assert.equal(result.entries[0].costPriceChanged, false);
  });

  it("staff see it for the court they manage", async () => {
    scope = { partnerId: "p1", managedCourtId: "c1" };
    const result = await serviceService.priceHistory("u0005", "sv0001");
    assert.equal(result.entries.length, 1);
  });

  it("another partner's service, or another court's for staff, is not found", async () => {
    scope = { partnerId: "p2", managedCourtId: null };
    await assert.rejects(serviceService.priceHistory("u0009", "sv0001"), /không tồn tại/);
    scope = { partnerId: "p1", managedCourtId: "c2" };
    await assert.rejects(serviceService.priceHistory("u0005", "sv0001"), /không tồn tại/);
    service = null;
    scope = { partnerId: "p1", managedCourtId: null };
    await assert.rejects(serviceService.priceHistory("u0002", "sv9999"), /không tồn tại/);
    assert.deepEqual(calls, []);
  });
});
