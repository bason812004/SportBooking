import { BookingStatus, CourtActiveStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { normalizeBookingServices } from "../../shared/utils/bookingServices.js";
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
  toDbDate,
  vietnamNow
} from "../../shared/utils/time.js";
import { bookingRepository } from "../bookings/booking.repository.js";
import { calculateMinimumDeposit, courtCancellationPayment, refundRequiredAdminEvent } from "../bookings/booking.calculations.js";
import { enqueueAdminEvent } from "../notifications/notificationOutbox.repository.js";
import { commissionService } from "../commission/commission.service.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { syncPaymentWithProvider } from "../payments/payment.poller.js";
import { paymentRepository } from "../payments/payment.repository.js";
import { paymentService } from "../payments/payment.service.js";
import { paymentProvider } from "../payments/providers/index.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { settlementService } from "../settlements/settlement.service.js";
import { cashierRepository } from "../cashier/cashier.repository.js";
import { earlyCheckInWindow, scaleCourtPrice, toTimeChargePolicy } from "./recipient.calculations.js";

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

function addWeeks(date: string, weeks: number) {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + weeks * 7);
  return base.toISOString().slice(0, 10);
}

function bookingCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `WI${stamp}${Math.floor(Math.random() * 900 + 100)}`;
}

// One-time legacy data fixup (assigns any orphan bookings to a default court/surface) — only
// needs to run once per server process, not on every single call to `bookings()`.
let orphanBookingsAssigned = false;

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

const activeOperationStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID, BookingStatus.IN_PROGRESS, BookingStatus.CHECKOUT_PENDING, BookingStatus.COMPLETED];
const extendableBookingStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID, BookingStatus.IN_PROGRESS, BookingStatus.CHECKOUT_PENDING];

async function extensionConflictFor(
  courtId: string,
  booking: { id: string; endTime: Date; bookingDate: Date },
  courtSurfaceId: string | null,
  newEndTime: Date
) {
  return prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      courtId,
      OR: courtSurfaceId ? [{ courtSurfaceId }, { courtSurfaceId: null }] : undefined,
      bookingDate: booking.bookingDate,
      bookingStatus: { in: activeOperationStatuses },
      ...overlapWhere(booking.endTime, newEndTime)
    }
  });
}

type WalkInSlot = { courtSurfaceId: string; bookingDate: string; startTime: Date; endTime: Date };
type WalkInSlotProblem = "BOOKED" | "BLOCKED" | "DUPLICATE";

const walkInSkipReasons: Record<WalkInSlotProblem, string> = {
  BOOKED: "Khung gio nay da co khach khac",
  BLOCKED: "San dang trong lich nghi/bao tri",
  DUPLICATE: "Trung voi buoi khac trong cung yeu cau"
};

/**
 * Index -> problem for walk-in slots that hit an active booking, an availability block, or an
 * earlier slot of the same request. Two queries in total, however many slots are passed.
 */
async function walkInSlotProblems(client: Prisma.TransactionClient, courtId: string, slots: WalkInSlot[]) {
  const problems = new Map<number, WalkInSlotProblem>();
  if (!slots.length) return problems;
  const bookingDates = [...new Set(slots.map((slot) => slot.bookingDate))].map((date) => toDbDate(date));
  const surfaceFilter = [{ courtSurfaceId: { in: [...new Set(slots.map((slot) => slot.courtSurfaceId))] } }, { courtSurfaceId: null }];
  const [bookings, blocks] = await Promise.all([
    client.booking.findMany({
      where: { courtId, bookingDate: { in: bookingDates }, bookingStatus: { in: activeOperationStatuses }, OR: surfaceFilter },
      select: { courtSurfaceId: true, bookingDate: true, startTime: true, endTime: true }
    }),
    client.courtAvailabilityBlock.findMany({
      where: { courtId, status: "ACTIVE", blockDate: { in: bookingDates }, OR: surfaceFilter },
      select: { courtSurfaceId: true, blockDate: true, startTime: true, endTime: true }
    })
  ]);
  const taken = [
    ...bookings.map((item) => ({ ...item, bookingDate: item.bookingDate.toISOString().slice(0, 10), problem: "BOOKED" as const })),
    ...blocks.map((item) => ({ ...item, bookingDate: item.blockDate.toISOString().slice(0, 10), problem: "BLOCKED" as const }))
  ];
  const overlaps = (slot: WalkInSlot, other: { courtSurfaceId: string | null; bookingDate: string; startTime: Date; endTime: Date }) =>
    (other.courtSurfaceId === null || other.courtSurfaceId === slot.courtSurfaceId) &&
    other.bookingDate === slot.bookingDate &&
    slot.startTime < other.endTime &&
    slot.endTime > other.startTime;

  slots.forEach((slot, index) => {
    const hit = taken.find((item) => overlaps(slot, item));
    if (hit) problems.set(index, hit.problem);
    else if (slots.slice(0, index).some((earlier, earlierIndex) => !problems.has(earlierIndex) && overlaps(slot, earlier))) problems.set(index, "DUPLICATE");
  });
  return problems;
}

function assertNoWalkInSlotProblems(problems: Map<number, WalkInSlotProblem>, slots: WalkInSlot[]) {
  for (const [index, problem] of problems) {
    const date = slots[index].bookingDate;
    if (problem === "BLOCKED") throw new ConflictError(`San dang trong lich nghi/bao tri ngay ${date}`, "WALK_IN_BOOKING_BLOCKED");
    throw new ConflictError(
      problem === "DUPLICATE" ? `Cac khung gio da chon ngay ${date} bi trung nhau` : `Khung gio ngay ${date} da co khach khac`,
      "WALK_IN_BOOKING_CONFLICT"
    );
  }
}

/** Postgres aborts one of two Serializable transactions that booked the same slot at once (P2034). */
function walkInSerializationConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    throw new ConflictError("Khung gio vua duoc dat o noi khac, vui long tai lai lich va thu lai", "WALK_IN_BOOKING_CONFLICT");
  }
  throw error;
}

/** Walk-in slots must fit the court's opening hours (the hours the staff grid shows) and must not be over already. */
async function assertWalkInSlotsBookable(courtId: string, slots: Array<{ bookingDate: string; startTime: string; minutes: number }>) {
  const court = await prisma.court.findUnique({ where: { id: courtId }, select: { openingTime: true, closingTime: true } });
  if (!court) throw new NotFoundError("Khong tim thay co so duoc giao quan ly");
  const opening = dbTime(court.openingTime);
  const closing = dbTime(court.closingTime);
  const now = vietnamNow();
  for (const slot of slots) {
    const start = timeToMinutes(slot.startTime);
    const end = start + slot.minutes;
    const label = `${slot.startTime}-${minutesToTime(end)}`;
    if (start < timeToMinutes(opening) || end > timeToMinutes(closing)) {
      throw new ValidationError(`Khung gio ${label} nam ngoai gio mo cua ${opening}-${closing}`);
    }
    if (slot.bookingDate < now.date || (slot.bookingDate === now.date && end <= timeToMinutes(now.time))) {
      throw new ValidationError(`Khung gio ${label} ngay ${slot.bookingDate} da qua`);
    }
  }
}

type PricingPrefetch = Awaited<ReturnType<typeof dynamicPricingService.prefetch>>;

/**
 * Court charge priced hour by hour, exactly like an online booking of the same hourly grid slots: each
 * piece between full hours gets its own base price and dynamic rules, rounded like bookingPricing.
 * A 15:37-16:37 "Bắt đầu ngay" booking is priced as 15:37-16:00 plus 16:00-16:37.
 */
function walkInCourtPrice(prefetched: PricingPrefetch, date: string, startTime: string, minutes: number) {
  const end = timeToMinutes(startTime) + minutes;
  let basePrice = 0;
  let courtSubtotal = 0;
  for (let cursor = timeToMinutes(startTime); cursor < end; ) {
    const next = Math.min(end, (Math.floor(cursor / 60) + 1) * 60);
    const hours = (next - cursor) / 60;
    const price = dynamicPricingService.resolveFromPrefetched(prefetched, { date, startTime: minutesToTime(cursor), endTime: minutesToTime(next) });
    basePrice += Math.round(price.basePrice * hours);
    courtSubtotal += Math.round(price.finalPrice * hours);
    cursor = next;
  }
  return { basePrice, dynamicAdjustmentAmount: courtSubtotal - basePrice, courtSubtotal };
}

/**
 * Customer account for a walk-in booking, found by the (already normalized) phone. Only USER accounts
 * count, so a staff, partner or admin sharing the number is never booked as the customer; otherwise a
 * walk-in account is created. `matchedExisting` lets the counter say which account the booking went to.
 */
async function resolveWalkInCustomer(customerName: string, customerPhone: string) {
  const existing = await prisma.user.findFirst({ where: { phone: customerPhone, role: "USER" }, orderBy: { createdAt: "asc" } });
  const customer =
    existing ??
    (await prisma.user.create({
      data: {
        id: await nextPrefixedId("u", "seq_users"),
        fullName: customerName,
        email: `walkin-${customerPhone.replace(/\D/g, "") || Date.now()}-${Date.now()}@walkin.sportsbooking.local`,
        phone: customerPhone,
        emailVerified: false
      }
    }));
  return { customer, summary: { id: customer.id, fullName: customer.fullName, phone: customer.phone, matchedExisting: Boolean(existing) } };
}

async function courtTimeChargePolicy(courtId: string) {
  const court = await prisma.court.findUnique({
    where: { id: courtId },
    select: { earlyFreeMinutes: true, earlyMaxMinutes: true, earlyPricePercent: true, extensionPricePercent: true }
  });
  if (!court) throw new NotFoundError("Khong tim thay co so duoc giao quan ly");
  return toTimeChargePolicy(court);
}

/** Charge for `minutes` of extra play from `startTime`: the hour-by-hour court price times the partner's %. */
function extraTimeCharge(prefetched: PricingPrefetch, date: string, startTime: string, minutes: number, percent: number) {
  if (minutes <= 0) return { amount: 0, basePrice: 0, dynamicAdjustmentAmount: 0 };
  return scaleCourtPrice(walkInCourtPrice(prefetched, date, startTime, minutes), percent);
}

function appendNote(note: string | null, line: string) {
  return note ? `${note}\n${line}` : line;
}

function noteAmount(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}d`;
}

export async function getManagedCourtId(userId: string) {
  const [user] = await prisma.$queryRaw<Array<{ managedCourtId: string | null }>>`
    select managed_court_id as "managedCourtId"
    from users
    where id = ${userId}
      and role = 'RECIPIENT'::user_role
    limit 1
  `;
  if (!user || !user.managedCourtId) {
    throw new ForbiddenError("Tài khoản của bạn chưa được phân công quản lý sân nào");
  }
  return user.managedCourtId;
}

export const recipientService = {
  async dashboard(userId: string) {
    const courtId = await getManagedCourtId(userId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [court, bookingsToday, pendingBookings, revenue, recentBookings] = await Promise.all([
      prisma.court.findUnique({
        where: { id: courtId },
        select: { name: true }
      }),
      prisma.booking.count({
        where: {
          courtId,
          bookingDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      }),
      prisma.booking.count({
        where: {
          courtId,
          bookingStatus: "PENDING"
        }
      }),
      prisma.booking.aggregate({
        where: {
          courtId,
          bookingStatus: "COMPLETED",
          paymentStatus: "PAID"
        },
        _sum: {
          totalPrice: true
        }
      }),
      prisma.booking.findMany({
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
      })
    ]);

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

    // Auto assign unassigned bookings to Sân Sala 1 - Sân 01 (one-time legacy fixup — only
    // run once per server process instead of on every call, which was adding 2-4 extra
    // round-trips plus a full-table UPDATE scan to every single page load of this list).
    if (!orphanBookingsAssigned) {
      orphanBookingsAssigned = true;
      try {
        const salaCourt = (await prisma.court.findFirst({
          where: { name: { contains: "Sala", mode: "insensitive" } },
          include: { surfaces: true }
        })) || (await prisma.court.findFirst({ include: { surfaces: true } }));

        if (salaCourt) {
          let surface01 = salaCourt.surfaces[0];
          if (!surface01) {
            surface01 = (await prisma.courtSurface.create({
              data: {
                courtId: salaCourt.id,
                code: "S01",
                name: `${salaCourt.name} - Sân 01`,
                capacity: "7 người",
                surface: "Cỏ nhân tạo",
                size: "Tiêu chuẩn",
                status: "ACTIVE",
                sortOrder: 1
              }
            }).catch(() => null)) as any;
          }

          if (surface01) {
            await prisma.$executeRawUnsafe(
              `UPDATE bookings SET court_id = $1, court_surface_id = $2 WHERE court_surface_id IS NULL OR court_id IS NULL;`,
              salaCourt.id,
              surface01.id
            ).catch(() => {});
          }
        }
      } catch {}
    }

    const bookingInclude = {
      user: {
        select: {
          fullName: true,
          email: true,
          phone: true
        }
      },
      court: {
        select: {
          id: true,
          name: true
        }
      },
      courtSurface: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      bookingServices: { include: { service: true, courtService: true } }
    };

    // Bookings created together as one walk-in order (see createWalkInBookingOrder)
    // share a bookingOrderId and should page/display as a single group, not as N
    // separate rows. Since a group can't be split across pages, paginate over
    // deduped group keys first, then fetch the full rows for the selected page.
    const matchingRows = await prisma.booking.findMany({
      where: whereClause,
      orderBy: bookingOrderBy(query.sortBy, query.sortOrder),
      select: { id: true, bookingOrderId: true }
    });

    const groupKeys: string[] = [];
    const isOrderKey = new Map<string, boolean>();
    const seen = new Set<string>();
    for (const row of matchingRows) {
      const key = row.bookingOrderId ?? row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      groupKeys.push(key);
      isOrderKey.set(key, Boolean(row.bookingOrderId));
    }

    const total = groupKeys.length;
    const pageKeys = groupKeys.slice((page - 1) * limit, (page - 1) * limit + limit);
    const orderIds = pageKeys.filter((key) => isOrderKey.get(key));
    const standaloneIds = pageKeys.filter((key) => !isOrderKey.get(key));

    const [orderBookingsRaw, standaloneBookingsRaw] = await Promise.all([
      prisma.booking.findMany({
        where: { courtId, bookingOrderId: { in: orderIds } },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
        include: bookingInclude
      }),
      prisma.booking.findMany({
        where: { courtId, id: { in: standaloneIds } },
        include: bookingInclude
      })
    ]);
    const orderBookings = orderBookingsRaw.map(normalizeBookingServices);
    const standaloneBookings = standaloneBookingsRaw.map(normalizeBookingServices);

    const bookingsByOrderId = new Map<string, typeof orderBookings>();
    for (const booking of orderBookings) {
      const key = booking.bookingOrderId!;
      const list = bookingsByOrderId.get(key);
      if (list) list.push(booking);
      else bookingsByOrderId.set(key, [booking]);
    }
    const standaloneById = new Map(standaloneBookings.map((booking) => [booking.id, booking]));

    const items = pageKeys.map((key) =>
      isOrderKey.get(key)
        ? { orderId: key, bookings: bookingsByOrderId.get(key) ?? [] }
        : { orderId: null, bookings: [standaloneById.get(key)!] }
    );

    return { items, meta: paginationMeta(page, limit, total) };
  },

  async lookupCustomersByPhone(userId: string, phone: string) {
    const courtId = await getManagedCourtId(userId);
    // Same rule as resolveWalkInCustomer: only USER accounts can be the customer of a walk-in booking.
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: phone }, role: "USER" },
      select: { id: true, fullName: true, phone: true },
      orderBy: { createdAt: "asc" },
      take: 8
    });

    const userIds = users.map((user) => user.id);
    const stats = userIds.length
      ? await prisma.booking.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, courtId },
          _count: true,
          _max: { bookingDate: true }
        })
      : [];
    const statsByUserId = new Map(stats.map((row) => [row.userId, row]));

    const matches = users
      .map((user) => {
        const stat = statsByUserId.get(user.id);
        return {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          bookingsCount: stat?._count ?? 0,
          lastBookingDate: stat?._max.bookingDate ?? null
        };
      })
      // Partial numbers only suggest this court's customers. The full number also reveals an account with no
      // history here, because the booking will be attached to it: staff must see that name before submitting.
      .filter((match) => match.bookingsCount > 0 || match.phone === phone);

    return { matches };
  },

  async customerBookingHistory(userId: string, customerId: string) {
    const courtId = await getManagedCourtId(userId);
    const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { id: true, fullName: true, phone: true } });
    if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

    const bookings = await prisma.booking.findMany({
      where: { userId: customerId, courtId },
      orderBy: { bookingDate: "desc" },
      take: 20,
      include: {
        courtSurface: { select: { name: true, code: true } }
      }
    });

    return { customer, bookings: bookings.map((booking) => ({ ...booking, totalPrice: Number(booking.totalPrice) })) };
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
      const cancellation =
        status === BookingStatus.CANCELLED
          ? courtCancellationPayment(booking.paymentStatus, Number(booking.totalPrice), await bookingRepository.onlineCollectedAmount(tx, booking))
          : null;
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: cancellation
          ? {
              bookingStatus: status,
              cancelReason: "Nhân viên sân từ chối",
              cancelledAt: new Date(),
              refundAmount: cancellation.refundAmount,
              platformRetainedAmount: 0,
              paymentStatus: cancellation.paymentStatus
            }
          : {
              bookingStatus: status
            },
        include: { court: { include: { partner: true } }, user: { select: { fullName: true, phone: true } } }
      });
      if (cancellation?.refundByAdmin) {
        await enqueueAdminEvent(tx, refundRequiredAdminEvent(updatedBooking, cancellation.refundByAdmin, "Nhân viên sân"));
      }

      let updatedSettlement = null;
      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        await commissionService.createEarning(updatedBooking, status, tx);
        updatedSettlement = await settlementService.settleForBooking(booking.id, tx);
        if (status === BookingStatus.COMPLETED) await settlementService.chargePartnerCollected(booking.id, tx);
      } else if (status === BookingStatus.CANCELLED) {
        updatedSettlement = await settlementService.cancelForBooking(booking.id, tx);
      }
      return { updated: updatedBooking, settlement: updatedSettlement };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );

    if (status === BookingStatus.CANCELLED || status === BookingStatus.NO_SHOW) {
      await cashierRepository
        .releaseBookingServices(booking.id, status === BookingStatus.CANCELLED ? "Tự động trả do đơn bị huỷ" : "Tự động trả do khách không đến")
        .catch(() => {});
    }

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
    const [surfaces, court] = await Promise.all([
      prisma.courtSurface.findMany({
        where: { courtId },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }]
      }),
      prisma.court.findUnique({ where: { id: courtId }, select: { deposit_percent: true } })
    ]);
    const depositPercent = Number(court?.deposit_percent ?? 0);
    return surfaces.map((surface) => ({ ...surface, depositPercent }));
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

    const [bookings, blocks] = await Promise.all([
      prisma.booking.findMany({
        where: {
          courtId,
          OR: [{ courtSurfaceId }, { courtSurfaceId: null }],
          bookingDate: toDbDate(date),
          bookingStatus: { in: activeOperationStatuses }
        },
        select: {
          id: true,
          bookingCode: true,
          bookingStatus: true,
          startTime: true,
          endTime: true,
          user: { select: { fullName: true, phone: true } }
        }
      }),
      prisma.courtAvailabilityBlock.findMany({
        where: {
          courtId,
          OR: [{ courtSurfaceId }, { courtSurfaceId: null }],
          blockDate: toDbDate(date),
          status: "ACTIVE"
        },
        select: { id: true, startTime: true, endTime: true, reason: true }
      })
    ]);

    const opening = ceilToFullHour(timeToMinutes(dbTime(court.openingTime)));
    const closing = floorToFullHour(timeToMinutes(dbTime(court.closingTime)));

    // Same per-hour price (base + dynamic rules) the walk-in booking will charge, so "Tạm tính" matches the QR.
    // Without an approved court or a price table booking fails with its own message; keep the plain table price.
    const pricing = await dynamicPricingService.prefetch(courtId).catch(() => null);
    const priceFor = (slot: { startTime: string; endTime: string }) => {
      if (pricing) {
        try {
          return walkInCourtPrice(pricing, date, slot.startTime, 60).courtSubtotal;
        } catch {
          // fall through to the table price
        }
      }
      return slotPrice(slot, date, court.prices);
    };

    const slots = [];
    for (let cursor = opening; cursor < closing; cursor += 60) {
      const slot = { startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + 60) };
      const booking = bookings.find((item) => overlapsSlot(slot, item));
      const block = !booking ? blocks.find((item) => overlapsSlot(slot, item)) : undefined;
      const price = priceFor(slot);
      slots.push({
        ...slot,
        status: booking ? "BOOKED" : block ? "BLOCKED" : "AVAILABLE",
        price,
        bookingId: booking?.id ?? null,
        bookingCode: booking?.bookingCode ?? null,
        bookingStatus: booking?.bookingStatus ?? null,
        customerName: booking?.user.fullName ?? null,
        customerPhone: booking?.user.phone ?? null,
        blockId: block?.id ?? null,
        reason: block?.reason ?? null
      });
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

  async lockSurfaceSlot(
    userId: string,
    courtSurfaceId: string,
    input: { bookingDate: string; startTime: string; minutes: number; reason?: string }
  ) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Khong tim thay san con thuoc quyen quan ly cua ban");

    const startTime = timeToDate(input.startTime);
    const endTime = timeToDate(minutesToTime(timeToMinutes(input.startTime) + input.minutes));

    const conflict = await prisma.booking.findFirst({
      where: {
        courtId,
        OR: [{ courtSurfaceId }, { courtSurfaceId: null }],
        bookingDate: toDbDate(input.bookingDate),
        bookingStatus: { in: activeOperationStatuses },
        ...overlapWhere(startTime, endTime)
      }
    });
    if (conflict) throw new ConflictError("Khung gio nay da co khach dat, khong the khoa", "LOCK_SLOT_CONFLICT");

    return prisma.courtAvailabilityBlock.create({
      data: {
        courtId,
        courtSurfaceId,
        blockDate: toDbDate(input.bookingDate),
        startTime,
        endTime,
        reason: input.reason,
        status: "ACTIVE"
      }
    });
  },

  async unlockSurfaceSlot(userId: string, blockId: string) {
    const courtId = await getManagedCourtId(userId);
    const block = await prisma.courtAvailabilityBlock.findFirst({ where: { id: blockId, courtId } });
    if (!block) throw new NotFoundError("Khong tim thay lich khoa nay");
    return prisma.courtAvailabilityBlock.update({ where: { id: blockId }, data: { status: "INACTIVE" } });
  },

  async operations(userId: string, query: { date?: string; nowTime?: string }) {
    const courtId = await getManagedCourtId(userId);
    const vnNow = vietnamNow();
    const selectedDate = query.date ?? vnNow.date;
    const nowTime = query.nowTime ?? vnNow.time;
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
              totalPrice: Number(booking.totalPrice),
              checkedInAt: booking.checkedInAt ? booking.checkedInAt.toISOString() : null
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
          status: surface.status,
          depositPercent: Number(court.deposit_percent ?? 0)
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

  async getAvailableSurfacesForExtension(userId: string, bookingId: string, minutes: number) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");

    const newEndTime = addMinutes(booking.endTime, minutes);
    const surfaces = await prisma.courtSurface.findMany({
      where: { courtId, id: { not: booking.courtSurfaceId ?? undefined } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, name: true }
    });

    const available = [];
    for (const surface of surfaces) {
      const conflict = await extensionConflictFor(courtId, booking, surface.id, newEndTime);
      if (!conflict) available.push(surface);
    }
    return available;
  },

  /**
   * Prices shown on the counter's "+N phút" and "Check-in sớm" buttons, computed exactly as extendBooking
   * and checkInBooking will charge them. The early check-in part is a snapshot of "now" (Vietnam time).
   */
  async timeChargeQuote(userId: string, bookingId: string, extendMinutes: number[]) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    const [policy, pricing] = await Promise.all([courtTimeChargePolicy(courtId), dynamicPricingService.prefetch(courtId)]);
    const date = booking.bookingDate.toISOString().slice(0, 10);

    const extensions = extendMinutes.map((minutes) => ({
      minutes,
      amount: extraTimeCharge(pricing, date, dbTime(booking.endTime), minutes, policy.extensionPricePercent).amount
    }));

    const now = vietnamNow();
    const startMinutes = timeToMinutes(dbTime(booking.startTime));
    let earlyCheckIn: (ReturnType<typeof earlyCheckInWindow> & { amount: number }) | null = null;
    if (date === now.date && !booking.checkedInAt && timeToMinutes(now.time) < startMinutes) {
      const early = earlyCheckInWindow(policy, timeToMinutes(now.time), startMinutes);
      const amount = early.allowed ? extraTimeCharge(pricing, date, now.time, early.chargedMinutes, policy.earlyPricePercent).amount : 0;
      earlyCheckIn = { ...early, amount };
    }

    return { policy, extensions, earlyCheckIn };
  },

  async extendBooking(userId: string, bookingId: string, minutes: number, targetSurfaceId?: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the gia han don dang cho xu ly hoac da xac nhan");
    }

    const newEndTime = addMinutes(booking.endTime, minutes);
    let surfaceId = booking.courtSurfaceId;

    if (targetSurfaceId && targetSurfaceId !== booking.courtSurfaceId) {
      const surface = await prisma.courtSurface.findFirst({ where: { id: targetSurfaceId, courtId } });
      if (!surface) throw new NotFoundError("Khong tim thay san con thuoc quyen quan ly cua ban");
      const conflict = await extensionConflictFor(courtId, booking, targetSurfaceId, newEndTime);
      if (conflict) throw new ConflictError("San duoc chon cung da co lich, vui long chon san khac", "BOOKING_EXTENSION_CONFLICT");
      surfaceId = targetSurfaceId;
    } else {
      const conflict = await extensionConflictFor(courtId, booking, booking.courtSurfaceId, newEndTime);
      if (conflict) throw new ConflictError("San nay da co lich sau do. Hay chuyen khach sang san trong.", "BOOKING_EXTENSION_CONFLICT");
    }

    const date = booking.bookingDate.toISOString().slice(0, 10);
    // The partner's extension % of the hour-by-hour court price, the same figure the quote showed staff.
    const [policy, pricing] = await Promise.all([courtTimeChargePolicy(courtId), dynamicPricingService.prefetch(courtId)]);
    const charge = extraTimeCharge(pricing, date, dbTime(booking.endTime), minutes, policy.extensionPricePercent);

    const { updated } = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          endTime: newEndTime,
          courtSurfaceId: surfaceId,
          basePrice: { increment: charge.basePrice },
          dynamicAdjustmentAmount: { increment: charge.dynamicAdjustmentAmount },
          subtotal: { increment: charge.amount },
          totalPrice: { increment: charge.amount },
          note: appendNote(booking.note, `Gia han +${minutes} phut (${policy.extensionPricePercent}% gia gio): ${noteAmount(charge.amount)}`)
        }
      });

      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, endTime: booking.endTime },
        data: {
          endTime: newEndTime,
          court_surface_id: surfaceId,
          slotPrice: { increment: charge.amount }
        }
      });

      // Additional court time is collected at checkout.
      return { updated: updatedBooking };
    });

    return updated;
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
      paymentMethod: typeof PaymentMethod.CASH | typeof PaymentMethod.BANK_TRANSFER;
      paymentType?: "FULL_PAYMENT" | "DEPOSIT" | "PAY_AT_COURT";
      note?: string;
      services?: Array<{ serviceId: string; quantity: number }>;
    }
  ) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: input.courtSurfaceId, courtId, status: CourtActiveStatus.ACTIVE } });
    if (!surface) throw new NotFoundError("San con khong ton tai hoac dang tam ngung");
    await assertWalkInSlotsBookable(courtId, [input]);

    const payLater = input.paymentType === "PAY_AT_COURT";
    const paymentMethod = payLater ? PaymentMethod.CASH : input.paymentMethod;
    const wantsDeposit = input.paymentType === "DEPOSIT";
    const depositPercent = wantsDeposit ? await bookingRepository.courtDepositPercent(courtId) : 0;
    if (wantsDeposit && depositPercent <= 0) throw new ValidationError("San nay khong ho tro dat coc");

    const startTime = timeToDate(input.startTime);
    const endTime = timeToDate(minutesToTime(timeToMinutes(input.startTime) + input.minutes));
    const requestedSlots = [{ courtSurfaceId: input.courtSurfaceId, bookingDate: input.bookingDate, startTime, endTime }];
    // Fail fast before a QR is created; checked again inside the Serializable transaction below.
    assertNoWalkInSlotProblems(await walkInSlotProblems(prisma, courtId, requestedSlots), requestedSlots);

    const courtPrice = walkInCourtPrice(await dynamicPricingService.prefetch(courtId), input.bookingDate, input.startTime, input.minutes);
    const courtSubtotal = courtPrice.courtSubtotal;

    const serviceIds = (input.services ?? []).map((s) => s.serviceId);
    const availableServices = serviceIds.length ? await bookingRepository.services(serviceIds, courtId) : [];
    if (availableServices.length !== serviceIds.length) throw new ValidationError("Dich vu khong hop le");
    const serviceLines = (input.services ?? []).map((line) => {
      const service = availableServices.find((item) => item.id === line.serviceId)!;
      return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
    });
    const servicesSubtotal = serviceLines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const subtotal = courtSubtotal + servicesSubtotal;
    const chargeAmount = payLater ? 0 : wantsDeposit ? calculateMinimumDeposit(courtSubtotal, depositPercent) : courtSubtotal;

    const { customer, summary: customerSummary } = await resolveWalkInCustomer(input.customerName, input.customerPhone);
    const bookingId = await nextPrefixedId("b", "seq_bookings");

    let paymentInput: { reference: string; expiresAt: Date; providerResult: Awaited<ReturnType<typeof paymentProvider.createQrPayment>> } | null = null;
    if (!payLater && paymentMethod === PaymentMethod.BANK_TRANSFER) {
      const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_EXPIRES_MINUTES * 60 * 1000);
      const reference = paymentReference();
      const orderId =
        env.PAYMENT_PROVIDER === "PAYOS"
          ? String(Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")))
          : `${reference}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const providerResult = await paymentProvider.createQrPayment({
        amount: chargeAmount,
        currency: "VND",
        orderId,
        paymentReference: reference,
        description: wantsDeposit ? "Dat coc san tai quay" : "Thanh toan dat san tai quay",
        expiresAt
      });
      paymentInput = { reference, expiresAt, providerResult };
    }

    return prisma.$transaction(async (tx) => {
      assertNoWalkInSlotProblems(await walkInSlotProblems(tx, courtId, requestedSlots), requestedSlots);
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
          basePrice: courtPrice.basePrice,
          dynamicAdjustmentAmount: courtPrice.dynamicAdjustmentAmount,
          subtotal,
          totalPrice: subtotal,
          depositAmount: chargeAmount,
          paymentMethod,
          paymentStatus: !payLater && paymentMethod === PaymentMethod.CASH ? "PAID" : "UNPAID",
          bookingStatus: !payLater && paymentMethod === PaymentMethod.CASH && wantsDeposit ? BookingStatus.DEPOSIT_PAID : BookingStatus.CONFIRMED,
          note: input.note
        }
      });

      await tx.bookingSlot.create({
        data: {
          bookingId: booking.id,
          courtId,
          // Without it the slot reads as "whole court" and blocks every surface for online customers.
          court_surface_id: input.courtSurfaceId,
          bookingDate: toDbDate(input.bookingDate),
          startTime,
          endTime,
          slotPrice: courtSubtotal
        }
      });

      if (serviceLines.length) {
        await bookingRepository.attachServicesToBooking(tx, booking.id, serviceLines);
      }

      let payment = null;
      if (paymentInput) {
        payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            userId: customer.id,
            provider: paymentInput.providerResult.provider,
            paymentMethod: "QR_TRANSFER",
            paymentType: wantsDeposit ? "DEPOSIT" : "FULL_PAYMENT",
            amount: chargeAmount,
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

      return { booking, payment, customer: customerSummary };
    }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }).catch(walkInSerializationConflict);
  },

  /**
   * Same idea as `createWalkInBooking` but for several (possibly different-date)
   * time ranges at once, grouped under a single `BookingOrder` so the staff UI
   * and customer history show it as one booking instead of N separate ones.
   * CASH marks every booking PAID immediately (money collected at the counter).
   * BANK_TRANSFER generates a single QR for the combined total, tied to the
   * BookingOrder — `payment.repository.ts:applyWebhook` already cascades PAID
   * to every booking sharing that `bookingOrderId` once the QR is paid.
   */
  async createWalkInBookingOrder(
    userId: string,
    input: {
      customerName: string;
      customerPhone: string;
      slots: Array<{ courtSurfaceId: string; bookingDate: string; startTime: string; minutes: number }>;
      paymentMethod: typeof PaymentMethod.CASH | typeof PaymentMethod.BANK_TRANSFER;
      paymentType?: "FULL_PAYMENT" | "DEPOSIT" | "PAY_AT_COURT";
      note?: string;
      services?: Array<{ serviceId: string; quantity: number }>;
    }
  ) {
    const courtId = await getManagedCourtId(userId);
    const surfaceIds = [...new Set(input.slots.map((slot) => slot.courtSurfaceId))];
    const surfaces = await prisma.courtSurface.findMany({
      where: { id: { in: surfaceIds }, courtId, status: CourtActiveStatus.ACTIVE }
    });
    if (surfaces.length !== surfaceIds.length) throw new NotFoundError("Mot hoac nhieu san con khong ton tai hoac dang tam ngung");
    await assertWalkInSlotsBookable(courtId, input.slots);

    const payLater = input.paymentType === "PAY_AT_COURT";
    const paymentMethod = payLater ? PaymentMethod.CASH : input.paymentMethod;
    const wantsDeposit = input.paymentType === "DEPOSIT";
    const depositPercent = wantsDeposit ? await bookingRepository.courtDepositPercent(courtId) : 0;
    if (wantsDeposit && depositPercent <= 0) throw new ValidationError("San nay khong ho tro dat coc");

    // Dịch vụ chỉ được chọn một lần cho cả đơn (không lặp lại theo từng khung giờ),
    // sẽ được gắn vào booking đầu tiên tạo ra bên dưới.
    const serviceIds = (input.services ?? []).map((s) => s.serviceId);
    const availableServices = serviceIds.length ? await bookingRepository.services(serviceIds, courtId) : [];
    if (availableServices.length !== serviceIds.length) throw new ValidationError("Dich vu khong hop le");
    const serviceLines = (input.services ?? []).map((line) => {
      const service = availableServices.find((item) => item.id === line.serviceId)!;
      return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
    });
    const servicesSubtotal = serviceLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    // Fetched once and reused for every slot below — avoids re-querying court/rules per slot,
    // same pattern already used in createRecurringWalkInBooking.
    const pricingPrefetch = await dynamicPricingService.prefetch(courtId);

    const entries: Array<{
      courtSurfaceId: string;
      bookingDate: string;
      startTime: Date;
      endTime: Date;
      basePrice: number;
      dynamicAdjustmentAmount: number;
      courtSubtotal: number;
      subtotal: number;
      chargeAmount: number;
    }> = [];
    for (const slot of input.slots) {
      const startTime = timeToDate(slot.startTime);
      const endTime = timeToDate(minutesToTime(timeToMinutes(slot.startTime) + slot.minutes));
      const courtPrice = walkInCourtPrice(pricingPrefetch, slot.bookingDate, slot.startTime, slot.minutes);
      const subtotal = courtPrice.courtSubtotal;
      entries.push({
        courtSurfaceId: slot.courtSurfaceId,
        bookingDate: slot.bookingDate,
        startTime,
        endTime,
        basePrice: courtPrice.basePrice,
        dynamicAdjustmentAmount: courtPrice.dynamicAdjustmentAmount,
        courtSubtotal: subtotal,
        subtotal,
        chargeAmount: payLater ? 0 : wantsDeposit ? calculateMinimumDeposit(subtotal, depositPercent) : subtotal
      });
    }

    if (servicesSubtotal > 0 && entries.length > 0) {
      // Dịch vụ đã chọn được cộng vào booking đầu tiên của đơn thay vì lặp lại cho từng khung giờ.
      entries[0].subtotal += servicesSubtotal;
      // Services remain on the open tab; the court charge is unchanged.
    }

    // Fail fast before a QR is created; checked again inside the Serializable transaction below.
    assertNoWalkInSlotProblems(await walkInSlotProblems(prisma, courtId, entries), entries);

    const { customer, summary: customerSummary } = await resolveWalkInCustomer(input.customerName, input.customerPhone);

    const orderId = await nextPrefixedId("bo", "seq_booking_orders");
    const bookingIds = await Promise.all(entries.map(() => nextPrefixedId("b", "seq_bookings")));
    const totalAmount = entries.reduce((sum, entry) => sum + entry.subtotal, 0);
    const totalChargeAmount = entries.reduce((sum, entry) => sum + entry.chargeAmount, 0);

    let paymentInput: { reference: string; expiresAt: Date; providerResult: Awaited<ReturnType<typeof paymentProvider.createQrPayment>> } | null = null;
    if (!payLater && paymentMethod === PaymentMethod.BANK_TRANSFER) {
      const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_EXPIRES_MINUTES * 60 * 1000);
      const reference = paymentReference();
      const providerOrderId =
        env.PAYMENT_PROVIDER === "PAYOS"
          ? String(Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")))
          : `${reference}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const providerResult = await paymentProvider.createQrPayment({
        amount: totalChargeAmount,
        currency: "VND",
        orderId: providerOrderId,
        paymentReference: reference,
        description: wantsDeposit ? "Dat coc san tai quay" : "Thanh toan dat san tai quay",
        expiresAt
      });
      paymentInput = { reference, expiresAt, providerResult };
    }

    const { bookings, payment } = await prisma.$transaction(
      async (tx) => {
        assertNoWalkInSlotProblems(await walkInSlotProblems(tx, courtId, entries), entries);

        const isCash = !payLater && paymentMethod === PaymentMethod.CASH;

        await tx.bookingOrder.create({
          data: {
            id: orderId,
            userId: customer.id,
            courtId,
            subtotal: totalAmount,
            totalAmount,
            paymentType: payLater ? "PAY_AT_COURT" : paymentMethod,
            status: payLater || isCash ? "CONFIRMED" : "PENDING",
            note: input.note
          }
        });

        const created = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const booking = await tx.booking.create({
            data: {
              id: bookingIds[i],
              bookingCode: bookingCode(),
              userId: customer.id,
              courtId,
              courtSurfaceId: entry.courtSurfaceId,
              bookingOrderId: orderId,
              bookingDate: toDbDate(entry.bookingDate),
              startTime: entry.startTime,
              endTime: entry.endTime,
              basePrice: entry.basePrice,
              dynamicAdjustmentAmount: entry.dynamicAdjustmentAmount,
              subtotal: entry.subtotal,
              totalPrice: entry.subtotal,
              depositAmount: entry.chargeAmount,
              paymentMethod,
              paymentStatus: isCash ? "PAID" : "UNPAID",
              bookingStatus: isCash && wantsDeposit ? BookingStatus.DEPOSIT_PAID : BookingStatus.CONFIRMED,
              note: input.note
            }
          });

          await tx.bookingSlot.create({
            data: {
              bookingId: booking.id,
              courtId,
              court_surface_id: entry.courtSurfaceId,
              bookingDate: toDbDate(entry.bookingDate),
              startTime: entry.startTime,
              endTime: entry.endTime,
              slotPrice: entry.courtSubtotal
            }
          });

          created.push(booking);
        }

        if (serviceLines.length) {
          await bookingRepository.attachServicesToBooking(tx, created[0].id, serviceLines);
        }

        let payment = null;
        if (paymentInput) {
          payment = await tx.payment.create({
            data: {
              bookingId: created[0].id,
              bookingOrderId: orderId,
              userId: customer.id,
              provider: paymentInput.providerResult.provider,
              paymentMethod: "QR_TRANSFER",
              paymentType: wantsDeposit ? "DEPOSIT" : "FULL_PAYMENT",
              amount: totalChargeAmount,
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

        return { bookings: created, payment };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    ).catch(walkInSerializationConflict);

    return { orderId, bookings, payment, customer: customerSummary };
  },

  async createRecurringWalkInBooking(
    userId: string,
    input: {
      customerName: string;
      customerPhone: string;
      slots: Array<{ courtSurfaceId: string; bookingDate: string; startTime: string; minutes: number }>;
      occurrences: number;
      paymentMethod: typeof PaymentMethod.CASH | typeof PaymentMethod.BANK_TRANSFER;
      paymentType?: "FULL_PAYMENT" | "DEPOSIT" | "PAY_AT_COURT";
      note?: string;
      services?: Array<{ serviceId: string; quantity: number }>;
    }
  ) {
    const courtId = await getManagedCourtId(userId);
    const surfaceIds = [...new Set(input.slots.map((slot) => slot.courtSurfaceId))];
    const surfaces = await prisma.courtSurface.findMany({
      where: { id: { in: surfaceIds }, courtId, status: CourtActiveStatus.ACTIVE }
    });
    if (surfaces.length !== surfaceIds.length) throw new NotFoundError("Mot hoac nhieu san con khong ton tai hoac dang tam ngung");
    // Later weekly occurrences share the template's time of day, so checking the first date covers them.
    await assertWalkInSlotsBookable(courtId, input.slots);

    const payLater = input.paymentType === "PAY_AT_COURT";
    const paymentMethod = payLater ? PaymentMethod.CASH : input.paymentMethod;
    const wantsDeposit = input.paymentType === "DEPOSIT";
    const depositPercent = wantsDeposit ? await bookingRepository.courtDepositPercent(courtId) : 0;
    if (wantsDeposit && depositPercent <= 0) throw new ValidationError("San nay khong ho tro dat coc");

    // Dịch vụ chỉ gắn vào buổi đầu tiên thực sự được tạo (không lặp lại cho mọi occurrence trong tương lai).
    const serviceIds = (input.services ?? []).map((s) => s.serviceId);
    const availableServices = serviceIds.length ? await bookingRepository.services(serviceIds, courtId) : [];
    if (availableServices.length !== serviceIds.length) throw new ValidationError("Dich vu khong hop le");
    const serviceLines = (input.services ?? []).map((line) => {
      const service = availableServices.find((item) => item.id === line.serviceId)!;
      return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
    });
    const servicesSubtotal = serviceLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    const { customer, summary: customerSummary } = await resolveWalkInCustomer(input.customerName, input.customerPhone);

    const isCash = !payLater && paymentMethod === PaymentMethod.CASH;

    // For BANK_TRANSFER, bookings share one BookingOrder so a single QR can cover the whole
    // batch (every occurrence of every slot template) — payment.repository.ts:applyWebhook
    // already cascades PAID to every booking sharing a bookingOrderId. The order's totalAmount
    // is a placeholder here (0) because some occurrences may get skipped below; it's corrected
    // after the loop once the real total is known.
    const orderId = (payLater || isCash) ? null : await nextPrefixedId("bo", "seq_booking_orders");
    if (orderId) {
      await prisma.bookingOrder.create({
        data: {
          id: orderId,
          userId: customer.id,
          courtId,
          subtotal: 0,
          totalAmount: 0,
          paymentType: payLater ? "PAY_AT_COURT" : paymentMethod,
          status: "PENDING",
          note: input.note
        }
      });
    }

    // Fetched once and reused for every occurrence of every slot template below — avoids the
    // N+1 pattern (`dynamicPricingService.calculate` re-querying court/rules on every call),
    // the same anti-pattern `calculateForWeek` was already written to avoid elsewhere.
    const pricingPrefetch = await dynamicPricingService.prefetch(courtId);

    const series: { id: string }[] = [];
    const skipped: { courtSurfaceId: string; date: string; reason: string }[] = [];
    const candidates: Array<WalkInSlot & { seriesId: string; startText: string; minutes: number }> = [];

    // Each selected slot is its own weekly-repeating template (own weekday/time/surface) —
    // all of them share `occurrences` and get bundled into the same order/payment above.
    for (const slotTemplate of input.slots) {
      const startTime = timeToDate(slotTemplate.startTime);
      const endTime = timeToDate(minutesToTime(timeToMinutes(slotTemplate.startTime) + slotTemplate.minutes));

      const seriesId = await nextPrefixedId("bs", "seq_booking_series");
      await prisma.bookingSeries.create({
        data: {
          id: seriesId,
          courtId,
          courtSurfaceId: slotTemplate.courtSurfaceId,
          createdByUserId: userId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          startTime,
          durationMinutes: slotTemplate.minutes,
          firstBookingDate: toDbDate(slotTemplate.bookingDate),
          occurrencesRequested: input.occurrences,
          note: input.note
        }
      });
      series.push({ id: seriesId });

      for (let week = 0; week < input.occurrences; week++) {
        candidates.push({
          courtSurfaceId: slotTemplate.courtSurfaceId,
          seriesId,
          bookingDate: addWeeks(slotTemplate.bookingDate, week),
          startTime,
          endTime,
          startText: slotTemplate.startTime,
          minutes: slotTemplate.minutes
        });
      }
    }

    // Every occurrence of every template is checked in 2 queries, including templates that land on
    // each other in later weeks (e.g. the same Monday slot picked in two different weeks).
    const problems = await walkInSlotProblems(prisma, courtId, candidates);
    const entries: Array<
      WalkInSlot & { seriesId: string; basePrice: number; dynamicAdjustmentAmount: number; courtSubtotal: number; chargeAmount: number }
    > = [];
    candidates.forEach((candidate, index) => {
      const problem = problems.get(index);
      if (problem) {
        skipped.push({ courtSurfaceId: candidate.courtSurfaceId, date: candidate.bookingDate, reason: walkInSkipReasons[problem] });
        return;
      }

      const courtPrice = walkInCourtPrice(pricingPrefetch, candidate.bookingDate, candidate.startText, candidate.minutes);
      const courtSubtotal = courtPrice.courtSubtotal;
      entries.push({
        courtSurfaceId: candidate.courtSurfaceId,
        seriesId: candidate.seriesId,
        bookingDate: candidate.bookingDate,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        basePrice: courtPrice.basePrice,
        dynamicAdjustmentAmount: courtPrice.dynamicAdjustmentAmount,
        courtSubtotal,
        chargeAmount: payLater ? 0 : wantsDeposit ? calculateMinimumDeposit(courtSubtotal, depositPercent) : courtSubtotal
      });
    });

    const bookingIds = await Promise.all(entries.map(() => nextPrefixedId("b", "seq_bookings")));

    const created = await prisma.$transaction(
      async (tx) => {
        // Re-checked inside the transaction: an occurrence booked since the check above is skipped as well.
        const lateProblems = await walkInSlotProblems(tx, courtId, entries);
        const rows: Awaited<ReturnType<typeof tx.booking.create>>[] = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const lateProblem = lateProblems.get(i);
          if (lateProblem) {
            skipped.push({ courtSurfaceId: entry.courtSurfaceId, date: entry.bookingDate, reason: walkInSkipReasons[lateProblem] });
            continue;
          }
          // Dịch vụ đã chọn được cộng vào buổi đầu tiên thực sự tạo được, không nhân bản cho các occurrence sau.
          // Services remain on the open tab; the court charge (chargeAmount) is unchanged.
          const subtotal = entry.courtSubtotal + (rows.length === 0 ? servicesSubtotal : 0);
          const createdBooking = await tx.booking.create({
            data: {
              id: bookingIds[i],
              bookingCode: bookingCode(),
              userId: customer.id,
              courtId,
              courtSurfaceId: entry.courtSurfaceId,
              bookingSeriesId: entry.seriesId,
              bookingOrderId: orderId ?? undefined,
              bookingDate: toDbDate(entry.bookingDate),
              startTime: entry.startTime,
              endTime: entry.endTime,
              basePrice: entry.basePrice,
              dynamicAdjustmentAmount: entry.dynamicAdjustmentAmount,
              subtotal,
              totalPrice: subtotal,
              depositAmount: entry.chargeAmount,
              paymentMethod,
              paymentStatus: isCash ? "PAID" : "UNPAID",
              bookingStatus: isCash && wantsDeposit ? BookingStatus.DEPOSIT_PAID : BookingStatus.CONFIRMED,
              note: input.note
            }
          });

          await tx.bookingSlot.create({
            data: {
              bookingId: createdBooking.id,
              courtId,
              court_surface_id: entry.courtSurfaceId,
              bookingDate: toDbDate(entry.bookingDate),
              startTime: entry.startTime,
              endTime: entry.endTime,
              slotPrice: entry.courtSubtotal
            }
          });

          rows.push(createdBooking);
        }

        if (serviceLines.length && rows.length) {
          await bookingRepository.attachServicesToBooking(tx, rows[0].id, serviceLines);
        }

        return rows;
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    ).catch(walkInSerializationConflict);

    let payment = null;
    if (orderId) {
      if (created.length === 0) {
        // Nothing was actually booked (every occurrence conflicted/blocked) — drop the empty placeholder order.
        await prisma.bookingOrder.delete({ where: { id: orderId } }).catch(() => {});
      } else {
        const totalAmount = created.reduce((sum, b) => sum + Number(b.subtotal), 0);
        const totalChargeAmount = created.reduce((sum, b) => sum + Number(b.depositAmount), 0);
        const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_EXPIRES_MINUTES * 60 * 1000);
        const reference = paymentReference();
        const providerOrderId =
          env.PAYMENT_PROVIDER === "PAYOS"
            ? String(Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")))
            : `${reference}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const providerResult = await paymentProvider.createQrPayment({
          amount: totalChargeAmount,
          currency: "VND",
          orderId: providerOrderId,
          paymentReference: reference,
          description: wantsDeposit ? "Dat coc san dinh ky tai quay" : "Thanh toan dat san dinh ky tai quay",
          expiresAt
        });

        await prisma.bookingOrder.update({ where: { id: orderId }, data: { subtotal: totalAmount, totalAmount } });

        payment = await prisma.payment.create({
          data: {
            bookingId: created[0].id,
            bookingOrderId: orderId,
            userId: customer.id,
            provider: providerResult.provider,
            paymentMethod: "QR_TRANSFER",
            paymentType: wantsDeposit ? "DEPOSIT" : "FULL_PAYMENT",
            amount: totalChargeAmount,
            currency: "VND",
            status: "PENDING",
            externalOrderId: providerResult.externalOrderId,
            qrCodeUrl: providerResult.qrCodeUrl ?? undefined,
            qrPayload: providerResult.qrPayload ?? undefined,
            paymentReference: reference,
            expiresAt
          }
        });
      }
    }

    return { series, created, skipped, payment, customer: customerSummary };
  },

  async paymentStatus(userId: string, paymentId: string) {
    const courtId = await getManagedCourtId(userId);
    const find = () =>
      prisma.payment.findFirst({
        where: { id: paymentId, booking: { courtId } },
        include: { booking: { select: { bookingStatus: true } } }
      });
    let payment = await find();
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan thuoc quyen quan ly cua ban");
    // Same lazy expiry as paymentService.detail, so the counter sees an expired QR without waiting for the sweep.
    if ((payment.status === "PENDING" || payment.status === "UNPAID") && payment.expiresAt.getTime() <= Date.now()) {
      await paymentRepository.expirePendingPayment(payment.id);
      payment = (await find()) ?? payment;
    }

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      status: payment.status,
      bookingStatus: payment.booking.bookingStatus,
      amount: Number(payment.amount),
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      // The counter UI shows the QA-only "Xác nhận đã nhận tiền" button only where the API accepts it.
      manualConfirmAllowed: paymentService.manualCompletionAllowed()
    };
  },

  /**
   * Walk-in QR money goes to the platform's PayOS account, so it must be marked paid by the provider
   * (webhook, poller or syncWalkInPayment) through applyWebhook, which records the PLATFORM settlement
   * and credits the partner's wallet. Staff cannot see that account: outside production this is only a
   * QA shortcut through that same path, never a direct status update.
   */
  async confirmWalkInPayment(userId: string, paymentId: string) {
    const courtId = await getManagedCourtId(userId);
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, booking: { courtId } } });
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan thuoc quyen quan ly cua ban");
    if (payment.status !== "PAID") {
      if (!(payment.status === "PENDING" || payment.status === "UNPAID") || payment.expiresAt.getTime() <= Date.now()) {
        throw new ValidationError("Ma QR da het han hoac bi huy nen booking da bi huy, vui long tao lai booking");
      }
      if (!paymentService.manualCompletionAllowed()) {
        throw new ForbiddenError("Thanh toan QR duoc xac nhan tu dong khi tien ve tai khoan. Bam 'Kiem tra lai' neu khach da chuyen khoan");
      }
      await paymentService.devCompletePayment(payment, userId);
    }
    return this.paymentStatus(userId, paymentId);
  },

  /** "Kiểm tra lại" at the counter: asks the provider now instead of waiting for the webhook or the next poll. */
  async syncWalkInPayment(userId: string, paymentId: string) {
    const courtId = await getManagedCourtId(userId);
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, booking: { courtId } },
      include: { booking: { select: { courtId: true } } }
    });
    if (!payment) throw new NotFoundError("Khong tim thay thanh toan thuoc quyen quan ly cua ban");
    if (payment.status === "PENDING" && payment.expiresAt.getTime() > Date.now()) {
      await syncPaymentWithProvider(payment);
    }
    return this.paymentStatus(userId, paymentId);
  },

  async checkInBooking(userId: string, bookingId: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the check-in don dang cho xu ly hoac da xac nhan");
    }
    if (booking.checkedInAt) return booking; // Idempotent: đã check-in rồi thì không làm gì thêm

    // Giờ Việt Nam, không phụ thuộc timezone của server (Render/Railway chạy UTC)
    const { date: today, time: currentTime } = vietnamNow();
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chi co the check-in cho booking hom nay");

    const now = new Date();

    // Đến đúng giờ hoặc trễ giờ — không cần dời giờ, chỉ đánh dấu đã check-in
    if (timeToMinutes(currentTime) >= timeToMinutes(dbTime(booking.startTime))) {
      return prisma.booking.update({
        where: { id: booking.id },
        data: { checkedInAt: now }
      });
    }

    // Đến sớm hơn giờ đặt: áp chính sách của đối tác (sớm tối đa bao nhiêu phút, bao nhiêu phút miễn phí,
    // % giá giờ cho phần còn lại), rồi kiểm tra sân trống và dời giờ bắt đầu lên hiện tại.
    const policy = await courtTimeChargePolicy(courtId);
    const early = earlyCheckInWindow(policy, timeToMinutes(currentTime), timeToMinutes(dbTime(booking.startTime)));
    if (!early.allowed) {
      throw new ValidationError(
        early.maxMinutes === 0
          ? "San nay khong cho check-in som, vui long doi den gio dat"
          : `Chi duoc check-in som toi da ${early.maxMinutes} phut truoc gio dat. Khach den som ${early.earlyMinutes} phut, vui long doi them ${early.earlyMinutes - early.maxMinutes!} phut`
      );
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

    // Only the minutes before the free ones are charged; they run from now.
    const charge = early.chargedMinutes
      ? extraTimeCharge(await dynamicPricingService.prefetch(courtId), date, currentTime, early.chargedMinutes, policy.earlyPricePercent)
      : { amount: 0, basePrice: 0, dynamicAdjustmentAmount: 0 };
    const earlyNote = early.chargedMinutes
      ? `Check-in som ${early.earlyMinutes} phut (mien phi ${early.freeMinutes} phut, tinh ${early.chargedMinutes} phut x ${policy.earlyPricePercent}% gia gio): ${noteAmount(charge.amount)}`
      : `Check-in som ${early.earlyMinutes} phut (mien phi)`;

    const { updated } = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          startTime: newStartTime,
          bookingStatus: BookingStatus.CONFIRMED,
          checkedInAt: now,
          basePrice: { increment: charge.basePrice },
          dynamicAdjustmentAmount: { increment: charge.dynamicAdjustmentAmount },
          subtotal: { increment: charge.amount },
          totalPrice: { increment: charge.amount },
          note: appendNote(booking.note, earlyNote)
        }
      });
      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, startTime: booking.startTime },
        data: { startTime: newStartTime, slotPrice: { increment: charge.amount } }
      });
      // Early play is collected at checkout.
      return { updated: updatedBooking };
    });

    return { ...updated, extraChargeAmount: charge.amount, earlyCheckIn: early };
  },

  async earlyCheckOutBooking(userId: string, bookingId: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Khong tim thay don dat san thuoc quyen quan ly cua ban");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chi co the check-out don dang cho xu ly hoac da xac nhan");
    }

    const { date: today, time: currentTime } = vietnamNow();
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chi co the check-out cho booking hom nay");

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
      await settlementService.chargePartnerCollected(booking.id, tx);
      return { updated: updatedBooking, settlement: updatedSettlement };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );

    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return updated;
  }
};
