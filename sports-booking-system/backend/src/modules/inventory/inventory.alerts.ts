import { prisma } from "../../config/db.js";
import { notificationService } from "../notifications/notification.service.js";
import type { StockAlert } from "./inventory.stock.js";

/** One alert per product, the more serious one when a single order crossed both levels (cannot, but be safe). */
export function strongestAlerts(alerts: StockAlert[]) {
  const byService = new Map<string, StockAlert>();
  for (const alert of alerts) {
    const known = byService.get(alert.serviceId);
    if (!known || (alert.level === "OUT" && known.level !== "OUT") || (alert.level === known.level && alert.quantity < known.quantity)) {
      byService.set(alert.serviceId, alert);
    }
  }
  return [...byService.values()];
}

/** The bell notice for one product, in the partner's words. */
export function stockAlertNotice(alert: StockAlert, courtName: string | null) {
  const where = courtName ? ` tại ${courtName}` : "";
  return alert.level === "OUT"
    ? {
        title: `Hết hàng: ${alert.name}`,
        content: `${alert.name}${where} đã bán hết. Hãy nhập thêm hàng để nhân viên tiếp tục bán.`
      }
    : {
        title: `Sắp hết hàng: ${alert.name}`,
        content: `${alert.name}${where} chỉ còn ${alert.quantity} ${alert.unit} (mức tối thiểu ${alert.minimumStock}). Hãy nhập thêm hàng.`
      };
}

/**
 * Tells each partner which of their products a sale just took to the reorder level or out of stock (type STOCK_LOW;
 * the bell opens Nhập hàng). Called after the sale committed; a failure here never undoes the sale.
 */
export async function notifyStockAlerts(alerts: StockAlert[]) {
  if (!alerts.length) return;
  try {
    const items = strongestAlerts(alerts);
    const [partners, courts] = await Promise.all([
      prisma.partnerProfile.findMany({ where: { id: { in: [...new Set(items.map((item) => item.partnerId))] } }, select: { id: true, userId: true } }),
      prisma.court.findMany({
        where: { id: { in: [...new Set(items.map((item) => item.courtId).filter((id): id is string => Boolean(id)))] } },
        select: { id: true, name: true }
      })
    ]);
    const partnerUser = new Map(partners.map((partner) => [partner.id, partner.userId]));
    const courtName = new Map(courts.map((court) => [court.id, court.name]));
    await Promise.all(
      items.map((alert) => {
        const userId = partnerUser.get(alert.partnerId);
        if (!userId) return undefined;
        return notificationService.create({
          userId,
          type: "STOCK_LOW",
          ...stockAlertNotice(alert, alert.courtId ? courtName.get(alert.courtId) ?? null : null),
          metadata: {
            serviceId: alert.serviceId,
            courtId: alert.courtId,
            level: alert.level,
            quantity: alert.quantity,
            minimumStock: alert.minimumStock
          }
        });
      })
    );
  } catch (error) {
    console.error("[Inventory] Stock alert notification failed:", error);
  }
}
