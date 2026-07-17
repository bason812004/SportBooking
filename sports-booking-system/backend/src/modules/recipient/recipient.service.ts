import { BookingStatus, CourtActiveStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import {
  bookingStartsAt,
  ceilToFullHour,
  dayTypeFor,
  durationHours,
  floorToFullHour,
  parseLimit,
  parsePage,
  timeToDate,
  timeToMinutes,
  toDbDate
} from "../../shared/utils/time.js";
import { commissionService } from "../commission/commission.service.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { paymentProvider } from "../payments/providers/index.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { settlementService } from "../settlements/settlement.service.js";

function dbTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function addMinutes(value: Date, minutes: number) {
  return timeToDate(minutesToTime(timeToMinutes(dbTime(value)) + minutes));
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function bookingCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `WI${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

function paymentReference() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SBK-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function bookingOrderBy(sortBy?: string, sortOrder?: string) {
  const order: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "customerName":
      return [{ user: { fullName: order } }, { createdAt: "desc" as const }];
    case "totalPrice":
      return [{ totalPrice: order }, { createdAt: "desc" as const }];
    case "bookingStatus":
      return [{ bookingStatus: order }, { createdAt: "desc" as const }];
    case "paymentStatus":
      return [{ paymentStatus: order }, { createdAt: "desc" as const }];
    default:
      return [{ bookingDate: order }, { startTime: order }, { createdAt: "desc" as const }];
  }
}

async function nextPrefixedId(prefix: string, sequenceName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `select '${prefix}' || lpad(nextval('${sequenceName}')::text, 4, '0') as id`
  );
  return rows[0].id;
}

function overlapWhere(startTime: Date, endTime: Date) {
  return {
    startTime: { lt: endTime },
    endTime: { gt: startTime }
  };
}

function overlapsSlot(slot: { startTime: string; endTime: string }, item: { startTime: Date; endTime: Date }) {
  return timeToMinutes(slot.startTime) < timeToMinutes(dbTime(item.endTime)) && timeToMinutes(slot.endTime) > timeToMinutes(dbTime(item.startTime));
}

function slotPrice(slot: { startTime: string; endTime: string }, date: string, prices: Array<{ dayType: string; startTime: Date; endTime: Date; price: unknown }>) {
  const dayType = dayTypeFor(date);
  const matched = prices.find(
    (price) =>
      price.dayType === dayType &&
      timeToMinutes(slot.startTime) >= timeToMinutes(dbTime(price.startTime)) &&
      timeToMinutes(slot.endTime) <= timeToMinutes(dbTime(price.endTime))
  );
  if (matched) return Number(matched.price);
  return prices.length ? Math.min(...prices.map((price) => Number(price.price))) : 0;
}

const activeOperationStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED];
const extendableBookingStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED];

async function getManagedCourtId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managedCourtId: true }
  });
  if (!user || !user.managedCourtId) {
    throw new ForbiddenError("Tài khoản của bạn chưa được phân công quản lý sân nào");
  }
  return user.managedCourtId;
}

export const recipientService = {
  async dashboard(userId: string) {
    const courtId = await getManagedCourtId(userId);

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      select: { name: true }
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsToday = await prisma.booking.count({
      where: {
        courtId,
        bookingDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const pendingBookings = await prisma.booking.count({
      where: {
        courtId,
        bookingStatus: "PENDING"
      }
    });

    const revenue = await prisma.booking.aggregate({
      where: {
        courtId,
        bookingStatus: "COMPLETED",
        paymentStatus: "PAID"
      },
      _sum: {
        totalPrice: true
      }
    });

    const recentBookings = await prisma.booking.findMany({
      where: { courtId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        totalPrice: true,
        bookingStatus: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    return {
      courtName: court?.name || "Sân chưa đặt tên",
      bookingsToday,
      pendingBookings,
      revenue: Number(revenue._sum.totalPrice ?? 0),
      recentBookings
    };
  },

  async bookings(
    userId: string,
    query: { page?: string; limit?: string; status?: BookingStatus; fromDate?: string; toDate?: string; sortBy?: string; sortOrder?: string }
  ) {
    const courtId = await getManagedCourtId(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);

    const whereClause: any = { courtId };
    if (query.status) {
      whereClause.bookingStatus = query.status;
    }
    if (query.fromDate && query.toDate) {
      if (query.fromDate > query.toDate) throw new ValidationError("Khoảng ngày không hợp lệ");
      whereClause.bookingDate = {
        gte: toDbDate(query.fromDate),
        lte: toDbDate(query.toDate)
      };
    } else if (query.fromDate) {
      whereClause.bookingDate = {
        gte: toDbDate(query.fromDate)
      };
    } else if (query.toDate) {
      whereClause.bookingDate = {
        lte: toDbDate(query.toDate)
      };
    }

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        orderBy: bookingOrderBy(query.sortBy, query.sortOrder),
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              phone: true
            }
          },
          courtSurface: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      }),
      prisma.booking.count({ where: whereClause })
    ]);

    return { items, meta: paginationMeta(page, limit, total) };
  },

  async updateBookingStatus(userId: string, bookingId: string, status: BookingStatus) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, courtId }
    });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");

    const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
      PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      CONFIRMED: [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: []
    };
    if (!(transitions[booking.bookingStatus] ?? []).includes(status)) {
      throw new ValidationError("Không thể chuyển trạng thái đơn theo thao tác này");
    }
    if (
      (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) &&
      new Date() < bookingStartsAt(booking.bookingDate, booking.endTime)
    ) {
      throw new ValidationError("Chỉ có thể kết thúc đơn sau giờ đặt sân");
    }

    const { updated, settlement } = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data:
          status === BookingStatus.CANCELLED
            ? {
                bookingStatus: status,
                cancelReason: "Nhân viên sân từ chối",
                cancelledAt: new Date(),
                refundAmount: booking.paymentStatus === "PAID" ? booking.totalPrice : 0,
                platformRetainedAmount: 0,
                paymentStatus: booking.paymentStatus === "PAID" ? "REFUNDED" : booking.paymentStatus
              }
            : {
                bookingStatus: status
              },
        include: { court: { include: { partner: true } } }
      });

      let updatedSettlement = null;
      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        await commissionService.createEarning(updatedBooking, status, tx);
        updatedSettlement = await settlementService.settleForBooking(booking.id, tx);
      } else if (status === BookingStatus.CANCELLED) {
        updatedSettlement = await settlementService.cancelForBooking(booking.id, tx);
      }
      return { updated: updatedBooking, settlement: updatedSettlement };
    });

    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return updated;
  },

  async calendar(userId: string, query: { fromDate: string; toDate: string }) {
    const courtId = await getManagedCourtId(userId);
    if (query.fromDate > query.toDate) throw new ValidationError("Khoảng ngày không hợp lệ");

    const [court, items] = await Promise.all([
      prisma.court.findUnique({ where: { id: courtId }, select: { openingTime: true, closingTime: true } }),
      prisma.booking.findMany({
        where: {
          courtId,
          bookingDate: {
            gte: toDbDate(query.fromDate),
            lte: toDbDate(query.toDate)
          }
        },
        select: {
          id: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          bookingStatus: true,
          paymentStatus: true,
          totalPrice: true,
          courtSurfaceId: true,
          courtSurface: {
            select: { id: true, name: true, code: true }
          },
          user: {
            select: {
              fullName: true,
              phone: true
            }
          }
        }
      })
    ]);
    if (!court) throw new NotFoundError("Khong tim thay co so duoc giao quan ly");

    return {
      court: { openingTime: dbTime(court.openingTime), closingTime: dbTime(court.closingTime) },
      items
    };
  },

  async courtSurfaces(userId: string) {
    const courtId = await getManagedCourtId(userId);
    return prisma.courtSurface.findMany({
      where: { courtId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }]
    });
  },

  async updateCourtSurfaceStatus(userId: string, courtSurfaceId: string, status: CourtActiveStatus) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc quyen quan ly cua ban");

    return prisma.courtSurface.update({
      where: { id: courtSurfaceId },
      data: { status }
    });
  },

  async surfaceAvailability(userId: string, courtSurfaceId: string, date: string) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc quyen quan ly cua ban");

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      select: { openingTime: true, closingTime: true, prices: true }
    });
    if (!court) throw new NotFoundError("Khong tim thay co so duoc giao quan ly");

    const bookings = await prisma.booking.findMany({
      where: {
        courtId,
        OR: [{ courtSurfaceId }, { courtSurfaceId: null }],
        bookingDate: toDbDate(date),
        bookingStatus: { in: activeOperationStatuses }
      },
      select: { startTime: true, endTime: true }
    });

    const opening = ceilToFullHour(timeToMinutes(dbTime(court.openingTime)));
    const closing = floorToFullHour(timeToMinutes(dbTime(court.closingTime)));

    const slots = [];
    for (let cursor = opening; cursor < closing; cursor += 60) {
      const slot = { startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + 60) };
      const status = bookings.some((booking) => overlapsSlot(slot, booking)) ? "BOOKED" : "AVAILABLE";
      const price = slotPrice(slot, date, court.prices);
      slots.push({ ...slot, status, price });
    }

    return {
      courtSurfaceId,
      date,
      openingTime: dbTime(court.openingTime),
      closingTime: dbTime(court.closingTime),
      slotDurationMinutes: 60,
      slots
    };
  },

  async operations(userId: string, query: { date?: string; nowTime?: string }) {
    const courtId = await getManagedCourtId(userId);
    const selectedDate = query.date ?? new Date().toISOString().slice(0, 10);
    const nowTime = query.nowTime ?? new Date().toTimeString().slice(0, 5);
    const nowMinutes = timeToMinutes(nowTime);

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: {
        surfaces: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }] },
        bookings: {
          where: {
            bookingDate: toDbDate(selectedDate),
            bookingStatus: { in: activeOperationStatuses }
          },
          include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
          orderBy: { startTime: "asc" }
        }
      }
    });
    if (!court) throw new NotFoundError("Khong tim thay co so duoc giao quan ly");

    const items = court.surfaces.map((surface) => {
      const bookings = court.bookings
        .filter((booking) => booking.courtSurfaceId === surface.id || booking.courtSurfaceId == null)
        .map((booking) => ({ ...booking, start: dbTime(booking.startTime), end: dbTime(booking.endTime) }));

      const currentBooking = bookings.find((booking) => timeToMinutes(booking.start) <= nowMinutes && timeToMinutes(booking.end) > nowMinutes);
      const latestEnded = [...bookings]
        .filter((booking) => timeToMinutes(booking.end) <= nowMinutes)
        .sort((left, right) => timeToMinutes(right.end) - timeToMinutes(left.end))[0];
      const nextBooking = bookings.find((booking) => timeToMinutes(booking.start) >= nowMinutes);
      const isOverdue = Boolean(!currentBooking && latestEnded && nowMinutes - timeToMinutes(latestEnded.end) <= 30 && !nextBooking);
      const minutesLeft = currentBooking ? timeToMinutes(currentBooking.end) - nowMinutes : null;

      let canExtend = false;
      if (currentBooking) {
        const minExtensionEnd = timeToMinutes(currentBooking.end) + 15;
        canExtend = !nextBooking || timeToMinutes(nextBooking.start) >= minExtensionEnd;
      }

      let status: "AVAILABLE" | "OCCUPIED" | "ENDING_SOON" | "OVERDUE" | "RESERVED_SOON" | "INACTIVE" = "AVAILABLE";
      if (surface.status === "INACTIVE") status = "INACTIVE";
      else if (isOverdue) status = "OVERDUE";
      else if (currentBooking && minutesLeft != null && minutesLeft <= 15) status = "ENDING_SOON";
      else if (currentBooking) status = "OCCUPIED";
      else if (nextBooking && timeToMinutes(nextBooking.start) - nowMinutes <= 30) status = "RESERVED_SOON";

      const serializeBooking = (booking?: (typeof bookings)[number]) =>
        booking
          ? {
              id: booking.id,
              bookingCode: booking.bookingCode,
              customerName: booking.user.fullName,
              customerPhone: booking.user.phone,
              customerEmail: booking.user.email,
              startTime: booking.start,
              endTime: booking.end,
              bookingStatus: booking.bookingStatus,
              paymentStatus: booking.paymentStatus,
              totalPrice: Number(booking.totalPrice)
            }
          : null;

      return {
        surface: {
          id: surface.id,
          code: surface.code,
          name: surface.name,
          capacity: surface.capacity,
          surface: surface.surface,
          size: surface.size,
          imageUrl: surface.imageUrl,
          status: surface.status
        },
        status,
        minutesLeft,
        currentBooking: serializeBooking(currentBooking),
        latestEndedBooking: serializeBooking(isOverdue ? latestEnded : undefined),
        nextBooking: serializeBooking(nextBooking),
        canExtend
      };
    });

    return {
      court: { id: court.id, name: court.name },
      date: selectedDate,
      nowTime,
      summary: {
        total: items.length,
        available: items.filter((item) => item.status === "AVAILABLE").length,
        occupied: items.filter((item) => item.status === "OCCUPIED").length,
        endingSoon: items.filter((item) => item.status === "ENDING_SOON").length,
        overdue: items.filter((item) => item.status === "OVERDUE").length,
        reservedSoon: items.filter((item) => item.status === "RESERVED_SOON").length
      },
      items
    };
  },

  async extendBooking(userId: string, bookingId: string, minutes: number) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the gia han don dang cho xu ly hoac da xac nhan");
    }

    const newEndTime = addMinutes(booking.endTime, minutes);
    const conflict = await prisma.booking.findFirst({
      where: {
        id: { not: booking.id },
        courtId,
        OR: booking.courtSurfaceId ? [{ courtSurfaceId: booking.courtSurfaceId }, { courtSurfaceId: null }] : undefined,
        bookingDate: booking.bookingDate,
        bookingStatus: { in: activeOperationStatuses },
        ...overlapWhere(booking.endTime, newEndTime)
      }
    });
    if (conflict) throw new ConflictError("San nay da co lich sau do. Hay chuyen khach sang san trong.", "BOOKING_EXTENSION_CONFLICT");

    const date = booking.bookingDate.toISOString().slice(0, 10);
    const startTime = dbTime(booking.endTime);
    const endTime = dbTime(newEndTime);
    const dynamicPrice = await dynamicPricingService.calculate(courtId, { date, startTime, endTime });
    const hours = durationHours(startTime, endTime);
    const subtotal = dynamicPrice.finalPrice * hours;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endTime: newEndTime,
          basePrice: { increment: dynamicPrice.basePrice * hours },
          dynamicAdjustmentAmount: { increment: dynamicPrice.dynamicAdjustmentAmount * hours },
          subtotal: { increment: subtotal },
          totalPrice: { increment: subtotal }
        }
      });

      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, endTime: booking.endTime },
        data: {
          endTime: newEndTime,
          slotPrice: { increment: subtotal }
        }
      });

      return updated;
    });
  },

  async createWalkInBooking(
    userId: string,
    input: {
      courtSurfaceId: string;
      customerName: string;
      customerPhone: string;
      bookingDate: string;
      startTime: string;
      minutes: number;
      paymentMethod: PaymentMethod;
      note?: string;
    }
  ) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: input.courtSurfaceId, courtId, status: CourtActiveStatus.ACTIVE } });
    if (!surface) throw new NotFoundError("San con khong ton tai hoac dang tam ngung");

    const startTime = timeToDate(input.startTime);
    const endTime = timeToDate(minutesToTime(timeToMinutes(input.startTime) + input.minutes));
    const conflict = await prisma.booking.findFirst({
      where: {
        courtId,
        OR: [{ courtSurfaceId: input.courtSurfaceId }, { courtSurfaceId: null }],
        bookingDate: toDbDate(input.bookingDate),
        bookingStatus: { in: activeOperationStatuses },
        ...overlapWhere(startTime, endTime)
      }
    });
    if (conflict) throw new ConflictError("Khung gio nay da co khach khac", "WALK_IN_BOOKING_CONFLICT");

    const activeBlock = await prisma.courtAvailabilityBlock.findFirst({
      where: {
        courtId,
        status: "ACTIVE",
        blockDate: toDbDate(input.bookingDate),
        OR: [{ courtSurfaceId: null }, { courtSurfaceId: input.courtSurfaceId }],
        ...overlapWhere(startTime, endTime)
      }
    });
    if (activeBlock) throw new ConflictError("San dang trong lich nghi/bao tri, khong the dat", "WALK_IN_BOOKING_BLOCKED");

    const dynamicPrice = await dynamicPricingService.calculate(courtId, {
      date: input.bookingDate,
      startTime: input.startTime,
      endTime: dbTime(endTime)
    });
    const hours = durationHours(input.startTime, dbTime(endTime));
    const subtotal = dynamicPrice.finalPrice * hours;

    const existingUser = await prisma.user.findFirst({ where: { phone: input.customerPhone } });
    const customer =
      existingUser ??
      (await prisma.user.create({
        data: {
          id: await nextPrefixedId("u", "seq_users"),
          fullName: input.customerName,
          email: `walkin-${input.customerPhone.replace(/\D/g, "") || Date.now()}-${Date.now()}@walkin.sportsbooking.local`,
          phone: input.customerPhone,
          emailVerified: false
        }
      }));
    const bookingId = await nextPrefixedId("b", "seq_bookings");

    let paymentInput: { reference: string; expiresAt: Date; providerResult: Awaited<ReturnType<typeof paymentProvider.createQrPayment>> } | null = null;
    if (input.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_EXPIRES_MINUTES * 60 * 1000);
      const reference = paymentReference();
      const orderId =
        env.PAYMENT_PROVIDER === "PAYOS"
          ? String(Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")))
          : `${reference}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const providerResult = await paymentProvider.createQrPayment({
        amount: subtotal,
        currency: "VND",
        orderId,
        paymentReference: reference,
        description: "Thanh toan dat san tai quay",
        expiresAt
      });
      paymentInput = { reference, expiresAt, providerResult };
    }

    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          id: bookingId,
          bookingCode: bookingCode(),
          userId: customer.id,
          courtId,
          courtSurfaceId: input.courtSurfaceId,
          bookingDate: toDbDate(input.bookingDate),
          startTime,
          endTime,
          basePrice: dynamicPrice.basePrice * hours,
          dynamicAdjustmentAmount: dynamicPrice.dynamicAdjustmentAmount * hours,
          subtotal,
          totalPrice: subtotal,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === PaymentMethod.CASH ? "PAID" : "UNPAID",
          bookingStatus: BookingStatus.CONFIRMED,
          note: input.note
        }
      });

      await tx.bookingSlot.create({
        data: {
          bookingId: booking.id,
          courtId,
          bookingDate: toDbDate(input.bookingDate),
          startTime,
          endTime,
          slotPrice: subtotal
        }
      });

      let payment = null;
      if (paymentInput) {
        payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            userId: customer.id,
            provider: paymentInput.providerResult.provider,
            paymentMethod: "QR_TRANSFER",
            paymentType: "FULL_PAYMENT",
            amount: subtotal,
            currency: "VND",
            status: "PENDING",
            externalOrderId: paymentInput.providerResult.externalOrderId,
            qrCodeUrl: paymentInput.providerResult.qrCodeUrl ?? undefined,
            qrPayload: paymentInput.providerResult.qrPayload ?? undefined,
            paymentReference: paymentInput.reference,
            expiresAt: paymentInput.expiresAt
          }
        });
      }

      return { booking, payment };
    });
  },

  async paymentStatus(userId: string, paymentId: string) {
    const courtId = await getManagedCourtId(userId);
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, booking: { courtId } },
      include: { booking: { select: { bookingStatus: true } } }
    });
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan thuoc quyen quan ly cua ban");

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      status: payment.status,
      bookingStatus: payment.booking.bookingStatus,
      amount: Number(payment.amount),
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt
    };
  },

  async confirmWalkInPayment(userId: string, paymentId: string) {
    const courtId = await getManagedCourtId(userId);
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, booking: { courtId } } });
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan thuoc quyen quan ly cua ban");
    if (payment.status === "PAID") return payment;

    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({ where: { id: paymentId }, data: { status: "PAID", paidAt: new Date() } }),
      prisma.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: "PAID" } })
    ]);

    return updatedPayment;
  },

  async earlyCheckInBooking(userId: string, bookingId: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the check-in don dang cho xu ly hoac da xac nhan");
    }

    const today = new Date().toISOString().slice(0, 10);
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chi co the check-in som cho booking hom nay");

    const currentTime = new Date().toTimeString().slice(0, 5);
    if (timeToMinutes(currentTime) >= timeToMinutes(dbTime(booking.startTime))) {
      return booking;
    }

    const newStartTime = timeToDate(currentTime);
    const conflict = await prisma.booking.findFirst({
      where: {
        id: { not: booking.id },
        courtId,
        OR: booking.courtSurfaceId ? [{ courtSurfaceId: booking.courtSurfaceId }, { courtSurfaceId: null }] : undefined,
        bookingDate: booking.bookingDate,
        bookingStatus: { in: activeOperationStatuses },
        ...overlapWhere(newStartTime, booking.startTime)
      }
    });
    if (conflict) throw new ConflictError("San dang co khach, khong the check-in som", "EARLY_CHECK_IN_CONFLICT");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { startTime: newStartTime, bookingStatus: BookingStatus.CONFIRMED }
      });
      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, startTime: booking.startTime },
        data: { startTime: newStartTime }
      });
      return updated;
    });
  },

  async earlyCheckOutBooking(userId: string, bookingId: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the check-out don dang cho xu ly hoac da xac nhan");
    }

    const today = new Date().toISOString().slice(0, 10);
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chi co the check-out cho booking hom nay");

    const currentTime = new Date().toTimeString().slice(0, 5);
    if (timeToMinutes(currentTime) <= timeToMinutes(dbTime(booking.startTime)) || timeToMinutes(currentTime) >= timeToMinutes(dbTime(booking.endTime))) {
      throw new ValidationError("Chi co the check-out khi booking dang dien ra");
    }

    const newEndTime = timeToDate(currentTime);
    const checkoutNote = `Khach check-out luc ${currentTime}`;
    const { updated, settlement } = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endTime: newEndTime,
          bookingStatus: BookingStatus.COMPLETED,
          note: booking.note ? `${booking.note}\n${checkoutNote}` : checkoutNote
        },
        include: { court: { include: { partner: true } } }
      });

      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, endTime: booking.endTime },
        data: { endTime: newEndTime }
      });

      await commissionService.createEarning(updatedBooking, BookingStatus.COMPLETED, tx);
      const updatedSettlement = await settlementService.settleForBooking(booking.id, tx);
      return { updated: updatedBooking, settlement: updatedSettlement };
    });

    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return updated;
  }
};
