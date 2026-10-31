import { nowWithinPlayWindow, playHasStarted } from "./cashier.calculations.js";
import { checkoutRepository } from "../checkout/checkout.repository.js";
import { serviceLineTotal, courtAmount } from "../checkout/checkout.calculations.js";
import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { ensureServiceTables } from "../services/service.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";

function dbTime(value: any) {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  if (typeof value === "string") return value.slice(0, 5);
  return value;
}

async function ensureInventoryRowLocked(tx: Prisma.TransactionClient, serviceId: string, unit: string) {
  await tx.$executeRawUnsafe(
    `INSERT INTO service_inventories (id, service_id, quantity, minimum_stock, unit)
     VALUES (gen_random_uuid(), $1, 0, 5, $2)
     ON CONFLICT (service_id) DO NOTHING;`,
    serviceId, unit || "cái"
  );
  const rows: any = await tx.$queryRawUnsafe(
    `SELECT quantity, reserved_quantity as "reservedQuantity" FROM service_inventories WHERE service_id::text = $1::text FOR UPDATE;`,
    serviceId
  );
  return rows[0];
}

/** The stock row of a rental service, locked; null when the service has none (its rentals are not limited). */
async function rentalStockLocked(tx: Prisma.TransactionClient, serviceId: string) {
  const rows: any = await tx.$queryRawUnsafe(
    `SELECT quantity, reserved_quantity as "reservedQuantity" FROM service_inventories WHERE service_id::text = $1::text FOR UPDATE;`,
    serviceId
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Gear out with a customer holds stock; `count` pieces come back, `lost` of them for good. */
async function releaseRentalStock(tx: Prisma.TransactionClient, serviceId: string, count: number, lost = 0) {
  if (count <= 0) return;
  await tx.$executeRawUnsafe(
    `UPDATE service_inventories SET reserved_quantity = GREATEST(reserved_quantity - $1, 0), quantity = quantity - $2, updated_at = NOW()
     WHERE service_id::text = $3::text;`,
    count, lost, serviceId
  );
}

/** Puts back the most recent `count` pieces of a rental line still out, releasing the stock they held. */
async function returnRentedPieces(tx: Prisma.TransactionClient, bookingServiceId: string, serviceId: string, count: number, note: string) {
  if (count <= 0) return 0;
  const returned = await tx.$executeRawUnsafe(
    `UPDATE rental_items SET status = 'RETURNED', returned_at = NOW(), notes = $3, updated_at = NOW()
     WHERE id IN (
       SELECT id FROM rental_items WHERE booking_service_id::text = $1::text AND status = 'RENTED'
       ORDER BY created_at DESC LIMIT $2
     );`,
    bookingServiceId, count, note
  );
  await releaseRentalStock(tx, serviceId, Number(returned));
  return Number(returned);
}

/** Services can no longer change on an invoice locked at the counter. */
function assertInvoiceOpen(booking: { invoiceLockedAt?: Date | null }) {
  if (booking.invoiceLockedAt) throw new ConflictError("Hoá đơn đã được khoá, hãy mở khoá trước khi thay đổi dịch vụ", "INVOICE_LOCKED");
}

export const cashierRepository = {
  /** Who a cashier works for: a partner's own courts, a staff member's court; an admin sees every partner. */
  async scopeFor(userId: string, role: string): Promise<{ partnerId: string | null; courtId?: string | null; all?: boolean }> {
    if (role === "PARTNER") {
      const partner = await prisma.partnerProfile.findUnique({ where: { userId }, select: { id: true } });
      return { partnerId: partner?.id ?? null };
    }
    if (role === "RECIPIENT") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { partnerId: true, managedCourtId: true, managedCourt: { select: { partnerId: true } } }
      });
      return { partnerId: user?.partnerId || user?.managedCourt?.partnerId || null, courtId: user?.managedCourtId ?? null };
    }
    if (role === "ADMIN") return { partnerId: null, all: true };
    return { partnerId: null };
  },

  async setInvoiceLock(bookingId: string, lockedBy: string | null) {
    return prisma.booking.update({
      where: { id: bookingId },
      data: lockedBy ? { invoiceLockedAt: new Date(), invoiceLockedBy: lockedBy } : { invoiceLockedAt: null, invoiceLockedBy: null },
      select: { id: true, invoiceLockedAt: true, invoiceLockedBy: true }
    });
  },

  /** The booking a rented piece belongs to, for the access check. */
  async rentalItemBooking(rentalItemId: string) {
    const rows: any = await prisma.$queryRawUnsafe(
      `SELECT bs.booking_id as "bookingId" FROM rental_items ri JOIN booking_services bs ON bs.id = ri.booking_service_id WHERE ri.id::text = $1::text LIMIT 1;`,
      rentalItemId
    );
    return Array.isArray(rows) && rows.length ? (rows[0].bookingId as string) : null;
  },

  async getActiveBookings(partnerId: string | null, courtId?: string, search?: string, filter?: string) {
    await ensureServiceTables();

    // 1. Fetch Courts
    const courts: any[] = (await prisma.$queryRawUnsafe(
      `SELECT c.id, c.name, cc.name as "categoryName"
       FROM courts c
       LEFT JOIN court_categories cc ON c.category_id = cc.id
       WHERE ($1::text IS NULL OR c.partner_id = $1::text) AND ($2::text IS NULL OR c.id = $2::text);`,
      partnerId, courtId ?? null
    ).catch(() => [])) as any[];

    const courtMap = new Map(courts.map((c) => [c.id, c]));
    const courtIds = Array.from(courtMap.keys());
    if (courtIds.length === 0) return [];

    // 2. Build dynamic filter & search clauses
    const params: any[] = [courtIds];
    let filterClause = "AND b.booking_status IN ('CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'CHECKOUT_PENDING', 'COMPLETED')";

    if (filter === "IN_USE") {
      filterClause = "AND (b.booking_status = 'IN_PROGRESS' OR (b.checked_in_at IS NOT NULL AND b.booking_status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')))";
    } else if (filter === "UPCOMING") {
      filterClause = "AND b.booking_status IN ('CONFIRMED', 'DEPOSIT_PAID') AND b.checked_in_at IS NULL";
    } else if (filter === "UNPAID") {
      filterClause = "AND b.payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PENDING') AND b.booking_status NOT IN ('CANCELLED', 'REJECTED')";
    } else if (filter === "PAID") {
      filterClause = "AND b.payment_status = 'PAID'";
    } else if (filter === "COMPLETED") {
      filterClause = "AND b.booking_status = 'COMPLETED'";
    }

    let searchClause = "";
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      searchClause = `AND (b.booking_code ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx} OR cs.name ILIKE $${idx} OR c.name ILIKE $${idx})`;
    }

    // 3. Fetch Bookings (today's bookings + in-progress / pending checkout bookings)
    const bRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT b.id, b.booking_code as "bookingCode", b.court_id as "courtId", b.user_id as "userId",
              b.booking_date as "bookingDate", b.start_time as "startTime", b.end_time as "endTime",
              b.base_price as "basePrice", b.dynamic_adjustment_amount as "dynamicAdjustmentAmount", b.voucher_discount_amount as "voucherDiscountAmount", b.checked_in_at as "checkedInAt", b.total_price as "totalPrice", b.deposit_amount as "depositAmount", b.booking_status as "bookingStatus",
              b.payment_status as "paymentStatus", b.payment_method as "paymentMethod",
              b.checked_in_at as "checkedInAt", b.invoice_locked_at as "invoiceLockedAt",
              u.full_name as "userName", u.phone as "userPhone", u.email as "userEmail",
              c.name as "courtName",
              COALESCE(cs.id, cs_slot.id) as "courtSurfaceId",
              COALESCE(cs.name, cs_slot.name) as "courtSurfaceName",
              COALESCE(cs.code, cs_slot.code) as "courtSurfaceCode"
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN courts c ON b.court_id = c.id
       LEFT JOIN court_surfaces cs ON b.court_surface_id = cs.id
       LEFT JOIN booking_slots bslot ON bslot.booking_id = b.id
       LEFT JOIN court_surfaces cs_slot ON bslot.court_surface_id = cs_slot.id
       WHERE b.court_id = ANY($1::text[])
         ${filterClause}
         ${searchClause}
         -- Vietnam date, not CURRENT_DATE: the server may run in UTC, where "today" flips at 07:00 local.
         -- Sessions still open from an earlier day stay listed so staff can close them out.
         AND (b.booking_date::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              OR b.booking_status IN ('IN_PROGRESS', 'CHECKOUT_PENDING'))
       ORDER BY b.start_time ASC;`,
      ...params
    ).catch(() => [])) as any[];

    if (!Array.isArray(bRows) || bRows.length === 0) return [];

    // Deduplicate bookings in case multiple booking_slots matched
    const uniqueBRows: any[] = [];
    const seenBookingIds = new Set<string>();
    for (const b of bRows) {
      if (!seenBookingIds.has(b.id)) {
        seenBookingIds.add(b.id);
        uniqueBRows.push(b);
      }
    }

    const bookingIds = uniqueBRows.map((b) => b.id);

    // 4. Fetch Booking Services
    const bsRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT bs.id, bs.booking_id as "bookingId", bs.service_id as "serviceId", bs.court_service_id as "courtServiceId",
              bs.quantity, bs.price, bs.unit_price as "unitPrice", bs.total_price as "totalPrice", bs.status,
              COALESCE(s.name, cs.name, 'Dịch vụ') as "name",
              COALESCE(s.unit, 'đơn vị') as "unit",
              s.image_url as "imageUrl",
              s.type as "type", s.track_inventory as "trackInventory"
       FROM booking_services bs
       LEFT JOIN services s ON bs.service_id::text = s.id::text
       LEFT JOIN court_services cs ON bs.court_service_id::text = cs.id::text OR bs.service_id::text = cs.id::text
       WHERE bs.booking_id = ANY($1::text[]) AND (bs.status = 'ACTIVE' OR bs.status IS NULL);`,
      bookingIds
    ).catch(() => [])) as any[];

    const bsGrouped = new Map<string, any[]>();
    if (Array.isArray(bsRows)) {
      for (const bs of bsRows) {
        const list = bsGrouped.get(bs.bookingId) || [];
        list.push({
          id: bs.id,
          bookingId: bs.bookingId,
          serviceId: bs.serviceId || bs.courtServiceId,
          name: bs.name,
          unit: bs.unit,
          imageUrl: bs.imageUrl || null,
          type: bs.type || "PRODUCT",
          quantity: Number(bs.quantity),
          price: Number(bs.price || bs.totalPrice || 0),
          unitPrice: Number(bs.unitPrice || 0),
          totalPrice: serviceLineTotal(bs),
          status: bs.status || "ACTIVE",
          service: {
            id: bs.serviceId || bs.courtServiceId,
            name: bs.name,
            unit: bs.unit,
            imageUrl: bs.imageUrl || null,
            type: bs.type || "PRODUCT"
          }
        });
        bsGrouped.set(bs.bookingId, list);
      }
    }

    const paidRows = await prisma.checkout.findMany({ where: { bookingId: { in: bookingIds } }, include: { payments: { where: { status: "PAID" } } } });
    const paidByBooking = new Map(paidRows.map(row => [row.bookingId, row.payments.reduce((sum, p) => sum + Number(p.amount), 0)]));
    // 5. Construct Response
    return uniqueBRows.map((b) => {
      // courtAmount, not totalPrice: totalPrice historically already includes services, so using it
      // here would charge every service twice once serviceSubtotal is added below.
      const courtSubtotal = courtAmount(b);
      const activeServices = bsGrouped.get(b.id) || [];
      const serviceSubtotal = activeServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
      const totalAmount = Math.max(0, courtSubtotal + serviceSubtotal - Number(b.voucherDiscountAmount || 0));
      const depositPaid = ["UNPAID", "FAILED", "REFUNDED"].includes(b.paymentStatus) ? 0 : Number(b.depositAmount) || 0;
      const remainingAmount = Math.max(0, totalAmount - depositPaid - (paidByBooking.get(b.id) ?? 0));

      const courtObj = courtMap.get(b.courtId) || { id: b.courtId, name: b.courtName || "Sân thể thao" };

      return {
        id: b.id,
        bookingCode: b.bookingCode,
        courtId: b.courtId,
        userId: b.userId,
        bookingDate: b.bookingDate,
        startTime: dbTime(b.startTime),
        endTime: dbTime(b.endTime),
        totalPrice: b.totalPrice,
        depositAmount: b.depositAmount,
        checkedInAt: b.checkedInAt,
        invoiceLockedAt: b.invoiceLockedAt ?? null,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        user: {
          id: b.userId,
          fullName: b.userName || "Khách vãng lai",
          phone: b.userPhone || "",
          email: b.userEmail || ""
        },
        court: {
          id: courtObj.id,
          name: courtObj.name
        },
        courtSurface: b.courtSurfaceId ? {
          id: b.courtSurfaceId,
          name: b.courtSurfaceName || "Sân con",
          code: b.courtSurfaceCode || ""
        } : null,
        bookingServices: activeServices,
        courtSubtotal,
        serviceSubtotal,
        totalAmount,
        depositPaid,
        remainingAmount,
        services: activeServices
      };
    });
  },

  async getBookingDetailForCashier(bookingId: string) {
    await ensureServiceTables();

    // 1. Fetch Booking
    const bRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT b.id, b.booking_code as "bookingCode", b.court_id as "courtId", b.user_id as "userId",
              b.booking_date as "bookingDate", b.start_time as "startTime", b.end_time as "endTime",
              b.base_price as "basePrice", b.dynamic_adjustment_amount as "dynamicAdjustmentAmount", b.voucher_discount_amount as "voucherDiscountAmount", b.checked_in_at as "checkedInAt", b.total_price as "totalPrice", b.deposit_amount as "depositAmount", b.booking_status as "bookingStatus",
              b.payment_status as "paymentStatus", b.payment_method as "paymentMethod", b.admin_note as "adminNote", b.note,
              b.checked_in_at as "checkedInAt", b.invoice_locked_at as "invoiceLockedAt",
              u.full_name as "userName", u.phone as "userPhone", u.email as "userEmail",
              c.name as "courtName", c.partner_id as "partnerId",
              COALESCE(cs.id, cs_slot.id) as "courtSurfaceId",
              COALESCE(cs.name, cs_slot.name) as "courtSurfaceName",
              COALESCE(cs.code, cs_slot.code) as "courtSurfaceCode"
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN courts c ON b.court_id = c.id
       LEFT JOIN court_surfaces cs ON b.court_surface_id = cs.id
       LEFT JOIN booking_slots bslot ON bslot.booking_id = b.id
       LEFT JOIN court_surfaces cs_slot ON bslot.court_surface_id = cs_slot.id
       WHERE b.id::text = $1::text OR b.booking_code::text = $1::text OR b.booking_order_id::text = $1::text
       LIMIT 1;`,
      bookingId
    ).catch(() => [])) as any[];

    if (!Array.isArray(bRows) || bRows.length === 0) {
      throw new NotFoundError("Booking không tồn tại");
    }

    const b = bRows[0];

    // The POS product list is seeded per court by listServicesForCourt, not here: the old
    // partner-level seed wrote services rows with no court_id (and a "partner_01" fallback id
    // that matches no partner), which is what produced duplicate/orphaned catalog rows.

    // 2. Fetch Booking Services
    const bsRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT bs.id, bs.booking_id as "bookingId", bs.service_id as "serviceId", bs.court_service_id as "courtServiceId",
              bs.quantity, bs.price, bs.unit_price as "unitPrice", bs.total_price as "totalPrice", bs.status,
              COALESCE(s.name, cs.name, 'Dịch vụ') as "name",
              COALESCE(s.unit, 'đơn vị') as "unit",
              s.image_url as "imageUrl",
              s.type as "type", s.track_inventory as "trackInventory"
       FROM booking_services bs
       LEFT JOIN services s ON bs.service_id::text = s.id::text
       LEFT JOIN court_services cs ON bs.court_service_id::text = cs.id::text OR bs.service_id::text = cs.id::text
       WHERE bs.booking_id::text = $1::text AND (bs.status = 'ACTIVE' OR bs.status IS NULL);`,
      b.id
    ).catch(() => [])) as any[];

    const activeServices = Array.isArray(bsRows)
      ? bsRows.map((bs) => ({
          id: bs.id,
          bookingId: bs.bookingId,
          serviceId: bs.serviceId || bs.courtServiceId,
          name: bs.name,
          unit: bs.unit,
          imageUrl: bs.imageUrl || null,
          type: bs.type || "PRODUCT",
          quantity: Number(bs.quantity),
          price: Number(bs.price || bs.totalPrice || 0),
          unitPrice: Number(bs.unitPrice || 0),
          totalPrice: serviceLineTotal(bs),
          status: bs.status || "ACTIVE",
          service: {
            id: bs.serviceId || bs.courtServiceId,
            name: bs.name,
            unit: bs.unit,
            imageUrl: bs.imageUrl || null,
            type: bs.type || "PRODUCT"
          }
        }))
      : [];

    const courtSubtotal = courtAmount(b);
    const serviceSubtotal = activeServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
    const voucherDiscount = Number(b.voucherDiscountAmount) || 0;
    const grandTotal = Math.max(0, courtSubtotal + serviceSubtotal - voucherDiscount);
    const depositPaid = ["UNPAID", "FAILED", "REFUNDED"].includes(b.paymentStatus) ? 0 : Number(b.depositAmount) || 0;
    const checkout = await prisma.checkout.findUnique({ where: { bookingId: b.id }, include: { payments: { where: { status: "PAID" } } } });
    const additionalPaid = checkout?.payments.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
    const remainingAmount = Math.max(0, grandTotal - depositPaid - additionalPaid);

    const courtFallback = {
      id: b.courtId,
      name: b.courtName || "Sân thể thao",
      partnerId: b.partnerId || ""
    };

    return {
      booking: {
        ...b,
        startTime: dbTime(b.startTime),
        endTime: dbTime(b.endTime),
        court: courtFallback,
        courtSurface: b.courtSurfaceId ? {
          id: b.courtSurfaceId,
          name: b.courtSurfaceName || "Sân con",
          code: b.courtSurfaceCode || ""
        } : null,
        checkedInAt: b.checkedInAt,
        user: {
          id: b.userId,
          fullName: b.userName || "Khách vãng lai",
          phone: b.userPhone || "",
          email: b.userEmail || ""
        }
      },
      courtSubtotal,
      serviceSubtotal,
      voucherDiscount,
      grandTotal,
      depositPaid,
      remainingAmount,
      activeServices
    };
  },

  async addServiceToBooking(bookingId: string, input: AddServiceToBookingInput, addedBy: string) {
    await ensureServiceTables();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get booking
      const bRows: any = await tx.$queryRawUnsafe(
        `SELECT b.id, b.court_id as "courtId", b.booking_code as "bookingCode", b.booking_date as "bookingDate", b.start_time as "startTime", b.checked_in_at as "checkedInAt", b.end_time as "endTime", b.booking_status as "bookingStatus", b.invoice_locked_at as "invoiceLockedAt" FROM bookings b WHERE b.id::text = $1::text LIMIT 1 FOR UPDATE;`,
        bookingId
      );
      if (!Array.isArray(bRows) || bRows.length === 0) throw new NotFoundError("Booking không tồn tại");
      const booking = bRows[0];
      assertInvoiceOpen(booking);

      // 2. Get service
      const sRows: any = await tx.$queryRawUnsafe(
        `SELECT s.id, s.name, s.type, s.price, s.cost_price as "costPrice", s.unit, s.status, s.track_inventory as "trackInventory"
         FROM services s JOIN courts c ON c.partner_id = s.partner_id WHERE s.id::text = $1::text AND c.id::text = $2::text LIMIT 1;`,
        input.serviceId, booking.courtId
      );

      if (!Array.isArray(sRows) || sRows.length === 0) {
        throw new ValidationError("Dịch vụ không hợp lệ");
      }
      const service = sRows[0];
      service.price = Number(service.price);
      if (service.status !== "ACTIVE") {
        throw new ValidationError("Dịch vụ hiện không hoạt động");
      }

      if (!["CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS", "CHECKOUT_PENDING", "COMPLETED"].includes(booking.bookingStatus)) {
        throw new ValidationError("Trạng thái booking không cho phép thêm dịch vụ");
      }
      if (!booking.checkedInAt && !nowWithinPlayWindow(booking)) {
        throw new ValidationError("Booking chưa tới giờ chơi hoặc đã quá giờ phục vụ, không thể thêm dịch vụ");
      }
      // Selling during the booked time checks the customer in; before it only the check-in button does, which applies
      // the court's early check-in policy. A COMPLETED booking keeps its status; an un-started one moves to IN_PROGRESS.
      if (!booking.checkedInAt && playHasStarted(booking)) {
        await tx.$executeRawUnsafe(
          `UPDATE bookings SET checked_in_at = NOW(),
                  booking_status = CASE WHEN booking_status IN ('CONFIRMED', 'DEPOSIT_PAID') THEN 'IN_PROGRESS'::booking_status ELSE booking_status END
           WHERE id::text = $1::text AND checked_in_at IS NULL;`,
          bookingId
        );
      }

      // 3. Check inventory if PRODUCT (locked row, atomic with the deduction below)
      if (service.trackInventory && service.type === "PRODUCT") {
        const inv = await ensureInventoryRowLocked(tx, service.id, service.unit);
        const available = Number(inv.quantity) - Number(inv.reservedQuantity);
        if (available < input.quantity) {
          throw new ValidationError(`Sản phẩm "${service.name}" không đủ tồn kho (Còn lại: ${Math.max(0, available)})`);
        }

        await tx.$executeRawUnsafe(
          `UPDATE service_inventories SET quantity = quantity - $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
          input.quantity, service.id
        );

        await tx.$executeRawUnsafe(
          `INSERT INTO inventory_transactions (id, service_id, type, quantity, unit_cost, reference_type, reference_id, note, created_at)
           VALUES (gen_random_uuid(), $1, 'SALE', $2, $3, 'BOOKING_SERVICE', $4, $5, NOW());`,
          service.id, input.quantity, Number(service.costPrice || 0), bookingId, `Bán dịch vụ cho booking ${booking.bookingCode}`
        );
      }

      // 3b. Rental gear: pieces out are held in stock until they come back (services without stock row: no limit)
      if (service.type === "RENTAL_SERVICE") {
        const stock = await rentalStockLocked(tx, service.id);
        if (stock) {
          const available = Number(stock.quantity) - Number(stock.reservedQuantity);
          if (available < input.quantity) {
            throw new ValidationError(`"${service.name}" chỉ còn ${Math.max(0, available)} để cho thuê`);
          }
          await tx.$executeRawUnsafe(
            `UPDATE service_inventories SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
            input.quantity, service.id
          );
        }
      }

      // 4. Calculate pricing
      const csRows: any = await tx.$queryRawUnsafe(
        `SELECT price_override as "priceOverride" FROM court_services WHERE court_id::text = $1::text AND (service_id::text = $2::text OR id::text = $2::text) LIMIT 1;`,
        booking.courtId, service.id
      );

      const unitPrice = Array.isArray(csRows) && csRows.length > 0 && csRows[0].priceOverride !== null
        ? Number(csRows[0].priceOverride)
        : Number(service.price);
      const totalPrice = unitPrice * input.quantity;

      // 5. Upsert booking service record
      const bsRows: any = await tx.$queryRawUnsafe(
        `SELECT id, quantity, price, unit_price as "unitPrice" FROM booking_services
         WHERE booking_id::text = $1::text AND (service_id::text = $2::text OR court_service_id::text = $2::text OR id::text = $2::text) AND (status = 'ACTIVE' OR status IS NULL) LIMIT 1;`,
        bookingId, input.serviceId
      );

      let bookingServiceRecord: any;
      if (Array.isArray(bsRows) && bsRows.length > 0) {
        const existing = bsRows[0];
        const newQty = Number(existing.quantity) + input.quantity;
        const newTotal = unitPrice * newQty;

        await tx.$executeRawUnsafe(
          `UPDATE booking_services SET quantity = $1, price = $2, unit_price = $3, total_price = $2, updated_at = NOW() WHERE id::text = $4::text;`,
          newQty, newTotal, unitPrice, existing.id
        );

        bookingServiceRecord = { id: existing.id, bookingId, serviceId: input.serviceId, quantity: newQty, totalPrice: newTotal };
      } else {
        const newBsId = `bs_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`; // 13 chars
        await tx.$executeRawUnsafe(
          `INSERT INTO booking_services (id, booking_id, service_id, quantity, price, unit_price, total_price, status, added_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $5, 'ACTIVE', $7, NOW(), NOW());`,
          newBsId, bookingId, input.serviceId, input.quantity, totalPrice, unitPrice, addedBy
        );

        bookingServiceRecord = { id: newBsId, bookingId, serviceId: input.serviceId, quantity: input.quantity, totalPrice };
      }

      // 6. Handle Rental Item creation if RENTAL_SERVICE
      if (service.type === "RENTAL_SERVICE") {
        for (let i = 0; i < input.quantity; i++) {
          await tx.$executeRawUnsafe(
            `INSERT INTO rental_items (id, booking_service_id, service_id, status, rental_start_time, created_at, updated_at)
             VALUES (gen_random_uuid(), $1::text, $2, 'RENTED', NOW(), NOW(), NOW());`,
            bookingServiceRecord.id, service.id
          );
        }
      }

      return bookingServiceRecord;
    }, { maxWait: 10_000, timeout: 20_000 });

    await checkoutRepository.getOrCreateCheckout(bookingId);
    return result;
  },

  async updateBookingServiceQuantity(bookingId: string, serviceId: string, quantity: number) {
    await ensureServiceTables();

    const result = await prisma.$transaction(async (tx) => {
      const lockRows: any = await tx.$queryRawUnsafe(
        `SELECT invoice_locked_at as "invoiceLockedAt" FROM bookings WHERE id::text = $1::text FOR UPDATE;`,
        bookingId
      );
      if (Array.isArray(lockRows) && lockRows.length) assertInvoiceOpen(lockRows[0]);
      const bsRows: any = await tx.$queryRawUnsafe(
        `SELECT bs.id, bs.booking_id as "bookingId", bs.service_id as "serviceId", bs.quantity, bs.price, bs.unit_price as "unitPrice", s.unit, s.track_inventory as "trackInventory", s.type, s.name
         FROM booking_services bs
         LEFT JOIN services s ON bs.service_id::text = s.id::text
         WHERE bs.booking_id::text = $1::text AND (bs.service_id::text = $2::text OR bs.id::text = $2::text OR bs.court_service_id::text = $2::text)
           AND (bs.status = 'ACTIVE' OR bs.status IS NULL)
         ORDER BY bs.updated_at DESC LIMIT 1;`,
        bookingId, serviceId
      );

      if (!Array.isArray(bsRows) || bsRows.length === 0) {
        throw new NotFoundError("Dịch vụ không có trong booking");
      }

      const item = bsRows[0];
      const currentQty = Number(item.quantity);
      const diff = quantity - currentQty;
      if (diff === 0) return item;

      const tracksInventory = Boolean(item.serviceId && item.trackInventory && item.type === "PRODUCT");
      const isRental = Boolean(item.serviceId && item.type === "RENTAL_SERVICE");

      // Rental gear: fewer pieces put the latest ones back; more pieces need free stock and new rental items.
      if (isRental && diff < 0) {
        await returnRentedPieces(tx, item.id, item.serviceId, quantity <= 0 ? currentQty : Math.abs(diff), "Bớt khỏi hoá đơn");
      } else if (isRental && diff > 0) {
        const stock = await rentalStockLocked(tx, item.serviceId);
        if (stock) {
          const available = Number(stock.quantity) - Number(stock.reservedQuantity);
          if (available < diff) throw new ValidationError(`"${item.name}" chỉ còn ${Math.max(0, available)} để cho thuê`);
          await tx.$executeRawUnsafe(
            `UPDATE service_inventories SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
            diff, item.serviceId
          );
        }
        for (let piece = 0; piece < diff; piece += 1) {
          await tx.$executeRawUnsafe(
            `INSERT INTO rental_items (id, booking_service_id, service_id, status, rental_start_time, created_at, updated_at)
             VALUES (gen_random_uuid(), $1::text, $2, 'RENTED', NOW(), NOW(), NOW());`,
            item.id, item.serviceId
          );
        }
      }

      if (quantity <= 0) {
        await tx.$executeRawUnsafe(
          `UPDATE booking_services SET status = 'CANCELLED', updated_at = NOW() WHERE id::text = $1::text;`,
          item.id
        );

        if (tracksInventory) {
          await ensureInventoryRowLocked(tx, item.serviceId, item.unit);
          await tx.$executeRawUnsafe(
            `UPDATE service_inventories SET quantity = quantity + $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
            currentQty, item.serviceId
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO inventory_transactions (id, service_id, type, quantity, unit_cost, reference_type, reference_id, note, created_at)
             VALUES (gen_random_uuid(), $1, 'ADJUSTMENT', $2, 0, 'BOOKING_SERVICE', $3, $4, NOW());`,
            item.serviceId, currentQty, bookingId, `Hủy dịch vụ khỏi booking ${bookingId}`
          );
        }
        return null;
      }

      if (tracksInventory && diff > 0) {
        const inv = await ensureInventoryRowLocked(tx, item.serviceId, item.unit);
        const available = Number(inv.quantity) - Number(inv.reservedQuantity);
        if (available < diff) {
          throw new ValidationError(`Tồn kho không đủ (Còn ${available})`);
        }
      }

      const unitPrice = Number(item.unitPrice || item.price || 0);
      const totalPrice = unitPrice * quantity;

      await tx.$executeRawUnsafe(
        `UPDATE booking_services SET quantity = $1, price = $2, total_price = $2, updated_at = NOW() WHERE id::text = $3::text;`,
        quantity, totalPrice, item.id
      );

      if (tracksInventory) {
        if (diff > 0) {
          await tx.$executeRawUnsafe(
            `UPDATE service_inventories SET quantity = quantity - $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
            diff, item.serviceId
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO inventory_transactions (id, service_id, type, quantity, unit_cost, reference_type, reference_id, note, created_at)
             VALUES (gen_random_uuid(), $1, 'SALE', $2, 0, 'BOOKING_SERVICE', $3, $4, NOW());`,
            item.serviceId, diff, bookingId, `Tăng số lượng dịch vụ trong booking ${bookingId}`
          );
        } else if (diff < 0) {
          await ensureInventoryRowLocked(tx, item.serviceId, item.unit);
          await tx.$executeRawUnsafe(
            `UPDATE service_inventories SET quantity = quantity + $1, updated_at = NOW() WHERE service_id::text = $2::text;`,
            Math.abs(diff), item.serviceId
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO inventory_transactions (id, service_id, type, quantity, unit_cost, reference_type, reference_id, note, created_at)
             VALUES (gen_random_uuid(), $1, 'ADJUSTMENT', $2, 0, 'BOOKING_SERVICE', $3, $4, NOW());`,
            item.serviceId, Math.abs(diff), bookingId, `Giảm số lượng dịch vụ trong booking ${bookingId}`
          );
        }
      }

      return { id: item.id, bookingId, serviceId, quantity, totalPrice };
    }, { maxWait: 10_000, timeout: 20_000 });

    await checkoutRepository.getOrCreateCheckout(bookingId);
    return result;
  },

  async removeBookingService(bookingId: string, serviceId: string) {
    return this.updateBookingServiceQuantity(bookingId, serviceId, 0);
  },

  async returnRentalItem(input: ReturnRentalItemInput) {
    await ensureServiceTables();
    return prisma.$transaction(async (tx) => {
      const item = await tx.rentalItem.findUnique({
        where: { id: input.rentalItemId },
        include: { service: true }
      });
      if (!item) throw new NotFoundError("Thiết bị thuê không tồn tại");

      // Only a piece still out: a second click or another counter cannot return it (or write off stock) twice.
      const { count } = await tx.rentalItem.updateMany({
        where: { id: input.rentalItemId, status: "RENTED" },
        data: { status: input.status as any, returnedAt: new Date(), notes: input.notes ?? null }
      });
      if (!count) throw new ConflictError("Thiết bị này đã được xử lý trả rồi");
      const updated = await tx.rentalItem.findUniqueOrThrow({ where: { id: input.rentalItemId } });
      await releaseRentalStock(tx, item.serviceId, 1, input.status === "DAMAGED" || input.status === "LOST" ? 1 : 0);

      if (input.status === "DAMAGED" || input.status === "LOST") {
        await tx.inventoryTransaction.create({
          data: {
            serviceId: item.serviceId,
            type: input.status as any,
            quantity: 1,
            unitCost: Number(item.service.costPrice),
            referenceType: "RENTAL_RETURN",
            referenceId: input.rentalItemId,
            note: input.notes ?? `Thiết bị cho thuê bị ${input.status === "DAMAGED" ? "hỏng" : "mất"}`
          }
        });
      }

      return updated;
    });
  },

  async releaseBookingServices(bookingId: string, reason: string) {
    await ensureServiceTables();

    const bsRows = await prisma.bookingService
      .findMany({
        where: { bookingId, OR: [{ status: "ACTIVE" }, { status: null as any }] },
        select: {
          id: true,
          serviceId: true,
          quantity: true,
          service: { select: { type: true, trackInventory: true } }
        }
      })
      .catch(() => []);

    if (!bsRows.length) return;

    await prisma.bookingService
      .updateMany({
        where: { id: { in: bsRows.map((bs) => bs.id) } },
        data: { status: "CANCELLED", updatedAt: new Date() }
      })
      .catch(() => {});

    const productRows = bsRows.filter(
      (bs) => bs.serviceId && bs.service?.trackInventory && bs.service?.type === "PRODUCT"
    );

    if (productRows.length) {
      const qtyByService = new Map<string, number>();
      for (const bs of productRows) {
        qtyByService.set(bs.serviceId!, (qtyByService.get(bs.serviceId!) ?? 0) + bs.quantity);
      }
      await Promise.all(
        [...qtyByService.entries()].map(([serviceId, qty]) =>
          prisma.serviceInventory
            .updateMany({
              where: { serviceId },
              data: { quantity: { increment: qty }, updatedAt: new Date() }
            })
            .catch(() => {})
        )
      );

      await prisma.inventoryTransaction
        .createMany({
          data: productRows.map((bs) => ({
            serviceId: bs.serviceId!,
            type: "ADJUSTMENT",
            quantity: bs.quantity,
            unitCost: 0,
            referenceType: "BOOKING_SERVICE",
            referenceId: bookingId,
            note: reason
          }))
        })
        .catch(() => {});
    }

    const rentalRows = bsRows.filter((bs) => bs.service?.type === "RENTAL_SERVICE" && bs.serviceId);
    for (const bs of rentalRows) {
      await prisma
        .$transaction((tx) => returnRentedPieces(tx, bs.id, bs.serviceId!, Number(bs.quantity) || 1_000, reason))
        .catch((error) => console.error("[Cashier] Releasing rental pieces failed:", error));
    }
  }
};
