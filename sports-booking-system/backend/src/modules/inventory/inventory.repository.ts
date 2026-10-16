import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { ensureServiceTables } from "../services/service.repository.js";
import type {
  AdjustStockInput,
  CreatePurchaseOrderInput,
  CreateSupplierInput,
  PurchaseOrderItemInput,
  PurchaseOrderListFilter,
  PurchaseOrderScope,
  PurchaseOrderStatus,
  ReceivePurchaseOrderInput,
  UpdatePurchaseOrderInput
} from "./inventory.types.js";

function purchaseOrderCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `PO${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

const INVENTORY_STATUS_HAVING: Record<string, string> = {
  LOW_STOCK: `AND COALESCE(si.quantity, 0) > 0 AND COALESCE(si.quantity, 0) <= COALESCE(si.minimum_stock, 5)`,
  OUT_OF_STOCK: `AND COALESCE(si.quantity, 0) = 0`
};

const INVENTORY_SORT_COLUMNS: Record<string, string> = {
  serviceName: "s.name",
  categoryName: "c.name",
  courtName: "ct.name",
  quantity: "COALESCE(si.quantity, 0)",
  costPrice: "COALESCE(s.cost_price, 0)",
  price: "s.price",
  stockValue: "COALESCE(si.quantity, 0) * COALESCE(s.cost_price, 0)"
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

const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "nháp",
  ORDERED: "đã đặt hàng",
  COMPLETED: "đã nhận hàng",
  CANCELLED: "đã hủy"
};

const person = { select: { id: true, fullName: true } } as const;

const purchaseOrderInclude = {
  supplier: true,
  court: { select: { id: true, name: true, address: true } },
  createdBy: person,
  orderedBy: person,
  receivedBy: person,
  cancelledBy: person,
  items: { include: { service: true } }
} satisfies Prisma.PurchaseOrderInclude;

/** Restricts a purchase-order lookup to the actor's partner and, for a receptionist, their court. */
function scopedOrderWhere(scope: PurchaseOrderScope, id: string): Prisma.PurchaseOrderWhereInput {
  return { id, partnerId: scope.partnerId, ...(scope.courtId ? { courtId: scope.courtId } : {}) };
}

/**
 * Every purchase order restocks exactly one court (cụm sân): stock is kept per court, and each
 * address is ordered for and audited separately. Checks the court belongs to the partner and that
 * every product is that court's own row. Without an explicit court, it is inferred from the products.
 */
async function resolvePurchaseOrderCourt(tx: Prisma.TransactionClient, partnerId: string, requestedCourtId: string | undefined, serviceIds: string[]) {
  const ids = [...new Set(serviceIds)];
  const services = await tx.service.findMany({ where: { id: { in: ids }, partnerId }, select: { id: true, unit: true, courtId: true } });
  if (services.length !== ids.length) throw new NotFoundError("Sản phẩm không hợp lệ hoặc không thuộc cơ sở của bạn");
  if (services.some((service) => !service.courtId)) throw new ValidationError("Có sản phẩm chưa được gán cụm sân, không thể lập đơn nhập");

  const productCourts = new Set(services.map((service) => service.courtId!));
  const courtId = requestedCourtId ?? (productCourts.size === 1 ? [...productCourts][0] : undefined);
  if (!courtId) throw new ValidationError("Mỗi đơn nhập chỉ dành cho một cụm sân — hãy tách đơn theo từng cụm");

  const court = await tx.court.findFirst({ where: { id: courtId, partnerId }, select: { id: true } });
  if (!court) throw new NotFoundError("Cụm sân không tồn tại hoặc không thuộc cơ sở của bạn");
  if (productCourts.size !== 1 || !productCourts.has(courtId)) {
    throw new ValidationError("Mỗi đơn nhập chỉ dành cho một cụm sân — có sản phẩm không thuộc cụm sân của đơn");
  }
  return { courtId, services: new Map(services.map((service) => [service.id, service])) };
}

/**
 * Validates the counted quantities against the order and returns the quantity to add per line.
 * A line left out is taken as received in full; receiving more than was ordered needs a new order.
 */
function countedQuantities(items: Array<{ id: string; quantity: number }>, counted: ReceivePurchaseOrderInput["items"] = []) {
  const byItem = new Map(counted.map((line) => [line.itemId, line.receivedQuantity]));
  const unknown = [...byItem.keys()].filter((itemId) => !items.some((item) => item.id === itemId));
  if (unknown.length) throw new ValidationError("Có dòng hàng không thuộc đơn nhập này");
  return new Map(
    items.map((item) => {
      const received = byItem.get(item.id) ?? item.quantity;
      if (received > item.quantity) {
        throw new ValidationError("Số thực nhận không được vượt số đã đặt — phần dư hãy lập đơn nhập mới");
      }
      return [item.id, received] as const;
    })
  );
}

// Writes must follow the same scoping rule as the stock list: a partner with its own tracked
// services may only touch those; one without (demo data) sees and edits the shared pool.
async function assertServicesOwned(tx: Prisma.TransactionClient, partnerId: string, serviceIds: string[]) {
  const ids = [...new Set(serviceIds)];
  const services = await tx.service.findMany({ where: { id: { in: ids } }, select: { id: true, partnerId: true, unit: true } });
  const restrictToPartner = await hasOwnServicesCached(partnerId);
  const allowed = services.filter((service) => !restrictToPartner || service.partnerId === partnerId);
  if (allowed.length !== ids.length) throw new NotFoundError("Sản phẩm không hợp lệ hoặc không thuộc cơ sở của bạn");
  return new Map(allowed.map((service) => [service.id, service]));
}

async function assertSupplierOwned(tx: Prisma.TransactionClient, partnerId: string, supplierId?: string) {
  if (!supplierId) return;
  const supplier = await tx.supplier.findFirst({ where: { id: supplierId, partnerId }, select: { id: true } });
  if (!supplier) throw new NotFoundError("Nhà cung cấp không tồn tại");
}

// Adds received goods to stock with an atomic increment, so a concurrent cashier sale
// (which decrements in SQL) can never be overwritten by a stale read-then-write.
async function applyImport(
  tx: Prisma.TransactionClient,
  line: PurchaseOrderItemInput & { unit: string; referenceType: string; referenceId?: string; note?: string | null }
) {
  await tx.serviceInventory.upsert({
    where: { serviceId: line.serviceId },
    create: { serviceId: line.serviceId, quantity: line.quantity, minimumStock: 5, unit: line.unit, lastPurchasePrice: line.unitCost },
    update: { quantity: { increment: line.quantity }, lastPurchasePrice: line.unitCost }
  });
  await tx.service.update({ where: { id: line.serviceId }, data: { costPrice: line.unitCost } });
  await tx.inventoryTransaction.create({
    data: {
      serviceId: line.serviceId,
      type: "IMPORT",
      quantity: line.quantity,
      unitCost: line.unitCost,
      referenceType: line.referenceType,
      referenceId: line.referenceId ?? null,
      note: line.note ?? null
    }
  });
}

function purchaseOrderTotal(items: PurchaseOrderItemInput[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
}

async function createPurchaseOrderItems(tx: Prisma.TransactionClient, purchaseOrderId: string, items: PurchaseOrderItemInput[], receivedInFull = false) {
  await tx.purchaseOrderItem.createMany({
    data: items.map((item) => ({
      purchaseOrderId,
      serviceId: item.serviceId,
      quantity: item.quantity,
      receivedQuantity: receivedInFull ? item.quantity : null,
      unitCost: item.unitCost,
      totalPrice: item.quantity * item.unitCost
    }))
  });
}

// Tells "no such order" apart from "order exists but is in the wrong state" after a guarded update matched nothing.
async function throwPurchaseOrderStateError(tx: Prisma.TransactionClient, where: Prisma.PurchaseOrderWhereInput, action: string): Promise<never> {
  const current = await tx.purchaseOrder.findFirst({ where, select: { status: true } });
  if (!current) throw new NotFoundError("Không tìm thấy đơn nhập hàng");
  const label = PURCHASE_ORDER_STATUS_LABELS[current.status as PurchaseOrderStatus] ?? current.status;
  throw new ConflictError(`Đơn nhập đang ở trạng thái "${label}", không thể ${action}`, "INVALID_PURCHASE_ORDER_STATUS");
}

export const inventoryRepository = {
  async getInventorySummary(
    partnerId: string,
    options: { page?: number; limit?: number; status?: string; search?: string; categoryId?: string; courtId?: string; sortBy?: string; sortOrder?: string } = {}
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
      if (options.courtId) {
        params.push(options.courtId);
        conditions.push(`s.court_id = $${params.length}`);
      }
      const baseWhere = conditions.join(" AND ");

      const [summaryRows, itemRows] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `
          SELECT
            COUNT(*)::int as "totalProducts",
            COALESCE(SUM(COALESCE(si.quantity, 0)), 0)::int as "totalItems",
            COALESCE(SUM(COALESCE(si.quantity, 0) * COALESCE(s.cost_price, 0)), 0)::float as "totalStockValue",
            COUNT(*) FILTER (WHERE COALESCE(si.quantity, 0) > 0 AND COALESCE(si.quantity, 0) <= COALESCE(si.minimum_stock, 5))::int as "lowStockCount",
            COUNT(*) FILTER (WHERE COALESCE(si.quantity, 0) = 0)::int as "outOfStockCount"
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
            s.court_id as "courtId", ct.name as "courtName", s.image_url as "imageUrl",
            COALESCE(si.quantity, 0) as quantity,
            COALESCE(si.minimum_stock, 5) as "minimumStock",
            COUNT(*) OVER()::int as "filteredTotal"
          FROM services s
          LEFT JOIN service_categories c ON c.id = s.category_id
          LEFT JOIN courts ct ON ct.id = s.court_id
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
          courtId: svc.courtId ?? null,
          courtName: svc.courtName ?? null,
          imageUrl: svc.imageUrl ?? null,
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
      const fallbackParams: unknown[] = [partnerId];
      let courtFilter = "";
      if (options.courtId) {
        fallbackParams.push(options.courtId);
        courtFilter = ` AND s.court_id = $${fallbackParams.length}`;
      }
      const rawRows: any = await prisma.$queryRawUnsafe(
        `
        SELECT
          s.id as "serviceId",
          s.name as "serviceName",
          s.unit,
          s.price,
          s.cost_price as "costPrice",
          c.name as "categoryName",
          s.court_id as "courtId",
          ct.name as "courtName",
          s.image_url as "imageUrl",
          COALESCE(si.quantity, 0) as quantity,
          COALESCE(si.minimum_stock, 5) as "minimumStock"
        FROM services s
        LEFT JOIN service_categories c ON s.category_id = c.id
        LEFT JOIN courts ct ON ct.id = s.court_id
        LEFT JOIN service_inventories si ON s.id = si.service_id
        WHERE s.partner_id = $1 AND s.track_inventory = true${courtFilter}
        ORDER BY s.name ASC
        LIMIT ${limit} OFFSET ${offset};
      `,
        ...fallbackParams
      ).catch(() => []);

      let totalItems = 0;
      let totalStockValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      const items: any[] = [];

      // No name-based dedupe: each court owns a separate services row (and stock) for the same
      // product name, so collapsing by name would hide other courts' stock and skew the totals.
      for (const r of rawRows || []) {
        if (!r || !r.serviceName) continue;

        const qty = Number(r.quantity ?? 0);
        const minStock = Number(r.minimumStock ?? 5);
        const cost = Number(r.costPrice ?? 0);
        const stockVal = qty * cost;

        totalItems += qty;
        totalStockValue += stockVal;

        if (qty === 0) outOfStockCount++;
        else if (qty <= minStock) lowStockCount++;

        items.push({
          serviceId: r.serviceId,
          courtId: r.courtId ?? null,
          courtName: r.courtName ?? null,
          imageUrl: r.imageUrl ?? null,
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
  async getLowStockAlerts(partnerId: string, limit = 5, courtId?: string) {
    await ensureServiceTables();
    const hasOwnServices = await hasOwnServicesCached(partnerId);
    const params: unknown[] = [];
    const conditions = ["s.track_inventory = true", "COALESCE(si.quantity, 50) <= COALESCE(si.minimum_stock, 5)"];
    if (hasOwnServices) {
      params.push(partnerId);
      conditions.push(`s.partner_id = $${params.length}`);
    }
    if (courtId) {
      params.push(courtId);
      conditions.push(`s.court_id = $${params.length}`);
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
  async getReorderSuggestions(partnerId: string, options: { windowDays?: number; coverDays?: number; courtId?: string } = {}) {
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
    // Each court (cụm sân) restocks on its own, so suggestions are per court row.
    if (options.courtId) {
      params.push(options.courtId);
      conditions.push(`s.court_id = $${params.length}`);
    }

    const rows = await prisma
      .$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id as "serviceId", s.name as "serviceName", s.unit, s.cost_price as "costPrice",
          s.court_id as "courtId", ct.name as "courtName",
          COALESCE(si.quantity, 50) as quantity,
          COALESCE(si.minimum_stock, 5) as "minimumStock",
          COALESCE(sold."totalSold", 0)::int as "totalSold",
          COALESCE(sold."saleCount", 0)::int as "saleCount",
          sold."firstSaleAt" as "firstSaleAt"
        FROM services s
        LEFT JOIN service_inventories si ON si.service_id = s.id
        LEFT JOIN courts ct ON ct.id = s.court_id
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

      const base = {
        serviceId: r.serviceId as string,
        serviceName: r.serviceName as string,
        unit: r.unit as string,
        courtId: (r.courtId ?? null) as string | null,
        courtName: (r.courtName ?? null) as string | null,
        costPrice: Number(r.costPrice ?? 0),
        quantity,
        minimumStock
      };

      if (hasEnoughData) {
        const target = Math.max(minimumStock, Math.ceil(dailyRate * coverDays));
        return {
          ...base,
          dailyRate: Math.round(dailyRate * 100) / 100,
          daysRemaining: daysRemaining === null ? null : Math.round(daysRemaining * 10) / 10,
          suggestedQuantity: Math.max(1, target - quantity),
          status: "REORDER_SOON" as const
        };
      }

      // Not enough sales history to trust a velocity estimate, but stock is already
      // low/out — fall back to restocking to 2x the minimum safety stock.
      return {
        ...base,
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
      await assertServicesOwned(tx, partnerId, [data.serviceId]);
      const service = await tx.service.findUnique({ where: { id: data.serviceId } });
      if (!service) throw new NotFoundError("Sản phẩm/Dịch vụ không hợp lệ");

      // A missing stock row means nothing has been counted yet: start from 0, matching the stock list.
      const inv =
        (await tx.serviceInventory.findUnique({ where: { serviceId: data.serviceId } })) ??
        (await tx.serviceInventory.create({ data: { serviceId: data.serviceId, quantity: 0, minimumStock: 5, unit: service.unit } }));

      const amount = Math.abs(data.quantity);
      const quantityUpdate =
        data.type === "ADJUSTMENT"
          ? { set: Math.max(0, data.quantity) }
          : ["SALE", "RENTAL_OUT", "DAMAGED", "LOST"].includes(data.type)
          ? { decrement: amount }
          : { increment: amount };

      let { quantity: newQty } = await tx.serviceInventory.update({
        where: { serviceId: data.serviceId },
        data: {
          quantity: quantityUpdate,
          ...(data.unitCost && data.unitCost > 0 ? { lastPurchasePrice: data.unitCost } : {})
        },
        select: { quantity: true }
      });
      // Stock never goes negative: removing more than is on hand empties it.
      if (newQty < 0) {
        newQty = 0;
        await tx.serviceInventory.update({ where: { serviceId: data.serviceId }, data: { quantity: 0 } });
      }

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

  async getTransactions(partnerId: string, limit = 50, courtId?: string) {
    await ensureServiceTables();
    const courtWhere = courtId ? { courtId } : {};
    try {
      let services = await prisma.service.findMany({
        where: { partnerId, ...courtWhere },
        select: { id: true }
      });
      let serviceIds = services.map((s) => s.id);

      if (serviceIds.length === 0 && !courtId) {
        services = await prisma.service.findMany({ select: { id: true } });
        serviceIds = services.map((s) => s.id);
      }
      // A court with no products has no history; an empty `in` would otherwise mean "no filter".
      if (serviceIds.length === 0 && courtId) return [];

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
        WHERE ($2::text IS NULL OR s.court_id = $2::text)
        ORDER BY t.created_at DESC
        LIMIT $1;
      `, limit, courtId ?? null).catch(() => []);

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

  async createPurchaseOrder(partnerId: string, userId: string, data: CreatePurchaseOrderInput) {
    await ensureServiceTables();
    const status = data.status ?? "DRAFT";

    return prisma.$transaction(async (tx) => {
      const { courtId, services } = await resolvePurchaseOrderCourt(tx, partnerId, data.courtId, data.items.map((item) => item.serviceId));
      await assertSupplierOwned(tx, partnerId, data.supplierId);

      const now = new Date();
      const total = purchaseOrderTotal(data.items);
      const po = await tx.purchaseOrder.create({
        data: {
          partnerId,
          courtId,
          supplierId: data.supplierId ?? null,
          orderCode: purchaseOrderCode(),
          totalAmount: total,
          status,
          note: data.note ?? null,
          createdById: userId,
          // Created already ordered / already received by the same person.
          ...(status !== "DRAFT" ? { orderedById: userId, orderedAt: now } : {}),
          ...(status === "COMPLETED" ? { receivedById: userId, receivedAt: now, receivedAmount: total } : {})
        }
      });
      await createPurchaseOrderItems(tx, po.id, data.items, status === "COMPLETED");

      // "Nhập kho ngay": the goods are already in hand, so stock is added in the same transaction.
      if (status === "COMPLETED") {
        for (const item of data.items) {
          await applyImport(tx, {
            ...item,
            unit: services.get(item.serviceId)!.unit,
            referenceType: "PURCHASE_ORDER",
            referenceId: po.id,
            note: `Nhập hàng đơn #${po.orderCode}`
          });
        }
      }

      return tx.purchaseOrder.findUnique({ where: { id: po.id }, include: purchaseOrderInclude });
    });
  },

  // Only drafts are editable; supplier, note and the full item list are replaced. The court never changes.
  async updatePurchaseOrder(scope: PurchaseOrderScope, id: string, data: UpdatePurchaseOrderInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const where = scopedOrderWhere(scope, id);
      const current = await tx.purchaseOrder.findFirst({ where, select: { courtId: true } });
      if (!current) throw new NotFoundError("Không tìm thấy đơn nhập hàng");
      // Orders from before courts were tracked adopt the court of their products here.
      const { courtId } = await resolvePurchaseOrderCourt(tx, scope.partnerId, current.courtId ?? undefined, data.items.map((item) => item.serviceId));
      await assertSupplierOwned(tx, scope.partnerId, data.supplierId);

      const { count } = await tx.purchaseOrder.updateMany({
        where: { ...where, status: "DRAFT" },
        data: { courtId, supplierId: data.supplierId ?? null, note: data.note ?? null, totalAmount: purchaseOrderTotal(data.items) }
      });
      if (count === 0) await throwPurchaseOrderStateError(tx, where, "sửa (chỉ sửa được đơn nháp)");

      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await createPurchaseOrderItems(tx, id, data.items);

      return tx.purchaseOrder.findUnique({ where: { id }, include: purchaseOrderInclude });
    });
  },

  /**
   * Moves an order between statuses and records who did it. The status check and the update are a
   * single guarded `updateMany`, so receiving the same order twice (double click, two tabs) matches
   * nothing the second time instead of adding the goods to stock again. On receipt, stock grows by the
   * counted quantity of each line, not the ordered one.
   */
  async transitionPurchaseOrder(
    scope: PurchaseOrderScope,
    id: string,
    from: readonly PurchaseOrderStatus[],
    to: PurchaseOrderStatus,
    action: string,
    receipt: ReceivePurchaseOrderInput = {}
  ) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const where = scopedOrderWhere(scope, id);
      const po = await tx.purchaseOrder.findFirst({ where, include: { items: { include: { service: { select: { unit: true } } } } } });
      if (!po) throw new NotFoundError("Không tìm thấy đơn nhập hàng");

      const now = new Date();
      const counted = to === "COMPLETED" ? countedQuantities(po.items, receipt.items) : null;
      const audit: Prisma.PurchaseOrderUncheckedUpdateManyInput =
        to === "ORDERED"
          ? { orderedById: scope.userId, orderedAt: now }
          : to === "CANCELLED"
          ? { cancelledById: scope.userId, cancelledAt: now }
          : {
              receivedById: scope.userId,
              receivedAt: now,
              receiveNote: receipt.note ?? null,
              receivedAmount: po.items.reduce((sum, item) => sum + (counted?.get(item.id) ?? 0) * Number(item.unitCost), 0),
              // Receiving a draft directly means the partner approved and received it in one step.
              ...(po.orderedAt ? {} : { orderedById: scope.userId, orderedAt: now })
            };

      const { count } = await tx.purchaseOrder.updateMany({
        where: { ...where, status: { in: [...from] } },
        data: { status: to, ...audit }
      });
      if (count === 0) await throwPurchaseOrderStateError(tx, where, action);

      if (counted) {
        for (const item of po.items) {
          const received = counted.get(item.id)!;
          await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQuantity: received } });
          if (received === 0) continue;
          await applyImport(tx, {
            serviceId: item.serviceId,
            quantity: received,
            unitCost: Number(item.unitCost),
            unit: item.service.unit,
            referenceType: "PURCHASE_ORDER",
            referenceId: po.id,
            note: `Nhập hàng đơn #${po.orderCode}`
          });
        }
      }

      return tx.purchaseOrder.findUnique({ where: { id }, include: purchaseOrderInclude });
    });
  },

  async listPurchaseOrders(partnerId: string, filter: PurchaseOrderListFilter = {}) {
    await ensureServiceTables();
    return prisma.purchaseOrder.findMany({
      where: {
        partnerId,
        ...(filter.courtId ? { courtId: filter.courtId } : {}),
        ...(filter.status ? { status: filter.status } : {})
      },
      include: purchaseOrderInclude,
      orderBy: { createdAt: "desc" }
    });
  }
};
