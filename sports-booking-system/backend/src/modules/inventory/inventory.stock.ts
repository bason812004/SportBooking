import type { Prisma } from "@prisma/client";
import { ValidationError } from "../../shared/errors/AppError.js";

/**
 * Stock taken by, and given back from, a customer's booking. Every path that hands services to a customer goes through
 * here, in the transaction that writes the booking line: the cashier (a guest playing, staff at the counter), a walk-in
 * booked at the counter with services, and a customer's online booking with services. Releasing on cancel / no-show goes
 * through here too, in the transaction that changes the booking's status.
 *
 *   counted product (PRODUCT, track_inventory)  quantity goes down, a SALE line is written at the cost price
 *   rental gear (RENTAL_SERVICE)                 pieces are held (reserved_quantity) and one rental_items row per piece
 *                                               says it is out; a returned piece frees its hold. Gear without a stock row
 *                                               is not counted (never limited).
 *   product not counted                          nothing
 *
 * Each service's stock row is locked (FOR UPDATE) before it is read, in service id order so two sales never deadlock,
 * and checked against what is free (quantity - reserved_quantity): two sales at once can never take the same piece, and
 * the table's CHECK constraints (database/40_inventory_non_negative.sql) refuse a negative count outright.
 */

/** A quantity of one service handed to (or taken back from) a customer, on one booking line. */
export type StockMove = { serviceId: string | null | undefined; quantity: number; bookingServiceId?: string | null };

/** What the stock line says it was for (inventory_transactions.reference_type / reference_id / note). */
export type StockReference = { referenceType: string; referenceId: string; note: string };

/** The facts about a service the stock rules need; callers that already loaded them pass them in (one query less). */
export type StockServiceInfo = {
  id: string;
  name: string;
  type: string;
  trackInventory: boolean;
  unit: string | null;
  costPrice: unknown;
  courtId: string | null;
  partnerId: string;
};

/** A counted product a sale has just taken to its reorder level ("LOW") or to nothing ("OUT"): the partner is told. */
export type StockAlert = {
  serviceId: string;
  name: string;
  unit: string;
  courtId: string | null;
  partnerId: string;
  quantity: number;
  minimumStock: number;
  level: "LOW" | "OUT";
};

export type StockOptions = {
  /** Alerts are collected here, to be sent once the transaction has committed (inventory.alerts.ts). */
  alerts?: StockAlert[];
  services?: StockServiceInfo[];
};

type MoveGroup = { serviceId: string; quantity: number; lines: Array<{ quantity: number; bookingServiceId: string | null }> };

/**
 * The moves per service, positive quantities only, in service id order. The same service on several lines counts once
 * (checked and locked once), while each line keeps its own pieces of rental gear.
 */
export function groupMoves(moves: StockMove[]): MoveGroup[] {
  const groups = new Map<string, MoveGroup>();
  for (const move of moves) {
    const quantity = Math.trunc(Number(move.quantity));
    if (!move.serviceId || !Number.isFinite(quantity) || quantity <= 0) continue;
    const group = groups.get(move.serviceId) ?? { serviceId: move.serviceId, quantity: 0, lines: [] };
    group.quantity += quantity;
    group.lines.push({ quantity, bookingServiceId: move.bookingServiceId ?? null });
    groups.set(move.serviceId, group);
  }
  return [...groups.values()].sort((a, b) => (a.serviceId < b.serviceId ? -1 : a.serviceId > b.serviceId ? 1 : 0));
}

/**
 * Where a sale leaves a product against its reorder level: newly out of stock, newly at or below the level, or neither.
 * Only the crossing counts, so a partner hears once, not after every later sale.
 */
export function stockLevelCrossed(before: number, after: number, minimum: number): "LOW" | "OUT" | null {
  if (after <= 0 && before > 0) return "OUT";
  if (after <= minimum && before > minimum) return "LOW";
  return null;
}

/** What is free to hand out: on hand, less the rental pieces out with customers. */
export function freeStock(row: { quantity: unknown; reservedQuantity: unknown }) {
  return Number(row.quantity ?? 0) - Number(row.reservedQuantity ?? 0);
}

async function loadServices(tx: Prisma.TransactionClient, ids: string[], known: StockServiceInfo[] = []) {
  const byId = new Map(known.filter((service) => ids.includes(service.id)).map((service) => [service.id, service]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    const rows: StockServiceInfo[] = await tx.$queryRawUnsafe(
      `SELECT s.id, s.name, s.type::text AS type, s.track_inventory AS "trackInventory", s.unit, s.cost_price AS "costPrice",
              s.court_id AS "courtId", s.partner_id AS "partnerId"
       FROM services s WHERE s.id::text = ANY($1::text[]);`,
      missing
    );
    for (const row of Array.isArray(rows) ? rows : []) byId.set(row.id, row);
  }
  return byId;
}

type LockedStock = { quantity: number; reservedQuantity: number; minimumStock: number };

/** The stock row, locked for the rest of the transaction; created empty first for a counted product that has none. */
async function lockStock(tx: Prisma.TransactionClient, serviceId: string, createWithUnit?: string | null): Promise<LockedStock | null> {
  if (createWithUnit !== undefined) {
    await tx.$executeRawUnsafe(
      `INSERT INTO service_inventories (id, service_id, quantity, minimum_stock, unit)
       VALUES (gen_random_uuid(), $1, 0, 5, $2)
       ON CONFLICT (service_id) DO NOTHING;`,
      serviceId,
      createWithUnit || "cái"
    );
  }
  const rows: any = await tx.$queryRawUnsafe(
    `SELECT quantity, reserved_quantity AS "reservedQuantity", minimum_stock AS "minimumStock"
     FROM service_inventories WHERE service_id::text = $1::text FOR UPDATE;`,
    serviceId
  );
  if (!Array.isArray(rows) || !rows.length) return null;
  return { quantity: Number(rows[0].quantity), reservedQuantity: Number(rows[0].reservedQuantity), minimumStock: Number(rows[0].minimumStock ?? 0) };
}

/** One rental_items row per piece of gear handed out on a booking line. */
export async function createRentalPieces(tx: Prisma.TransactionClient, bookingServiceId: string, serviceId: string, count: number) {
  for (let piece = 0; piece < count; piece += 1) {
    await tx.$executeRawUnsafe(
      `INSERT INTO rental_items (id, booking_service_id, service_id, status, rental_start_time, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::text, $2, 'RENTED', NOW(), NOW(), NOW());`,
      bookingServiceId,
      serviceId
    );
  }
}

/** Gear out with a customer holds stock; `count` pieces come back, `lost` of them for good. */
export async function releaseRentalStock(tx: Prisma.TransactionClient, serviceId: string, count: number, lost = 0) {
  if (count <= 0) return;
  await tx.$executeRawUnsafe(
    `UPDATE service_inventories SET reserved_quantity = GREATEST(reserved_quantity - $1, 0), quantity = quantity - $2, updated_at = NOW()
     WHERE service_id::text = $3::text;`,
    count,
    lost,
    serviceId
  );
}

/** Up to `count` pieces still out on a booking line come back (the latest first), freeing their hold. Returns how many. */
export async function returnRentedPieces(tx: Prisma.TransactionClient, bookingServiceId: string, serviceId: string, count: number, note: string) {
  if (count <= 0) return 0;
  const returned = await tx.$executeRawUnsafe(
    `UPDATE rental_items SET status = 'RETURNED', returned_at = NOW(), notes = $3, updated_at = NOW()
     WHERE id IN (
       SELECT id FROM rental_items WHERE booking_service_id::text = $1::text AND status = 'RENTED'
       ORDER BY created_at DESC LIMIT $2
     );`,
    bookingServiceId,
    count,
    note
  );
  await releaseRentalStock(tx, serviceId, Number(returned));
  return Number(returned);
}

/**
 * Takes stock for services handed to a customer, or refuses the whole operation (ValidationError, so the caller's
 * transaction rolls back) when any of them has too little free.
 */
export async function takeStock(tx: Prisma.TransactionClient, moves: StockMove[], reference: StockReference, options: StockOptions = {}) {
  const groups = groupMoves(moves);
  if (!groups.length) return;
  const services = await loadServices(tx, groups.map((group) => group.serviceId), options.services);

  for (const group of groups) {
    const service = services.get(group.serviceId);
    // A line of the old per-court catalog (court_services) has no stock to take.
    if (!service) continue;

    if (service.type === "RENTAL_SERVICE") {
      const stock = await lockStock(tx, service.id);
      if (stock) {
        const free = freeStock(stock);
        if (free < group.quantity) throw new ValidationError(`"${service.name}" chỉ còn ${Math.max(0, free)} để cho thuê`);
        await tx.$executeRawUnsafe(
          `UPDATE service_inventories SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
          group.quantity,
          service.id
        );
      }
      for (const line of group.lines) {
        if (line.bookingServiceId) await createRentalPieces(tx, line.bookingServiceId, service.id, line.quantity);
      }
      continue;
    }

    if (!service.trackInventory) continue;
    const stock = (await lockStock(tx, service.id, service.unit))!;
    const free = freeStock(stock);
    if (free < group.quantity) {
      throw new ValidationError(`Sản phẩm "${service.name}" không đủ tồn kho (Còn lại: ${Math.max(0, free)})`);
    }
    await tx.$executeRawUnsafe(
      `UPDATE service_inventories SET quantity = quantity - $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
      group.quantity,
      service.id
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO inventory_transactions (id, service_id, type, quantity, unit_cost, reference_type, reference_id, note, created_at)
       VALUES (gen_random_uuid(), $1, 'SALE', $2, $3, $4, $5, $6, NOW());`,
      service.id,
      group.quantity,
      Number(service.costPrice ?? 0),
      reference.referenceType,
      reference.referenceId,
      reference.note
    );
    const level = stockLevelCrossed(stock.quantity, stock.quantity - group.quantity, stock.minimumStock);
    if (level && options.alerts) {
      options.alerts.push({
        serviceId: service.id,
        name: service.name,
        unit: service.unit || "cái",
        courtId: service.courtId,
        partnerId: service.partnerId,
        quantity: stock.quantity - group.quantity,
        minimumStock: stock.minimumStock,
        level
      });
    }
  }
}

/** Ledger lines that take stock from, or give it back to, a booking (old lines included). */
export const BOOKING_STOCK_REFERENCES = ["BOOKING", "BOOKING_SERVICE", "BOOKING_CANCELLED", "BOOKING_NO_SHOW"] as const;

/**
 * How much of a product a booking took off stock and has not given back, from the stock ledger: SALE (and RENTAL_OUT,
 * which bookings made before 2026-11-06 wrote for the same thing) less the ADJUSTMENT lines that returned it. Only this
 * much can come back, so a booking line that never took stock (an online booking made before every booking path took
 * stock) can never add stock that was not there.
 */
export function stockStillTaken(lines: Array<{ type: string; quantity: unknown }>) {
  const net = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity ?? 0);
    if (line.type === "SALE" || line.type === "RENTAL_OUT") return sum + quantity;
    if (line.type === "ADJUSTMENT") return sum - quantity;
    return sum;
  }, 0);
  return Math.max(0, net);
}

async function takenByBooking(tx: Prisma.TransactionClient, bookingId: string, serviceId: string) {
  const lines: any = await tx.$queryRawUnsafe(
    `SELECT type::text AS type, quantity FROM inventory_transactions
     WHERE reference_id::text = $1::text AND service_id::text = $2::text
       AND type::text IN ('SALE', 'RENTAL_OUT', 'ADJUSTMENT')
       AND reference_type = ANY($3::text[]);`,
    bookingId,
    serviceId,
    [...BOOKING_STOCK_REFERENCES]
  );
  return stockStillTaken(Array.isArray(lines) ? lines : []);
}

async function restock(tx: Prisma.TransactionClient, service: StockServiceInfo, quantity: number, reference: StockReference) {
  await tx.$executeRawUnsafe(
    `UPDATE service_inventories SET quantity = quantity + $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
    quantity,
    service.id
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO inventory_transactions (id, service_id, type, quantity, unit_cost, reference_type, reference_id, note, created_at)
     VALUES (gen_random_uuid(), $1, 'ADJUSTMENT', $2, $3, $4, $5, $6, NOW());`,
    service.id,
    quantity,
    Number(service.costPrice ?? 0),
    reference.referenceType,
    reference.referenceId,
    reference.note
  );
}

/**
 * Gives back what a customer did not keep, on booking `reference.referenceId`: counted products return to stock (an
 * ADJUSTMENT line), never more than the booking took (stockStillTaken); rental pieces still out on the line come back.
 * Moves need their booking line for rental gear.
 */
export async function returnStock(tx: Prisma.TransactionClient, moves: StockMove[], reference: StockReference, options: Pick<StockOptions, "services"> = {}) {
  const groups = groupMoves(moves);
  if (!groups.length) return;
  const services = await loadServices(tx, groups.map((group) => group.serviceId), options.services);

  for (const group of groups) {
    const service = services.get(group.serviceId);
    if (!service) continue;

    if (service.type === "RENTAL_SERVICE") {
      for (const line of group.lines) {
        if (line.bookingServiceId) await returnRentedPieces(tx, line.bookingServiceId, service.id, line.quantity, reference.note);
      }
      // Gear booked with a booking before 2026-11-06 was taken off stock outright (RENTAL_OUT), not held: give that back.
      if (!(await lockStock(tx, service.id))) continue;
    } else {
      if (!service.trackInventory) continue;
      await lockStock(tx, service.id, service.unit);
    }

    const back = Math.min(group.quantity, await takenByBooking(tx, reference.referenceId, service.id));
    if (back > 0) await restock(tx, service, back, reference);
  }
}

/**
 * A booking that will not be served (cancelled, no-show) gives its services back: each open line is closed and its
 * stock returned, in the caller's transaction (so the status change and the stock never part). Returns how many lines.
 */
export async function releaseBookingStock(tx: Prisma.TransactionClient, bookingId: string, reason: string, referenceType: string) {
  const lines: any = await tx.$queryRawUnsafe(
    `SELECT id, service_id AS "serviceId", quantity FROM booking_services
     WHERE booking_id::text = $1::text AND (status = 'ACTIVE' OR status IS NULL)
     ORDER BY id FOR UPDATE;`,
    bookingId
  );
  if (!Array.isArray(lines) || !lines.length) return 0;
  await tx.$executeRawUnsafe(
    `UPDATE booking_services SET status = 'CANCELLED', updated_at = NOW() WHERE id::text = ANY($1::text[]);`,
    lines.map((line: { id: string }) => line.id)
  );
  await returnStock(
    tx,
    lines.map((line: { id: string; serviceId: string | null; quantity: number }) => ({
      serviceId: line.serviceId,
      quantity: Number(line.quantity),
      bookingServiceId: line.id
    })),
    { referenceType, referenceId: bookingId, note: reason }
  );
  return lines.length;
}
