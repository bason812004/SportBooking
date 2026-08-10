import { prisma } from "../../config/db.js";
import { ensureServiceTables } from "../services/service.repository.js";
import type { AdjustStockInput, CreatePurchaseOrderInput, CreateSupplierInput } from "./inventory.types.js";

function purchaseOrderCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `PO${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

export const inventoryRepository = {
  async getInventorySummary(partnerId: string) {
    await ensureServiceTables();
    const services = await prisma.service.findMany({
      where: { partnerId, trackInventory: true },
      include: {
        category: true,
        inventory: true
      }
    });

    let totalItems = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const items = services.map((svc) => {
      const qty = svc.inventory?.quantity ?? 0;
      const minStock = svc.inventory?.minimumStock ?? 5;
      const cost = Number(svc.costPrice ?? 0);
      const stockVal = qty * cost;

      totalItems += qty;
      totalStockValue += stockVal;

      if (qty === 0) outOfStockCount++;
      else if (qty <= minStock) lowStockCount++;

      return {
        serviceId: svc.id,
        serviceName: svc.name,
        categoryName: svc.category?.name ?? "Khác",
        unit: svc.unit,
        quantity: qty,
        minimumStock: minStock,
        costPrice: cost,
        price: Number(svc.price),
        stockValue: stockVal,
        status: qty === 0 ? "OUT_OF_STOCK" : qty <= minStock ? "LOW_STOCK" : "NORMAL"
      };
    });

    return {
      summary: {
        totalProducts: services.length,
        totalItems,
        totalStockValue,
        lowStockCount,
        outOfStockCount
      },
      items
    };
  },

  async adjustStock(partnerId: string, data: AdjustStockInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id: data.serviceId } });
      if (!service || service.partnerId !== partnerId) {
        throw new Error("Sản phẩm/Dịch vụ không hợp lệ");
      }

      let inv = await tx.serviceInventory.findUnique({ where: { serviceId: data.serviceId } });
      if (!inv) {
        inv = await tx.serviceInventory.create({
          data: { serviceId: data.serviceId, quantity: 0, minimumStock: 5, unit: service.unit }
        });
      }

      // Calculate quantity delta
      let delta = data.quantity;
      if (["SALE", "RENTAL_OUT", "DAMAGED", "LOST"].includes(data.type)) {
        delta = -Math.abs(data.quantity);
      } else if (["IMPORT", "RENTAL_IN"].includes(data.type)) {
        delta = Math.abs(data.quantity);
      } // ADJUSTMENT uses quantity directly

      const newQty = Math.max(0, data.type === "ADJUSTMENT" ? data.quantity : inv.quantity + delta);

      await tx.serviceInventory.update({
        where: { serviceId: data.serviceId },
        data: {
          quantity: newQty,
          ...(data.unitCost && data.unitCost > 0 ? { lastPurchasePrice: data.unitCost } : {})
        }
      });

      if (data.unitCost && data.unitCost > 0) {
        await tx.service.update({
          where: { id: data.serviceId },
          data: { costPrice: data.unitCost }
        });
      }

      const txLog = await tx.inventoryTransaction.create({
        data: {
          serviceId: data.serviceId,
          type: data.type as any,
          quantity: data.quantity,
          unitCost: data.unitCost ?? Number(service.costPrice),
          referenceType: "MANUAL_ADJUSTMENT",
          note: data.note ?? null
        }
      });

      return {
        serviceId: data.serviceId,
        previousQuantity: inv.quantity,
        newQuantity: newQty,
        transaction: txLog
      };
    });
  },

  async getTransactions(partnerId: string, limit = 50) {
    await ensureServiceTables();
    const services = await prisma.service.findMany({
      where: { partnerId },
      select: { id: true }
    });
    const serviceIds = services.map((s) => s.id);

    return prisma.inventoryTransaction.findMany({
      where: { serviceId: { in: serviceIds } },
      include: {
        service: {
          select: { id: true, name: true, unit: true, category: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  },

  // Supplier & Purchase Order Management
  async listSuppliers(partnerId: string) {
    await ensureServiceTables();
    return prisma.supplier.findMany({
      where: { partnerId },
      orderBy: { name: "asc" }
    });
  },

  async createSupplier(partnerId: string, data: CreateSupplierInput) {
    await ensureServiceTables();
    return prisma.supplier.create({
      data: { partnerId, ...data }
    });
  },

  async createPurchaseOrder(partnerId: string, data: CreatePurchaseOrderInput) {
    await ensureServiceTables();
    const poCode = purchaseOrderCode();
    let grandTotal = 0;

    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          partnerId,
          supplierId: data.supplierId ?? null,
          orderCode: poCode,
          totalAmount: 0,
          status: "COMPLETED",
          note: data.note ?? null
        }
      });

      for (const item of data.items) {
        const itemTotal = item.quantity * item.unitCost;
        grandTotal += itemTotal;

        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: po.id,
            serviceId: item.serviceId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalPrice: itemTotal
          }
        });

        // Update inventory & cost price
        const inv = await tx.serviceInventory.findUnique({ where: { serviceId: item.serviceId } });
        if (inv) {
          await tx.serviceInventory.update({
            where: { serviceId: item.serviceId },
            data: {
              quantity: inv.quantity + item.quantity,
              lastPurchasePrice: item.unitCost
            }
          });
        }

        await tx.service.update({
          where: { id: item.serviceId },
          data: { costPrice: item.unitCost }
        });

        await tx.inventoryTransaction.create({
          data: {
            serviceId: item.serviceId,
            type: "IMPORT",
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: "PURCHASE_ORDER",
            referenceId: po.id,
            note: `Nhập hàng đơn #${poCode}`
          }
        });
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { totalAmount: grandTotal }
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: {
          supplier: true,
          items: { include: { service: true } }
        }
      });
    });
  },

  async listPurchaseOrders(partnerId: string) {
    await ensureServiceTables();
    return prisma.purchaseOrder.findMany({
      where: { partnerId },
      include: {
        supplier: true,
        items: { include: { service: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }
};
