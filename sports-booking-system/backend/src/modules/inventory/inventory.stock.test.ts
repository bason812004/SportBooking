import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  freeStock,
  groupMoves,
  releaseBookingStock,
  returnStock,
  stockLevelCrossed,
  stockStillTaken,
  takeStock,
  type StockAlert,
  type StockServiceInfo
} from "./inventory.stock.js";

/** A transaction that answers from in-memory stock and ledger rows and records every statement, in order. */
function fakeTx(state: {
  stock: Record<string, { quantity: number; reservedQuantity: number; minimumStock: number }>;
  ledger?: Array<{ serviceId: string; bookingId: string; type: string; quantity: number }>;
  lines?: Array<{ id: string; serviceId: string | null; quantity: number }>;
  services?: StockServiceInfo[];
}) {
  const log: Array<{ sql: string; params: unknown[] }> = [];
  const tx: any = {
    log,
    async $queryRawUnsafe(sql: string, ...params: unknown[]) {
      log.push({ sql, params });
      if (sql.includes("FROM services s")) {
        const ids = params[0] as string[];
        return (state.services ?? []).filter((service) => ids.includes(service.id));
      }
      if (sql.includes("FROM service_inventories")) {
        const row = state.stock[params[0] as string];
        return row ? [{ ...row }] : [];
      }
      if (sql.includes("FROM inventory_transactions")) {
        return (state.ledger ?? []).filter((line) => line.bookingId === params[0] && line.serviceId === params[1]);
      }
      if (sql.includes("FROM booking_services")) return state.lines ?? [];
      return [];
    },
    async $executeRawUnsafe(sql: string, ...params: unknown[]) {
      log.push({ sql, params });
      if (sql.startsWith("INSERT INTO service_inventories")) {
        state.stock[params[0] as string] ??= { quantity: 0, reservedQuantity: 0, minimumStock: 5 };
        return 1;
      }
      if (sql.includes("UPDATE rental_items")) return params[1] as number;
      return 1;
    }
  };
  return tx;
}

const product = (id: string, extra: Partial<StockServiceInfo> = {}): StockServiceInfo => ({
  id,
  name: `Món ${id}`,
  type: "PRODUCT",
  trackInventory: true,
  unit: "chai",
  costPrice: "6000.00",
  courtId: "c1",
  partnerId: "p1",
  ...extra
});
const rental = (id: string): StockServiceInfo => product(id, { type: "RENTAL_SERVICE", name: `Vợt ${id}`, unit: "cây" });
const reference = { referenceType: "BOOKING_SERVICE", referenceId: "bk1", note: "Bán dịch vụ" };
const statements = (tx: any, part: string) => tx.log.filter((entry: any) => entry.sql.includes(part));

describe("the rules", () => {
  it("adds up the same service across lines, drops empty moves, sorts by service id", () => {
    const groups = groupMoves([
      { serviceId: "sv2", quantity: 1, bookingServiceId: "bs1" },
      { serviceId: "sv1", quantity: 2, bookingServiceId: "bs2" },
      { serviceId: "sv2", quantity: 3, bookingServiceId: "bs3" },
      { serviceId: "sv3", quantity: 0 },
      { serviceId: null, quantity: 4 }
    ]);
    assert.deepEqual(groups.map((group) => [group.serviceId, group.quantity, group.lines.length]), [["sv1", 2, 1], ["sv2", 4, 2]]);
  });

  it("warns once, on the sale that crosses the level", () => {
    assert.equal(stockLevelCrossed(8, 5, 5), "LOW");
    assert.equal(stockLevelCrossed(5, 4, 5), null);
    assert.equal(stockLevelCrossed(3, 0, 5), "OUT");
    assert.equal(stockLevelCrossed(9, 0, 5), "OUT");
    assert.equal(stockLevelCrossed(0, 0, 5), null);
  });

  it("what is free leaves out rental pieces that are out", () => {
    assert.equal(freeStock({ quantity: 10, reservedQuantity: 3 }), 7);
  });

  it("a booking can give back only what it took and has not returned", () => {
    assert.equal(stockStillTaken([{ type: "SALE", quantity: 3 }, { type: "ADJUSTMENT", quantity: 1 }]), 2);
    assert.equal(stockStillTaken([{ type: "RENTAL_OUT", quantity: 2 }]), 2);
    assert.equal(stockStillTaken([]), 0);
    assert.equal(stockStillTaken([{ type: "ADJUSTMENT", quantity: 4 }]), 0);
  });
});

describe("takeStock", () => {
  let alerts: StockAlert[];
  beforeEach(() => {
    alerts = [];
  });

  it("takes a counted product off stock, writes the sale at cost price, under a row lock", async () => {
    const tx = fakeTx({ stock: { sv1: { quantity: 10, reservedQuantity: 0, minimumStock: 5 } } });
    await takeStock(tx, [{ serviceId: "sv1", quantity: 3, bookingServiceId: "bs1" }], reference, { services: [product("sv1")], alerts });
    assert.ok(statements(tx, "FOR UPDATE").length === 1);
    const update = statements(tx, "SET quantity = quantity - $1")[0];
    assert.deepEqual(update.params, [3, "sv1"]);
    const sale = statements(tx, "INSERT INTO inventory_transactions")[0];
    assert.match(sale.sql, /'SALE'/);
    assert.deepEqual(sale.params, ["sv1", 3, 6000, "BOOKING_SERVICE", "bk1", "Bán dịch vụ"]);
    assert.deepEqual(alerts, []);
  });

  it("refuses the whole sale when one product has too little free, before writing anything", async () => {
    const tx = fakeTx({
      stock: {
        sv1: { quantity: 10, reservedQuantity: 0, minimumStock: 5 },
        sv2: { quantity: 1, reservedQuantity: 0, minimumStock: 5 }
      }
    });
    await assert.rejects(
      takeStock(tx, [{ serviceId: "sv2", quantity: 2 }, { serviceId: "sv1", quantity: 1 }], reference, { services: [product("sv1"), product("sv2")] }),
      /Món sv2.*không đủ tồn kho \(Còn lại: 1\)/
    );
    // sv1 comes first (id order) and was written, but the error rolls the caller's transaction back as a whole.
    assert.equal(statements(tx, "SET quantity = quantity - $1").filter((entry: any) => entry.params[1] === "sv2").length, 0);
  });

  it("locks rows in service id order whatever the order of the lines", async () => {
    const tx = fakeTx({
      stock: {
        sv1: { quantity: 10, reservedQuantity: 0, minimumStock: 0 },
        sv9: { quantity: 10, reservedQuantity: 0, minimumStock: 0 }
      }
    });
    await takeStock(tx, [{ serviceId: "sv9", quantity: 1 }, { serviceId: "sv1", quantity: 1 }], reference, { services: [product("sv1"), product("sv9")] });
    assert.deepEqual(statements(tx, "FOR UPDATE").map((entry: any) => entry.params[0]), ["sv1", "sv9"]);
  });

  it("a product without a stock row starts at 0, so it cannot be sold", async () => {
    const tx = fakeTx({ stock: {} });
    await assert.rejects(takeStock(tx, [{ serviceId: "sv1", quantity: 1 }], reference, { services: [product("sv1")] }), /Còn lại: 0/);
    assert.equal(statements(tx, "INSERT INTO service_inventories").length, 1);
  });

  it("tells the partner when the sale crosses the reorder level or runs out", async () => {
    const tx = fakeTx({
      stock: {
        sv1: { quantity: 7, reservedQuantity: 0, minimumStock: 5 },
        sv2: { quantity: 2, reservedQuantity: 0, minimumStock: 5 }
      }
    });
    await takeStock(tx, [{ serviceId: "sv1", quantity: 3 }, { serviceId: "sv2", quantity: 2 }], reference, { services: [product("sv1"), product("sv2")], alerts });
    assert.deepEqual(
      alerts.map((alert) => [alert.serviceId, alert.level, alert.quantity, alert.minimumStock, alert.partnerId]),
      [["sv1", "LOW", 4, 5, "p1"], ["sv2", "OUT", 0, 5, "p1"]]
    );
  });

  it("holds rental gear (not taken off stock) and records a piece per item, per line", async () => {
    const tx = fakeTx({ stock: { sv5: { quantity: 4, reservedQuantity: 1, minimumStock: 0 } } });
    await takeStock(
      tx,
      [{ serviceId: "sv5", quantity: 2, bookingServiceId: "bsA" }, { serviceId: "sv5", quantity: 1, bookingServiceId: "bsB" }],
      reference,
      { services: [rental("sv5")] }
    );
    assert.deepEqual(statements(tx, "reserved_quantity = reserved_quantity + $1")[0].params, [3, "sv5"]);
    assert.equal(statements(tx, "SET quantity = quantity - $1").length, 0);
    assert.deepEqual(statements(tx, "INSERT INTO rental_items").map((entry: any) => entry.params[0]), ["bsA", "bsA", "bsB"]);
  });

  it("refuses gear when too few pieces are free", async () => {
    const tx = fakeTx({ stock: { sv5: { quantity: 4, reservedQuantity: 3, minimumStock: 0 } } });
    await assert.rejects(takeStock(tx, [{ serviceId: "sv5", quantity: 2, bookingServiceId: "bsA" }], reference, { services: [rental("sv5")] }), /chỉ còn 1 để cho thuê/);
  });

  it("does nothing for a product that is not counted, or a line of the old court catalog", async () => {
    const tx = fakeTx({ stock: {}, services: [] });
    await takeStock(tx, [{ serviceId: "sv1", quantity: 2 }, { serviceId: "cs_old", quantity: 1 }], reference, {
      services: [product("sv1", { trackInventory: false })]
    });
    assert.equal(statements(tx, "service_inventories").length, 0);
  });

  it("looks the services up when the caller did not pass them", async () => {
    const tx = fakeTx({ stock: { sv1: { quantity: 3, reservedQuantity: 0, minimumStock: 0 } }, services: [product("sv1")] });
    await takeStock(tx, [{ serviceId: "sv1", quantity: 1 }], reference);
    assert.equal(statements(tx, "FROM services s").length, 1);
    assert.equal(statements(tx, "SET quantity = quantity - $1").length, 1);
  });
});

describe("returnStock", () => {
  it("gives back at most what the booking took", async () => {
    const tx = fakeTx({
      stock: { sv1: { quantity: 2, reservedQuantity: 0, minimumStock: 5 } },
      ledger: [
        { serviceId: "sv1", bookingId: "bk1", type: "SALE", quantity: 3 },
        { serviceId: "sv1", bookingId: "bk1", type: "ADJUSTMENT", quantity: 1 }
      ]
    });
    await returnStock(tx, [{ serviceId: "sv1", quantity: 5, bookingServiceId: "bs1" }], reference, { services: [product("sv1")] });
    assert.deepEqual(statements(tx, "SET quantity = quantity + $1")[0].params, [2, "sv1"]);
    const back = statements(tx, "INSERT INTO inventory_transactions")[0];
    assert.match(back.sql, /'ADJUSTMENT'/);
    assert.equal(back.params[1], 2);
  });

  it("gives back nothing for a line that never took stock (an old online booking)", async () => {
    const tx = fakeTx({ stock: { sv1: { quantity: 2, reservedQuantity: 0, minimumStock: 5 } }, ledger: [] });
    await returnStock(tx, [{ serviceId: "sv1", quantity: 3, bookingServiceId: "bs1" }], reference, { services: [product("sv1")] });
    assert.equal(statements(tx, "SET quantity = quantity + $1").length, 0);
    assert.equal(statements(tx, "INSERT INTO inventory_transactions").length, 0);
  });

  it("brings rental pieces back and frees their hold", async () => {
    const tx = fakeTx({ stock: { sv5: { quantity: 4, reservedQuantity: 2, minimumStock: 0 } } });
    await returnStock(tx, [{ serviceId: "sv5", quantity: 2, bookingServiceId: "bsA" }], reference, { services: [rental("sv5")] });
    assert.deepEqual(statements(tx, "UPDATE rental_items")[0].params, ["bsA", 2, "Bán dịch vụ"]);
    assert.deepEqual(statements(tx, "reserved_quantity = GREATEST(reserved_quantity - $1, 0)")[0].params, [2, 0, "sv5"]);
  });

  it("gear taken off stock by an old booking (RENTAL_OUT) goes back on stock", async () => {
    const tx = fakeTx({
      stock: { sv5: { quantity: 3, reservedQuantity: 0, minimumStock: 0 } },
      ledger: [{ serviceId: "sv5", bookingId: "bk1", type: "RENTAL_OUT", quantity: 1 }]
    });
    await returnStock(tx, [{ serviceId: "sv5", quantity: 1, bookingServiceId: "bsA" }], reference, { services: [rental("sv5")] });
    assert.deepEqual(statements(tx, "SET quantity = quantity + $1")[0].params, [1, "sv5"]);
  });
});

describe("releaseBookingStock", () => {
  it("closes the booking's open lines and gives their stock back, in the caller's transaction", async () => {
    const tx = fakeTx({
      stock: { sv1: { quantity: 1, reservedQuantity: 0, minimumStock: 5 } },
      ledger: [{ serviceId: "sv1", bookingId: "bk7", type: "SALE", quantity: 2 }],
      lines: [{ id: "bs1", serviceId: "sv1", quantity: 2 }],
      services: [product("sv1")]
    });
    const count = await releaseBookingStock(tx, "bk7", "Tự động trả do đơn bị huỷ", "BOOKING_CANCELLED");
    assert.equal(count, 1);
    assert.match(statements(tx, "FROM booking_services")[0].sql, /FOR UPDATE/);
    assert.deepEqual(statements(tx, "SET status = 'CANCELLED'")[0].params, [["bs1"]]);
    assert.deepEqual(statements(tx, "SET quantity = quantity + $1")[0].params, [2, "sv1"]);
    const back = statements(tx, "INSERT INTO inventory_transactions")[0];
    assert.deepEqual(back.params.slice(3), ["BOOKING_CANCELLED", "bk7", "Tự động trả do đơn bị huỷ"]);
  });

  it("a booking without open lines changes nothing", async () => {
    const tx = fakeTx({ stock: {}, lines: [] });
    assert.equal(await releaseBookingStock(tx, "bk7", "x", "BOOKING_NO_SHOW"), 0);
    assert.equal(tx.log.filter((entry: any) => !entry.sql.includes("FROM booking_services")).length, 0);
  });
});
