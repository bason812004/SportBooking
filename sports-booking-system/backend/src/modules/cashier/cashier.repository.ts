import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { ensureServiceTables, serviceRepository } from "../services/service.repository.js";
import type { AddServiceToBookingInput, ReturnRentalItemInput } from "./cashier.types.js";

function dbTime(value: any) {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  if (typeof value === "string") return value.slice(0, 5);
  return value;
}

async function ensureInventoryRowLocked(tx: Prisma.TransactionClient, serviceId: string, unit: string) {
  await tx.$executeRawUnsafe(
    `INSERT INTO service_inventories (id, service_id, quantity, minimum_stock, unit)
     VALUES (gen_random_uuid(), $1::uuid, 50, 5, $2)
     ON CONFLICT (service_id) DO NOTHING;`,
    serviceId, unit || "cái"
  );
  const rows: any = await tx.$queryRawUnsafe(
    `SELECT quantity, reserved_quantity as "reservedQuantity" FROM service_inventories WHERE service_id::text = $1::text FOR UPDATE;`,
    serviceId
  );
  return rows[0];
}

export const cashierRepository = {
  async getActiveBookings(partnerId: string, courtId?: string) {
    await ensureServiceTables();

    // 1. Fetch Courts
    const courts: any[] = (await prisma.$queryRawUnsafe(
      `SELECT c.id, c.name, cc.name as "categoryName"
       FROM courts c
       LEFT JOIN court_categories cc ON c.category_id = cc.id
       WHERE c.partner_id = $1::text ${courtId ? `OR c.id = '${courtId}'` : ""};`,
      partnerId
    ).catch(() => [])) as any[];

    const courtMap = new Map(courts.map((c) => [c.id, c]));
    const courtIds = Array.from(courtMap.keys());
    if (courtIds.length === 0) return [];

    // 2. Fetch Active Bookings
    const bRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT b.id, b.booking_code as "bookingCode", b.court_id as "courtId", b.user_id as "userId",
              b.booking_date as "bookingDate", b.start_time as "startTime", b.end_time as "endTime",
              b.total_price as "totalPrice", b.deposit_amount as "depositAmount", b.booking_status as "bookingStatus",
              b.payment_status as "paymentStatus", b.payment_method as "paymentMethod",
              u.full_name as "userName", u.phone as "userPhone", u.email as "userEmail"
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.court_id = ANY($1::text[])
         AND b.booking_status IN ('CONFIRMED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'CHECKOUT_PENDING')
         AND b.booking_date::date = CURRENT_DATE
         AND b.checked_in_at IS NOT NULL
       ORDER BY b.start_time ASC;`,
      courtIds
    ).catch(() => [])) as any[];

    if (!Array.isArray(bRows) || bRows.length === 0) return [];

    const bookingIds = bRows.map((b) => b.id);

    // 3. Fetch Booking Services
    const bsRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT bs.id, bs.booking_id as "bookingId", bs.service_id as "serviceId", bs.court_service_id as "courtServiceId",
              bs.quantity, bs.price, bs.unit_price as "unitPrice", bs.total_price as "totalPrice", bs.status,
              COALESCE(s.name, cs.name, 'Dịch vụ') as "name",
              COALESCE(s.unit, 'đơn vị') as "unit",
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
          type: bs.type || "PRODUCT",
          quantity: Number(bs.quantity),
          price: Number(bs.price || bs.totalPrice || 0),
          unitPrice: Number(bs.unitPrice || 0),
          totalPrice: Number(bs.totalPrice || bs.price || 0),
          status: bs.status || "ACTIVE",
          service: {
            id: bs.serviceId || bs.courtServiceId,
            name: bs.name,
            unit: bs.unit,
            type: bs.type || "PRODUCT"
          }
        });
        bsGrouped.set(bs.bookingId, list);
      }
    }

    // 4. Construct Response
    return bRows.map((b) => {
      const courtSubtotal = Number(b.totalPrice) || 0;
      const activeServices = bsGrouped.get(b.id) || [];
      const serviceSubtotal = activeServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
      const totalAmount = courtSubtotal + serviceSubtotal;
      const depositPaid = Number(b.depositAmount) || 0;
      const remainingAmount = Math.max(0, totalAmount - depositPaid);

      const courtObj = courtMap.get(b.courtId) || { id: b.courtId, name: "Sân bóng" };

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

  async getBookingDetailForCashier(bookingId: string, skipSeed = false) {
    await ensureServiceTables();

    // 1. Fetch Booking
    const bRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT b.id, b.booking_code as "bookingCode", b.court_id as "courtId", b.user_id as "userId",
              b.booking_date as "bookingDate", b.start_time as "startTime", b.end_time as "endTime",
              b.total_price as "totalPrice", b.deposit_amount as "depositAmount", b.booking_status as "bookingStatus",
              b.payment_status as "paymentStatus", b.payment_method as "paymentMethod", b.admin_note as "adminNote", b.note,
              u.full_name as "userName", u.phone as "userPhone", u.email as "userEmail",
              c.name as "courtName", c.partner_id as "partnerId"
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN courts c ON b.court_id = c.id
       WHERE b.id::text = $1::text OR b.booking_code::text = $1::text OR b.booking_order_id::text = $1::text
       LIMIT 1;`,
      bookingId
    ).catch(() => [])) as any[];

    if (!Array.isArray(bRows) || bRows.length === 0) {
      throw new NotFoundError("Booking không tồn tại");
    }

    const b = bRows[0];

    // Auto seed default services for partner so cashier POS always has products
    if (!skipSeed) {
      const targetPartnerId = b.partnerId || "partner_01";
      if (targetPartnerId && typeof (serviceRepository as any).seedDefaultPartnerServices === "function") {
        await (serviceRepository as any).seedDefaultPartnerServices(targetPartnerId).catch(() => {});
      }
    }

    // 2. Fetch Booking Services
    const bsRows: any[] = (await prisma.$queryRawUnsafe(
      `SELECT bs.id, bs.booking_id as "bookingId", bs.service_id as "serviceId", bs.court_service_id as "courtServiceId",
              bs.quantity, bs.price, bs.unit_price as "unitPrice", bs.total_price as "totalPrice", bs.status,
              COALESCE(s.name, cs.name, 'Dịch vụ') as "name",
              COALESCE(s.unit, 'đơn vị') as "unit",
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
          type: bs.type || "PRODUCT",
          quantity: Number(bs.quantity),
          price: Number(bs.price || bs.totalPrice || 0),
          unitPrice: Number(bs.unitPrice || 0),
          totalPrice: Number(bs.totalPrice || bs.price || 0),
          status: bs.status || "ACTIVE",
          service: {
            id: bs.serviceId || bs.courtServiceId,
            name: bs.name,
            unit: bs.unit,
            type: bs.type || "PRODUCT"
          }
        }))
      : [];

    const courtSubtotal = Number(b.totalPrice) || 0;
    const serviceSubtotal = activeServices.reduce((sum, item) => sum + Number(item.totalPrice || item.price || 0), 0);
    const voucherDiscount = Number(b.voucherDiscountAmount) || 0;
    const grandTotal = Math.max(0, courtSubtotal + serviceSubtotal - voucherDiscount);
    const depositPaid = Number(b.depositAmount) || 0;
    const remainingAmount = Math.max(0, grandTotal - depositPaid);

    const courtFallback = {
      id: b.courtId,
      name: b.courtName || "Sân Sala 1",
      partnerId: b.partnerId || ""
    };

    return {
      booking: {
        ...b,
        startTime: dbTime(b.startTime),
        endTime: dbTime(b.endTime),
        court: courtFallback,
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

    return prisma.$transaction(async (tx) => {
      // 1. Get booking
      const bRows: any = await tx.$queryRawUnsafe(
        `SELECT b.id, b.court_id as "courtId", b.booking_code as "bookingCode", b.booking_date as "bookingDate", b.start_time as "startTime", b.checked_in_at as "checkedInAt" FROM bookings b WHERE b.id::text = $1::text LIMIT 1;`,
        bookingId
      ).catch(() => []);
      if (!Array.isArray(bRows) || bRows.length === 0) throw new NotFoundError("Booking không tồn tại");
      const booking = bRows[0];

      // 2. Get service
      const sRows: any = await tx.$queryRawUnsafe(
        `SELECT s.id, s.name, s.type, s.price, s.cost_price as "costPrice", s.unit, s.status, s.track_inventory as "trackInventory"
         FROM services s WHERE s.id::text = $1::text LIMIT 1;`,
        input.serviceId
      ).catch(() => []);

      if (!Array.isArray(sRows) || sRows.length === 0) {
        throw new ValidationError("Dịch vụ không hợp lệ");
      }
      const service = sRows[0];
      service.price = Number(service.price);
      if (service.status !== "ACTIVE") {
        throw new ValidationError("Dịch vụ hiện không hoạt động");
      }

      if (service.type !== "RENTAL_SERVICE" && !booking.checkedInAt) {
        throw new ValidationError("Khách chưa check-in, chưa thể bán dịch vụ");
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
           VALUES (gen_random_uuid(), $1::uuid, 'SALE', $2, $3, 'BOOKING_SERVICE', $4, $5, NOW());`,
          service.id, input.quantity, Number(service.costPrice || 0), bookingId, `Bán dịch vụ cho booking ${booking.bookingCode}`
        );
      }

      // 4. Calculate pricing
      const csRows: any = await tx.$queryRawUnsafe(
        `SELECT price_override as "priceOverride" FROM court_services WHERE court_id::text = $1::text AND (service_id::text = $2::text OR id::text = $2::text) LIMIT 1;`,
        booking.courtId, service.id
      ).catch(() => []);

      const unitPrice = Array.isArray(csRows) && csRows.length > 0 && csRows[0].priceOverride !== null
        ? Number(csRows[0].priceOverride)
        : Number(service.price);
      const totalPrice = unitPrice * input.quantity;

      // 5. Upsert booking service record
      const bsRows: any = await tx.$queryRawUnsafe(
        `SELECT id, quantity, price, unit_price as "unitPrice" FROM booking_services
         WHERE booking_id::text = $1::text AND (service_id::text = $2::text OR court_service_id::text = $2::text OR id::text = $2::text) AND (status = 'ACTIVE' OR status IS NULL) LIMIT 1;`,
        bookingId, input.serviceId
      ).catch(() => []);

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
             VALUES (gen_random_uuid(), $1::text, $2::uuid, 'RENTED', NOW(), NOW(), NOW());`,
            bookingServiceRecord.id, service.id
          );
        }
      }

      return bookingServiceRecord;
    });
  },

  async updateBookingServiceQuantity(bookingId: string, serviceId: string, quantity: number) {
    await ensureServiceTables();

    return prisma.$transaction(async (tx) => {
      const bsRows: any = await tx.$queryRawUnsafe(
        `SELECT bs.id, bs.booking_id as "bookingId", bs.service_id as "serviceId", bs.quantity, bs.price, bs.unit_price as "unitPrice", s.unit, s.track_inventory as "trackInventory", s.type
         FROM booking_services bs
         LEFT JOIN services s ON bs.service_id::text = s.id::text
         WHERE bs.booking_id::text = $1::text AND (bs.service_id::text = $2::text OR bs.id::text = $2::text OR bs.court_service_id::text = $2::text)
           AND (bs.status = 'ACTIVE' OR bs.status IS NULL)
         ORDER BY bs.updated_at DESC LIMIT 1;`,
        bookingId, serviceId
      ).catch(() => []);

      if (!Array.isArray(bsRows) || bsRows.length === 0) {
        throw new NotFoundError("Dịch vụ không có trong booking");
      }

      const item = bsRows[0];
      const currentQty = Number(item.quantity);
      const diff = quantity - currentQty;
      if (diff === 0) return item;

      const tracksInventory = Boolean(item.serviceId && item.trackInventory && item.type === "PRODUCT");

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
             VALUES (gen_random_uuid(), $1::uuid, 'ADJUSTMENT', $2, 0, 'BOOKING_SERVICE', $3, $4, NOW());`,
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
             VALUES (gen_random_uuid(), $1::uuid, 'SALE', $2, 0, 'BOOKING_SERVICE', $3, $4, NOW());`,
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
             VALUES (gen_random_uuid(), $1::uuid, 'ADJUSTMENT', $2, 0, 'BOOKING_SERVICE', $3, $4, NOW());`,
            item.serviceId, Math.abs(diff), bookingId, `Giảm số lượng dịch vụ trong booking ${bookingId}`
          );
        }
      }

      return { id: item.id, bookingId, serviceId, quantity, totalPrice };
    });
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

      const updated = await tx.rentalItem.update({
        where: { id: input.rentalItemId },
        data: {
          status: input.status as any,
          returnedAt: new Date(),
          notes: input.notes ?? null
        }
      });

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

    const rentalBsIds = bsRows.filter((bs) => bs.service?.type === "RENTAL_SERVICE").map((bs) => bs.id);
    if (rentalBsIds.length) {
      await prisma.rentalItem
        .updateMany({
          where: { bookingServiceId: { in: rentalBsIds }, status: "RENTED" },
          data: { status: "RETURNED", returnedAt: new Date(), notes: reason }
        })
        .catch(() => {});
    }
  }
};
