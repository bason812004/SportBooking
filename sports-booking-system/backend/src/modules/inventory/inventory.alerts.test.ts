import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import type { StockAlert } from "./inventory.stock.js";

let sent: any[];
mock.module("../../config/db.js", { namedExports: { prisma: {
  partnerProfile: { findMany: async () => [{ id: "p1", userId: "u0002" }] },
  court: { findMany: async () => [{ id: "c1", name: "Sân A" }] }
} } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (input: any) => {
    sent.push(input);
    return input;
  }
} } });
const { notifyStockAlerts, stockAlertNotice, strongestAlerts } = await import("./inventory.alerts.js");

const alert = (extra: Partial<StockAlert>): StockAlert => ({
  serviceId: "sv1",
  name: "Nước suối",
  unit: "chai",
  courtId: "c1",
  partnerId: "p1",
  quantity: 4,
  minimumStock: 5,
  level: "LOW",
  ...extra
});

beforeEach(() => {
  sent = [];
});

describe("stock alerts", () => {
  it("one notice per product, the more serious one", () => {
    const kept = strongestAlerts([alert({}), alert({ level: "OUT", quantity: 0 }), alert({ serviceId: "sv2", name: "Khăn" })]);
    assert.deepEqual(kept.map((item) => [item.serviceId, item.level]), [["sv1", "OUT"], ["sv2", "LOW"]]);
  });

  it("says what is left, where, and to buy more", () => {
    assert.deepEqual(stockAlertNotice(alert({}), "Sân A"), {
      title: "Sắp hết hàng: Nước suối",
      content: "Nước suối tại Sân A chỉ còn 4 chai (mức tối thiểu 5). Hãy nhập thêm hàng."
    });
    assert.equal(stockAlertNotice(alert({ level: "OUT", quantity: 0 }), null).title, "Hết hàng: Nước suối");
  });

  it("goes to the partner's account as STOCK_LOW, with what the bell needs", async () => {
    await notifyStockAlerts([alert({ level: "OUT", quantity: 0 })]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].userId, "u0002");
    assert.equal(sent[0].type, "STOCK_LOW");
    assert.match(sent[0].content, /Sân A đã bán hết/);
    assert.deepEqual(sent[0].metadata, { serviceId: "sv1", courtId: "c1", level: "OUT", quantity: 0, minimumStock: 5 });
  });

  it("nothing to tell, nothing sent", async () => {
    await notifyStockAlerts([]);
    assert.equal(sent.length, 0);
  });
});
