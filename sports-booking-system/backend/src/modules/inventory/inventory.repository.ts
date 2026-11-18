import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
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

/** A receptionist edits or withdraws only the drafts they proposed, never one the partner wrote. */
function assertOwnProposal(scope: PurchaseOrderScope, order: { createdById: string | null }) {
  if (scope.role === "RECIPIENT" && order.createdById !== scope.userId) {
    throw new ForbiddenError("Lễ tân chỉ sửa hoặc rút được đề xuất nhập hàng do mình tạo");
  }
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

  /**
   * A manual stock change. ADJUSTMENT sets the counted quantity and logs the difference (+/-), so the history adds up;
   * removals cannot take more than is free (gear out with customers comes back through the rental return), and a count
   * cannot go below the gear that is out.
   */
  async adjustStock(partnerId: string, data: AdjustStockInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      await assertServicesOwned(tx, partnerId, [data.serviceId]);
      const service = await tx.service.findUnique({ where: { id: data.serviceId } });
      if (!service) throw new NotFoundError("Sản phẩm/Dịch vụ không hợp lệ");

      // A missing stock row means nothing has been counted yet: start from 0, matching the stock list.
      await tx.$executeRaw`
        INSERT INTO service_inventories (id, service_id, quantity, minimum_stock, unit)
        VALUES (gen_random_uuid(), ${data.serviceId}, 0, 5, ${service.unit || "cái"})
        ON CONFLICT (service_id) DO NOTHING
      `;
      const [inv] = await tx.$queryRaw<Array<{ quantity: number; reservedQuantity: number }>>`
        SELECT quantity, reserved_quantity AS "reservedQuantity" FROM service_inventories WHERE service_id = ${data.serviceId} FOR UPDATE
      `;
      const current = Number(inv.quantity);
      const reserved = Number(inv.reservedQuantity ?? 0);
      const free = Math.max(0, current - reserved);

      let change: number;
      if (data.type === "ADJUSTMENT") {
        if (data.quantity < reserved) {
          throw new ValidationError(`Đang có ${reserved} ${service.unit} cho thuê chưa trả, số tồn thực tế không thể thấp hơn ${reserved}`);
        }
        change = data.quantity - current;
        if (change === 0) throw new ValidationError(`Số tồn đang là ${current} ${service.unit}, không có gì thay đổi`);
      } else {
        if (data.quantity <= 0) throw new ValidationError("Số lượng phải lớn hơn 0");
        const removes = ["SALE", "RENTAL_OUT", "DAMAGED", "LOST"].includes(data.type);
        if (removes && data.quantity > free) {
          throw new ValidationError(
            reserved > 0
              ? `Chỉ còn ${free} ${service.unit} trong kho (${reserved} đang cho thuê), không thể xuất ${data.quantity}`
              : `Chỉ còn ${free} ${service.unit} trong kho, không thể xuất ${data.quantity}`
          );
        }
        change = removes ? -data.quantity : data.quantity;
      }

      const newQty = current + change;
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

      // ADJUSTMENT rows hold the signed difference; the other types hold how many moved, their direction set by the type.
      const txLog = await tx.inventoryTransaction.create({
        data: {
          serviceId: data.serviceId,
          type: data.type as any,
          quantity: data.type === "ADJUSTMENT" ? change : data.quantity,
          unitCost: data.unitCost ?? Number(service.costPrice),
          referenceType: "MANUAL_ADJUSTMENT",
          note: data.type === "ADJUSTMENT" ? [`Kiểm kê: ${current} → ${newQty}`, data.note].filter(Boolean).join(". ") : data.note ?? null
        }
      });

      return {
        serviceId: data.serviceId,
        previousQuantity: current,
        newQuantity: newQty,
        transaction: txLog
      };
    });
  },

  /**
   * One page of the partner's stock ledger, newest first. Always limited to the partner's own products (a partner
   * with none gets nothing; before 2026-11-07 it got every partner's ledger), optionally to one court, one kind of
   * line, a product name and a range of Vietnam days.
   */
  async transactionsPage(
    partnerId: string,
    filter: { courtId?: string; type?: string; search: string | null; from?: string; to?: string; limit: number; offset: number }
  ) {
    await ensureServiceTables();
    const params = [partnerId, filter.courtId ?? null, filter.type ?? null, filter.search, filter.from ?? null, filter.to ?? null];
    const where = `
      FROM inventory_transactions t
      JOIN services s ON s.id = t.service_id
      LEFT JOIN service_categories cat ON cat.id = s.category_id
      WHERE s.partner_id = $1
        AND ($2::text IS NULL OR s.court_id = $2::text)
        AND ($3::text IS NULL OR t.type::text = $3::text)
        AND ($4::text IS NULL OR s.name ILIKE $4::text)
        AND ($5::date IS NULL OR (t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= $5::date)
        AND ($6::date IS NULL OR (t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= $6::date)`;
    const [rows, counted] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT t.id, t.service_id AS "serviceId", t.type::text AS type, t.quantity, t.unit_cost AS "unitCost",
                t.reference_type AS "referenceType", t.reference_id AS "referenceId", t.note, t.created_at AS "createdAt",
                s.name AS "serviceName", s.unit AS "serviceUnit", cat.name AS "categoryName"
         ${where}
         ORDER BY t.created_at DESC, t.id DESC
         LIMIT $7 OFFSET $8;`,
        ...params,
        filter.limit,
        filter.offset
      ),
      prisma.$queryRawUnsafe<Array<{ total: number }>>(`SELECT count(*)::int AS total ${where};`, ...params)
    ]);
    return {
      total: Number(counted[0]?.total ?? 0),
      items: rows.map((t) => ({
        id: t.id,
        serviceId: t.serviceId,
        type: t.type,
        quantity: Number(t.quantity),
        unitCost: Number(t.unitCost ?? 0),
        referenceType: t.referenceType,
        referenceId: t.referenceId,
        note: t.note,
        createdAt: t.createdAt,
        service: { id: t.serviceId, name: t.serviceName, unit: t.serviceUnit || "cái", category: t.categoryName ? { name: t.categoryName } : null }
      }))
    };
  },

  /**
   * What one court sold (counted products, not rental gear) on bookings played within a range of days, newest first:
   * the open lines of bookings not cancelled or rejected. A line ordered with its booking says so (added_by 'BOOKING',
   * since 2026-11-07); an older one was written in the booking's own transaction, within seconds of it (online: the
   * same instant, at the counter: 1-4 s), while counter sales come minutes or hours later: under 30 s means "ordered
   * with the booking", anything else "added at the counter".
   */
  async salesPage(courtId: string, filter: { from: string; to: string; search: string | null; limit: number; offset: number }) {
    await ensureServiceTables();
    const params = [courtId, filter.from, filter.to, filter.search];
    const where = `
      FROM booking_services bs
      JOIN bookings b ON b.id = bs.booking_id
      JOIN services s ON s.id = bs.service_id
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN court_surfaces cs ON cs.id = b.court_surface_id
      WHERE b.court_id = $1
        AND s.type::text = 'PRODUCT'
        AND (bs.status = 'ACTIVE' OR bs.status IS NULL)
        AND b.booking_status::text NOT IN ('CANCELLED', 'REJECTED')
        AND b.booking_date BETWEEN $2::date AND $3::date
        AND ($4::text IS NULL OR s.name ILIKE $4::text OR u.full_name ILIKE $4::text OR u.phone ILIKE $4::text OR b.booking_code ILIKE $4::text)`;
    const [rows, totals] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT bs.id, bs.quantity,
                COALESCE(NULLIF(bs.unit_price, 0), bs.price / NULLIF(bs.quantity, 0), 0) AS "unitPrice",
                COALESCE(bs.total_price, bs.price, 0) AS total,
                bs.created_at AS "addedAt",
                (bs.added_by = 'BOOKING' OR abs(extract(epoch FROM bs.created_at - b.created_at)) < 30) AS "withBooking",
                s.id AS "serviceId", s.name AS "serviceName", s.unit,
                b.id AS "bookingId", b.booking_code AS "bookingCode", to_char(b.booking_date, 'YYYY-MM-DD') AS "bookingDate",
                to_char(b.start_time, 'HH24:MI') AS "startTime", to_char(b.end_time, 'HH24:MI') AS "endTime",
                b.payment_status::text AS "paymentStatus", b.booking_status::text AS "bookingStatus",
                u.full_name AS "customerName", u.phone AS "customerPhone",
                COALESCE(cs.name, (SELECT cs2.name FROM booking_slots sl JOIN court_surfaces cs2 ON cs2.id = sl.court_surface_id
                                    WHERE sl.booking_id = b.id LIMIT 1)) AS "surfaceName"
         ${where}
         ORDER BY b.booking_date DESC, bs.created_at DESC, bs.id DESC
         LIMIT $5 OFFSET $6;`,
        ...params,
        filter.limit,
        filter.offset
      ),
      prisma.$queryRawUnsafe<Array<{ lines: number; quantity: number; amount: number }>>(
        `SELECT count(*)::int AS lines, COALESCE(sum(bs.quantity), 0)::int AS quantity,
                COALESCE(sum(COALESCE(bs.total_price, bs.price, 0)), 0)::float AS amount
         ${where};`,
        ...params
      )
    ]);
    return {
      summary: { lines: Number(totals[0]?.lines ?? 0), quantity: Number(totals[0]?.quantity ?? 0), amount: Number(totals[0]?.amount ?? 0) },
      items: rows.map((row) => ({
        id: row.id,
        addedAt: row.addedAt,
        source: row.withBooking ? ("WITH_BOOKING" as const) : ("COUNTER" as const),
        service: { id: row.serviceId, name: row.serviceName, unit: row.unit || "cái" },
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice ?? 0),
        total: Number(row.total ?? 0),
        booking: {
          id: row.bookingId,
          code: row.bookingCode,
          date: row.bookingDate,
          startTime: row.startTime,
          endTime: row.endTime,
          status: row.bookingStatus,
          paymentStatus: row.paymentStatus,
          surfaceName: row.surfaceName ?? null,
          customerName: row.customerName ?? null,
          customerPhone: row.customerPhone ?? null
        }
      }))
    };
  },

  /**
   * One court's rental pieces, newest first. OUT lists every piece with a customer now, whatever day it went out;
   * RETURNED / DAMAGED / LOST / ALL list the pieces that went out within the range of days. The counts: pieces out now
   * (the whole court) and, within the range, pieces returned, damaged and lost.
   */
  async rentalsPage(
    courtId: string,
    filter: { status: string; from: string; to: string; search: string | null; limit: number; offset: number }
  ) {
    await ensureServiceTables();
    const params = [courtId, filter.status, filter.from, filter.to, filter.search];
    const joins = `
      FROM rental_items ri
      JOIN booking_services bs ON bs.id = ri.booking_service_id
      JOIN bookings b ON b.id = bs.booking_id
      JOIN services s ON s.id = ri.service_id
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN court_surfaces cs ON cs.id = b.court_surface_id`;
    const inRange = `(ri.rental_start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN $3::date AND $4::date`;
    const where = `${joins}
      WHERE b.court_id = $1
        AND (($2::text = 'OUT' AND ri.status::text = 'RENTED')
             OR ($2::text <> 'OUT' AND ($2::text = 'ALL' OR ri.status::text = $2::text) AND ${inRange}))
        AND ($5::text IS NULL OR s.name ILIKE $5::text OR u.full_name ILIKE $5::text OR u.phone ILIKE $5::text OR b.booking_code ILIKE $5::text)`;
    const [rows, counted, totals] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT ri.id, ri.status::text AS status, ri.rental_start_time AS "startedAt", ri.returned_at AS "returnedAt", ri.notes,
                COALESCE(NULLIF(bs.unit_price, 0), bs.price / NULLIF(bs.quantity, 0), 0) AS "unitPrice",
                s.id AS "serviceId", s.name AS "serviceName", s.unit,
                b.id AS "bookingId", b.booking_code AS "bookingCode", to_char(b.booking_date, 'YYYY-MM-DD') AS "bookingDate",
                to_char(b.start_time, 'HH24:MI') AS "startTime", to_char(b.end_time, 'HH24:MI') AS "endTime",
                b.booking_status::text AS "bookingStatus",
                u.full_name AS "customerName", u.phone AS "customerPhone",
                COALESCE(cs.name, (SELECT cs2.name FROM booking_slots sl JOIN court_surfaces cs2 ON cs2.id = sl.court_surface_id
                                    WHERE sl.booking_id = b.id LIMIT 1)) AS "surfaceName"
         ${where}
         ORDER BY ri.rental_start_time DESC, ri.id DESC
         LIMIT $6 OFFSET $7;`,
        ...params,
        filter.limit,
        filter.offset
      ),
      prisma.$queryRawUnsafe<Array<{ total: number }>>(`SELECT count(*)::int AS total ${where};`, ...params),
      prisma.$queryRawUnsafe<Array<{ out: number; returned: number; damaged: number; lost: number }>>(
        `SELECT count(*) FILTER (WHERE ri.status::text = 'RENTED')::int AS out,
                count(*) FILTER (WHERE ri.status::text = 'RETURNED' AND ${inRange.replace("$3", "$2").replace("$4", "$3")})::int AS returned,
                count(*) FILTER (WHERE ri.status::text = 'DAMAGED' AND ${inRange.replace("$3", "$2").replace("$4", "$3")})::int AS damaged,
                count(*) FILTER (WHERE ri.status::text = 'LOST' AND ${inRange.replace("$3", "$2").replace("$4", "$3")})::int AS lost
         ${joins}
         WHERE b.court_id = $1;`,
        courtId,
        filter.from,
        filter.to
      )
    ]);
    const counts = totals[0] ?? { out: 0, returned: 0, damaged: 0, lost: 0 };
    return {
      total: Number(counted[0]?.total ?? 0),
      summary: { out: Number(counts.out ?? 0), returned: Number(counts.returned ?? 0), damaged: Number(counts.damaged ?? 0), lost: Number(counts.lost ?? 0) },
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        startedAt: row.startedAt,
        returnedAt: row.returnedAt ?? null,
        notes: row.notes ?? null,
        unitPrice: Number(row.unitPrice ?? 0),
        service: { id: row.serviceId, name: row.serviceName, unit: row.unit || "cái" },
        booking: {
          id: row.bookingId,
          code: row.bookingCode,
          date: row.bookingDate,
          startTime: row.startTime,
          endTime: row.endTime,
          status: row.bookingStatus,
          surfaceName: row.surfaceName ?? null,
          customerName: row.customerName ?? null,
          customerPhone: row.customerPhone ?? null
        }
      }))
    };
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
      const current = await tx.purchaseOrder.findFirst({ where, select: { courtId: true, createdById: true, status: true } });
      if (!current) throw new NotFoundError("Không tìm thấy đơn nhập hàng");
      if (current.status === "DRAFT") assertOwnProposal(scope, current);
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
      // Receiving is for whoever is on site; withdrawing a draft only for the one who proposed it.
      if (to === "CANCELLED" && po.status === "DRAFT") assertOwnProposal(scope, po);

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
