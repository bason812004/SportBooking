import { prisma } from "../../config/db.js";
import { ensureServiceTables } from "../services/service.repository.js";
import type { AdjustStockInput, CreatePurchaseOrderInput, CreateSupplierInput } from "./inventory.types.js";

function purchaseOrderCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `PO${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

const INVENTORY_STATUS_HAVING: Record<string, string> = {
  LOW_STOCK: `AND COALESCE(si.quantity, 50) > 0 AND COALESCE(si.quantity, 50) <= COALESCE(si.minimum_stock, 5)`,
  OUT_OF_STOCK: `AND COALESCE(si.quantity, 50) = 0`
};

const INVENTORY_SORT_COLUMNS: Record<string, string> = {
  serviceName: "s.name",
  categoryName: "c.name",
  quantity: "COALESCE(si.quantity, 50)",
  costPrice: "COALESCE(s.cost_price, 0)",
  price: "s.price",
  stockValue: "COALESCE(si.quantity, 50) * COALESCE(s.cost_price, 0)"
};

const HAS_OWN_SERVICES_TTL_MS = 60_000;
const hasOwnServicesCache = new Map<string, { value: boolean; expiresAt: number }>();

async function hasOwnServicesCached(partnerId: string): Promise<boolean> {
  const cached = hasOwnServicesCache.get(partnerId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  const count = await prisma.service.count({ where: { partnerId, trackInventory: true } });
  hasOwnServicesCache.set(partnerId, { value: count > 0, expiresAt: now + HAS_OWN_SERVICES_TTL_MS });
  return count > 0;
}

export const inventoryRepository = {
  async getInventorySummary(
    partnerId: string,
    options: { page?: number; limit?: number; status?: string; search?: string; categoryId?: string; sortBy?: string; sortOrder?: string } = {}
  ) {
    await ensureServiceTables();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const offset = (page - 1) * limit;
    const statusClause = options.status ? INVENTORY_STATUS_HAVING[options.status] ?? "" : "";
    const sortColumn = (options.sortBy && INVENTORY_SORT_COLUMNS[options.sortBy]) || "s.name";
    const sortDirection = options.sortOrder === "desc" ? "DESC" : "ASC";

    try {
      // partnerId scope: if this partner genuinely has no tracked products yet, fall back to
      // showing all trackInventory services system-wide (dev/demo safety net) — same fallback
      // as before, just now paginated instead of dumping everything at once.
      const hasOwnServices = await hasOwnServicesCached(partnerId);

      const params: unknown[] = [];
      const conditions = ["s.track_inventory = true"];
      if (hasOwnServices) {
        params.push(partnerId);
        conditions.push(`s.partner_id = $${params.length}`);
      }
      if (options.search) {
        params.push(`%${options.search}%`);
        conditions.push(`s.name ILIKE $${params.length}`);
      }
      if (options.categoryId) {
        params.push(options.categoryId);
        conditions.push(`s.category_id = $${params.length}::uuid`);
      }
      const baseWhere = conditions.join(" AND ");

      const [summaryRows, itemRows] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `
          SELECT
            COUNT(*)::int as "totalProducts",
            COALESCE(SUM(COALESCE(si.quantity, 50)), 0)::int as "totalItems",
            COALESCE(SUM(COALESCE(si.quantity, 50) * COALESCE(s.cost_price, 0)), 0)::float as "totalStockValue",
            COUNT(*) FILTER (WHERE COALESCE(si.quantity, 50) > 0 AND COALESCE(si.quantity, 50) <= COALESCE(si.minimum_stock, 5))::int as "lowStockCount",
            COUNT(*) FILTER (WHERE COALESCE(si.quantity, 50) = 0)::int as "outOfStockCount"
          FROM services s
          LEFT JOIN service_categories c ON c.id = s.category_id
          LEFT JOIN service_inventories si ON si.service_id = s.id
          WHERE ${baseWhere};
          `,
          ...params
        ),
        prisma.$queryRawUnsafe<any[]>(
          `
          SELECT
            s.id as "serviceId", s.name as "serviceName", s.unit, s.price, s.cost_price as "costPrice",
            c.name as "categoryName",
            COALESCE(si.quantity, 50) as quantity,
            COALESCE(si.minimum_stock, 5) as "minimumStock",
            COUNT(*) OVER()::int as "filteredTotal"
          FROM services s
          LEFT JOIN service_categories c ON c.id = s.category_id
          LEFT JOIN service_inventories si ON si.service_id = s.id
          WHERE ${baseWhere} ${statusClause}
          ORDER BY ${sortColumn} ${sortDirection}
          LIMIT ${limit} OFFSET ${offset};
          `,
          ...params
        )
      ]);

      const summaryRow = summaryRows[0] ?? { totalProducts: 0, totalItems: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 };
      const items = itemRows.map((svc) => {
        const qty = Number(svc.quantity);
        const minStock = Number(svc.minimumStock);
        return {
          serviceId: svc.serviceId,
          serviceName: svc.serviceName,
          categoryName: svc.categoryName ?? "Khác",
          unit: svc.unit,
          quantity: qty,
          minimumStock: minStock,
          costPrice: Number(svc.costPrice ?? 0),
          price: Number(svc.price),
          stockValue: qty * Number(svc.costPrice ?? 0),
          status: qty === 0 ? "OUT_OF_STOCK" : qty <= minStock ? "LOW_STOCK" : "NORMAL"
        };
      });

      // COUNT(*) OVER() on the items query already reflects the status filter (if any),
      // avoiding a separate round-trip just to count matching rows for pagination.
      // Falls back to an explicit count only when the requested page has no rows
      // (e.g. a stale/out-of-range page), where the window function has nothing to report on.
      let total = statusClause ? Number(itemRows[0]?.filteredTotal ?? 0) : Number(summaryRow.totalProducts);
      if (statusClause && itemRows.length === 0) {
        total = Number(
          (
            await prisma.$queryRawUnsafe<any[]>(
              `SELECT COUNT(*)::int as count FROM services s LEFT JOIN service_inventories si ON si.service_id = s.id WHERE ${baseWhere} ${statusClause};`,
              ...params
            )
          )[0]?.count ?? 0
        );
      }

      return {
        summary: {
          totalProducts: Number(summaryRow.totalProducts),
          totalItems: Number(summaryRow.totalItems),
          totalStockValue: Number(summaryRow.totalStockValue),
          lowStockCount: Number(summaryRow.lowStockCount),
          outOfStockCount: Number(summaryRow.outOfStockCount)
        },
        items,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
      };
    } catch (err) {
      console.error("getInventorySummary error:", err);
      const rawRows: any = await prisma.$queryRawUnsafe(
        `
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
        LEFT JOIN service_inventories si ON s.id = si.service_id
        WHERE s.partner_id = $1 AND s.track_inventory = true
        ORDER BY s.name ASC
        LIMIT ${limit} OFFSET ${offset};
      `,
        partnerId
      ).catch(() => []);

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
        items,
        pagination: { page, limit, total: items.length, totalPages: 1 }
      };
    }
  },

  // Lightweight query for dashboard widgets — no consumption/velocity calc, just the
  // most urgent low/out-of-stock items, ordered out-of-stock first then lowest quantity first.
  async getLowStockAlerts(partnerId: string, limit = 5) {
    await ensureServiceTables();
    const hasOwnServices = await hasOwnServicesCached(partnerId);
    const params: unknown[] = [];
    const conditions = ["s.track_inventory = true", "COALESCE(si.quantity, 50) <= COALESCE(si.minimum_stock, 5)"];
    if (hasOwnServices) {
      params.push(partnerId);
      conditions.push(`s.partner_id = $${params.length}`);
    }
    const rows = await prisma
      .$queryRawUnsafe<any[]>(
        `
        SELECT s.id as "serviceId", s.name as "serviceName", s.unit,
          COALESCE(si.quantity, 50) as quantity,
          COALESCE(si.minimum_stock, 5) as "minimumStock"
        FROM services s
        LEFT JOIN service_inventories si ON si.service_id = s.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY (COALESCE(si.quantity, 50) = 0) DESC, COALESCE(si.quantity, 50) ASC
        LIMIT ${Math.max(1, Math.min(50, limit))};
        `,
        ...params
      )
      .catch(() => []);

    return rows.map((r) => {
      const quantity = Number(r.quantity);
      return {
        serviceId: r.serviceId,
        serviceName: r.serviceName,
        unit: r.unit,
        quantity,
        minimumStock: Number(r.minimumStock),
        status: quantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK"
      };
    });
  },

  // Estimates daily consumption from recent SALE transactions and flags products that
  // will run out soon, suggesting a reorder quantity to cover `coverDays` of demand.
  // Products without enough sales history are still surfaced when already low/out of
  // stock, but marked INSUFFICIENT_DATA with a conservative fallback quantity instead
  // of a velocity-based one (mirrors the demand-prediction module's INSUFFICIENT_DATA pattern).
  async getReorderSuggestions(partnerId: string, options: { windowDays?: number; coverDays?: number } = {}) {
    await ensureServiceTables();
    const windowDays = options.windowDays ?? 30;
    const coverDays = options.coverDays ?? 14;
    const MIN_SALE_COUNT = 3;
    const MIN_OBSERVED_DAYS = 7;

    const hasOwnServices = await hasOwnServicesCached(partnerId);
    const params: unknown[] = [windowDays];
    const conditions = ["s.track_inventory = true"];
    if (hasOwnServices) {
      params.push(partnerId);
      conditions.push(`s.partner_id = $${params.length}`);
    }

    const rows = await prisma
      .$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id as "serviceId", s.name as "serviceName", s.unit, s.cost_price as "costPrice",
          COALESCE(si.quantity, 50) as quantity,
          COALESCE(si.minimum_stock, 5) as "minimumStock",
          COALESCE(sold."totalSold", 0)::int as "totalSold",
          COALESCE(sold."saleCount", 0)::int as "saleCount",
          sold."firstSaleAt" as "firstSaleAt"
        FROM services s
        LEFT JOIN service_inventories si ON si.service_id = s.id
        LEFT JOIN (
          SELECT service_id,
            SUM(quantity)::int as "totalSold",
            COUNT(*)::int as "saleCount",
            MIN(created_at) as "firstSaleAt"
          FROM inventory_transactions
          WHERE type = 'SALE' AND created_at >= NOW() - ($1::text || ' days')::interval
          GROUP BY service_id
        ) sold ON sold.service_id = s.id
        WHERE ${conditions.join(" AND ")};
        `,
        ...params
      )
      .catch(() => []);

    const now = Date.now();
    const suggestions = rows.map((r) => {
      const quantity = Number(r.quantity);
      const minimumStock = Number(r.minimumStock);
      const saleCount = Number(r.saleCount);
      const totalSold = Number(r.totalSold);
      const firstSaleAt: Date | null = r.firstSaleAt ? new Date(r.firstSaleAt) : null;
      const observedDays = firstSaleAt ? Math.max(1, Math.min(windowDays, (now - firstSaleAt.getTime()) / 86_400_000)) : 0;
      const hasEnoughData = saleCount >= MIN_SALE_COUNT && observedDays >= MIN_OBSERVED_DAYS;
      const dailyRate = hasEnoughData ? totalSold / observedDays : 0;
      const daysRemaining = hasEnoughData && dailyRate > 0 ? quantity / dailyRate : null;

      const isLowOrOut = quantity <= minimumStock;
      const runningOutSoon = daysRemaining !== null && daysRemaining <= coverDays;
      if (!isLowOrOut && !runningOutSoon) return null;

      if (hasEnoughData) {
        const target = Math.max(minimumStock, Math.ceil(dailyRate * coverDays));
        return {
          serviceId: r.serviceId,
          serviceName: r.serviceName,
          unit: r.unit,
          costPrice: Number(r.costPrice ?? 0),
          quantity,
          minimumStock,
          dailyRate: Math.round(dailyRate * 100) / 100,
          daysRemaining: daysRemaining === null ? null : Math.round(daysRemaining * 10) / 10,
          suggestedQuantity: Math.max(1, target - quantity),
          status: "REORDER_SOON" as const
        };
      }

      // Not enough sales history to trust a velocity estimate, but stock is already
      // low/out — fall back to restocking to 2x the minimum safety stock.
      return {
        serviceId: r.serviceId,
        serviceName: r.serviceName,
        unit: r.unit,
        costPrice: Number(r.costPrice ?? 0),
        quantity,
        minimumStock,
        dailyRate: null,
        daysRemaining: null,
        suggestedQuantity: Math.max(1, minimumStock * 2 - quantity),
        status: "INSUFFICIENT_DATA" as const
      };
    });

    return suggestions
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "REORDER_SOON" ? -1 : 1;
        const aDays = a.daysRemaining ?? Infinity;
        const bDays = b.daysRemaining ?? Infinity;
        if (aDays !== bDays) return aDays - bDays;
        return a.quantity - b.quantity;
      });
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
