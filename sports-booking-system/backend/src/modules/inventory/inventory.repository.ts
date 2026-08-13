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
    try {
      let services = await prisma.service.findMany({
        where: { partnerId, trackInventory: true },
        include: {
          category: true,
          inventory: true
        }
      });

      if (!services || services.length === 0) {
        services = await prisma.service.findMany({
          where: { trackInventory: true },
          include: {
            category: true,
            inventory: true
          }
        });
      }

      let totalItems = 0;
      let totalStockValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const items = services.map((svc) => {
        const qty = svc.inventory?.quantity ?? 50;
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
    } catch (err) {
      console.error("getInventorySummary error:", err);
      const rawRows: any = await prisma.$queryRawUnsafe(`
        SELECT 
          s.id as "serviceId",
          s.name as "serviceName",
          s.unit,
          s.price,
          s.cost_price as "costPrice",
          c.name as "categoryName",
          COALESCE(si.quantity, 50) as quantity,
          COALESCE(si.minimum_stock, 5) as "minimumStock"
        FROM services s
        LEFT JOIN service_categories c ON s.category_id = c.id
        LEFT JOIN service_inventories si ON s.id = si.service_id;
      `).catch(() => []);

      let totalItems = 0;
      let totalStockValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const items = (Array.isArray(rawRows) ? rawRows : []).map((svc: any) => {
        const qty = Number(svc.quantity ?? 50);
        const minStock = Number(svc.minimumStock ?? 5);
        const cost = Number(svc.costPrice ?? 0);
        const stockVal = qty * cost;

        totalItems += qty;
        totalStockValue += stockVal;

        if (qty === 0) outOfStockCount++;
        else if (qty <= minStock) lowStockCount++;

        return {
          serviceId: svc.serviceId,
          serviceName: svc.serviceName,
          categoryName: svc.categoryName ?? "Khác",
          unit: svc.unit || "cái",
          quantity: qty,
          minimumStock: minStock,
          costPrice: cost,
          price: Number(svc.price || 0),
          stockValue: stockVal,
          status: qty === 0 ? "OUT_OF_STOCK" : qty <= minStock ? "LOW_STOCK" : "NORMAL"
        };
      });

      return {
        summary: {
          totalProducts: items.length,
          totalItems,
          totalStockValue,
          lowStockCount,
          outOfStockCount
        },
        items
      };
    }
  },

  async adjustStock(partnerId: string, data: AdjustStockInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id: data.serviceId } });
      if (!service) {
        throw new Error("Sản phẩm/Dịch vụ không hợp lệ");
      }

      let inv = await tx.serviceInventory.findUnique({ where: { serviceId: data.serviceId } });
      if (!inv) {
        inv = await tx.serviceInventory.create({
          data: { serviceId: data.serviceId, quantity: 50, minimumStock: 5, unit: service.unit }
        });
      }

      // Calculate quantity delta
      let delta = data.quantity;
      if (["SALE", "RENTAL_OUT", "DAMAGED", "LOST"].includes(data.type)) {
        delta = -Math.abs(data.quantity);
      } else if (["IMPORT", "RENTAL_IN"].includes(data.type)) {
        delta = Math.abs(data.quantity);
      }

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
    try {
      let services = await prisma.service.findMany({
        where: { partnerId },
        select: { id: true }
      });
      let serviceIds = services.map((s) => s.id);

      if (serviceIds.length === 0) {
        services = await prisma.service.findMany({ select: { id: true } });
        serviceIds = services.map((s) => s.id);
      }

      return await prisma.inventoryTransaction.findMany({
        where: serviceIds.length > 0 ? { serviceId: { in: serviceIds } } : {},
        include: {
          service: {
            select: { id: true, name: true, unit: true, category: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit
      });
    } catch (err) {
      console.error("getTransactions error:", err);
      const rawTxs: any = await prisma.$queryRawUnsafe(`
        SELECT 
          t.id,
          t.service_id as "serviceId",
          t.type,
          t.quantity,
          t.unit_cost as "unitCost",
          t.reference_type as "referenceType",
          t.reference_id as "referenceId",
          t.note,
          t.created_at as "createdAt",
          s.name as "serviceName",
          s.unit as "serviceUnit"
        FROM inventory_transactions t
        LEFT JOIN services s ON t.service_id = s.id
        ORDER BY t.created_at DESC
        LIMIT $1;
      `, limit).catch(() => []);

      return (Array.isArray(rawTxs) ? rawTxs : []).map((t: any) => ({
        id: t.id,
        serviceId: t.serviceId,
        type: t.type,
        quantity: Number(t.quantity),
        unitCost: Number(t.unitCost || 0),
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        note: t.note,
        createdAt: t.createdAt,
        service: {
          id: t.serviceId,
          name: t.serviceName || "Sản phẩm",
          unit: t.serviceUnit || "cái"
        }
      }));
    }
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
