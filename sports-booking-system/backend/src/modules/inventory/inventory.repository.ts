import { prisma } from "../../config/db.js";
import { ensureServiceTables } from "../services/service.repository.js";
import type { AdjustStockInput, CreatePurchaseOrderInput, CreateSupplierInput } from "./inventory.types.js";

function purchaseOrderCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `PO${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

export const inventoryRepository = {
  async getInventorySummary(partnerId: string, courtId?: string) {
    await ensureServiceTables();
    try {
      let rawRows: any[] = [];

      if (courtId && courtId.trim() !== "") {
        rawRows = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT ON (s.name)
            s.id as "serviceId",
            s.court_id as "courtId",
            s.name as "serviceName",
            s.unit,
            s.price,
            s.cost_price as "costPrice",
            c.name as "categoryName",
            COALESCE(si.quantity, 50) as quantity,
            COALESCE(si.minimum_stock, 5) as "minimumStock"
          FROM services s
          LEFT JOIN service_categories c ON s.category_id = c.id
          LEFT JOIN service_inventories si ON s.id = si.service_id
          WHERE s.court_id = $1 AND (s.status = 'ACTIVE' OR s.status IS NULL)
          ORDER BY s.name, s.created_at DESC;
        `, courtId).catch(() => []);
      } else {
        rawRows = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT ON (s.name)
            s.id as "serviceId",
            s.court_id as "courtId",
            s.name as "serviceName",
            s.unit,
            s.price,
            s.cost_price as "costPrice",
            c.name as "categoryName",
            COALESCE(si.quantity, 50) as quantity,
            COALESCE(si.minimum_stock, 5) as "minimumStock"
          FROM services s
          LEFT JOIN service_categories c ON s.category_id = c.id
          LEFT JOIN service_inventories si ON s.id = si.service_id
          WHERE (s.status = 'ACTIVE' OR s.status IS NULL)
            AND ($1::text IS NULL OR $1::text = '' OR s.partner_id = $1 OR s.court_id IN (SELECT id FROM courts WHERE partner_id = $1))
          ORDER BY s.name, s.created_at DESC;
        `, partnerId || "").catch(() => []);
      }

      const seenNames = new Set<string>();
      const items: any[] = [];
      let totalItems = 0;
      let totalStockValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const r of rawRows || []) {
        if (!r || !r.serviceName) continue;
        const key = String(r.serviceName).trim().toLowerCase();
        if (!key || seenNames.has(key)) continue;
        seenNames.add(key);

        const qty = Number(r.quantity ?? 50);
        const minStock = Number(r.minimumStock ?? 5);
        const cost = Number(r.costPrice ?? 0);
        const stockVal = qty * cost;

        totalItems += qty;
        totalStockValue += stockVal;

        if (qty === 0) outOfStockCount++;
        else if (qty <= minStock) lowStockCount++;

        items.push({
          serviceId: r.serviceId,
          courtId: r.courtId,
          serviceName: r.serviceName,
          categoryName: r.categoryName ?? "Khác",
          unit: r.unit || "cái",
          quantity: qty,
          minimumStock: minStock,
          costPrice: cost,
          price: Number(r.price),
          stockValue: stockVal,
          status: qty === 0 ? "OUT_OF_STOCK" : qty <= minStock ? "LOW_STOCK" : "NORMAL"
        });
      }

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
    } catch (err) {
      console.error("getInventorySummary error:", err);
      return {
        summary: { totalProducts: 0, totalItems: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 },
        items: []
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
