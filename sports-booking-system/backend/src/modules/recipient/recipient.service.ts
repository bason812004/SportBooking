import { BookingStatus, CourtActiveStatus, PaymentMethod, Prisma, type Booking } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingBillInclude, bookingBillSelect, normalizeBookingServices } from "../../shared/utils/bookingServices.js";
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
import {
  COURT_BOOKING_TRANSITIONS,
  calculateMinimumDeposit,
  counterCollectedAmount,
  courtCancellationPayment,
  refundRequiredAdminEvent
} from "../bookings/booking.calculations.js";
import { assertNothingOwed } from "../checkout/checkout.balance.js";
import { sortGroupKeysByBillTotal, withBookingBill } from "../checkout/checkout.calculations.js";
import { enqueueAdminEvent } from "../notifications/notificationOutbox.repository.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { partnerRepository } from "../partner/partner.repository.js";
import { reportRepository } from "../business-report/report.repository.js";
import { syncPaymentWithProvider } from "../payments/payment.poller.js";
import { paymentRepository } from "../payments/payment.repository.js";
import { paymentService } from "../payments/payment.service.js";
import { paymentProvider } from "../payments/providers/index.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { settlementService } from "../settlements/settlement.service.js";
import { cashierRepository } from "../cashier/cashier.repository.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import { bookingOverdueService } from "../booking-overdue/bookingOverdue.service.js";
import { canCorrectAutoNoShow } from "../booking-overdue/bookingOverdue.calculations.js";
import { earlyCheckInWindow } from "./recipient.calculations.js";
import {
  activeOperationStatuses,
  appendNote,
  checkInBooking,
  courtTimeChargePolicy,
  dbTime,
  extraTimeCharge,
  minutesToTime,
  noteAmount,
  slotTakenBy,
  surfaceHours,
  walkInCourtPrice
} from "./recipient.counter.js";
import { coverWithPrices, piecesTotal, priceBands } from "../../shared/utils/courtPricing.js";
import { notifyBookingDecision, notifyCourtChange } from "../bookings/bookingNotices.js";

function addWeeks(date: string, weeks: number) {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + weeks * 7);
  return base.toISOString().slice(0, 10);
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

function overlapsSlot(slot: { startTime: string; endTime: string }, item: { startTime: Date; endTime: Date }) {
  return timeToMinutes(slot.startTime) < timeToMinutes(dbTime(item.endTime)) && timeToMinutes(slot.endTime) > timeToMinutes(dbTime(item.startTime));
}

/** The hour's table price when dynamic pricing is unavailable (see coverWithPrices); null without one. */
function slotPrice(slot: { startTime: string; endTime: string }, date: string, prices: Array<{ dayType: string; startTime: Date; endTime: Date; price: unknown }>) {
  const { pieces, missing } = coverWithPrices(priceBands(prices), date, timeToMinutes(slot.startTime), timeToMinutes(slot.endTime));
  return missing.length ? null : piecesTotal(pieces);
}

/** Bookings the counter screen shows as on court or coming; a finished one still holds its time (activeOperationStatuses). */
const openOperationStatuses: BookingStatus[] = activeOperationStatuses.filter((status) => status !== BookingStatus.COMPLETED);
const extendableBookingStatuses: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID, BookingStatus.IN_PROGRESS, BookingStatus.CHECKOUT_PENDING];

/** Finishing by hand (Check-out) is only for a booking that is confirmed or already playing. */
const checkOutBookingStatuses: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID, BookingStatus.IN_PROGRESS, BookingStatus.CHECKOUT_PENDING];

/**
 * Where an extension has to be free. On the same sub-court only the added minutes; moving the guest to another one
 * means they play there from now on (or from the start, if not begun), so it must be free from then to the new end.
 */
function extensionWindow(booking: { bookingDate: Date; startTime: Date; endTime: Date }, newEndTime: Date, moving: boolean) {
  if (!moving) return { startTime: booking.endTime, endTime: newEndTime };
  const now = vietnamNow();
  const start = timeToMinutes(dbTime(booking.startTime));
  const end = timeToMinutes(dbTime(booking.endTime));
  const from = booking.bookingDate.toISOString().slice(0, 10) === now.date ? Math.min(Math.max(timeToMinutes(now.time), start), end) : start;
  return { startTime: timeToDate(minutesToTime(from)), endTime: newEndTime };
}

/** The end an extension reaches, and whether it is still within the sub-court's opening hours. */
async function extendedEnd(courtId: string, courtSurfaceId: string | null, booking: { endTime: Date }, minutes: number) {
  const { closing } = await surfaceHours(courtId, courtSurfaceId);
  const end = timeToMinutes(dbTime(booking.endTime)) + minutes;
  return { end, closing, fits: end <= timeToMinutes(closing) };
}

type WalkInSlot = { courtSurfaceId: string; bookingDate: string; startTime: Date; endTime: Date };
type WalkInSlotProblem = "BOOKED" | "BLOCKED" | "DUPLICATE";

const walkInSkipReasons: Record<WalkInSlotProblem, string> = {
  BOOKED: "Khung giờ này đã có khách khác",
  BLOCKED: "Sân đang trong lịch nghỉ/bảo trì",
  DUPLICATE: "Trùng với buổi khác trong cùng yêu cầu"
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
    if (problem === "BLOCKED") throw new ConflictError(`Sân đang trong lịch nghỉ/bảo trì ngày ${date}`, "WALK_IN_BOOKING_BLOCKED");
    throw new ConflictError(
      problem === "DUPLICATE" ? `Các khung giờ đã chọn ngày ${date} bị trùng nhau` : `Khung giờ ngày ${date} đã có khách khác`,
      "WALK_IN_BOOKING_CONFLICT"
    );
  }
}

/** Postgres aborts one of two Serializable transactions that booked the same slot at once (P2034). */
function walkInSerializationConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    throw new ConflictError("Khung giờ vừa được đặt ở nơi khác, vui lòng tải lại lịch và thử lại", "WALK_IN_BOOKING_CONFLICT");
  }
  throw error;
}

/**
 * Walk-in slots must fit their sub-court's opening hours (its own, or the court's: the hours the staff grid shows)
 * and must not be over already.
 */
async function assertWalkInSlotsBookable(courtId: string, slots: Array<{ courtSurfaceId: string; bookingDate: string; startTime: string; minutes: number }>) {
  const hoursBySurface = new Map<string, { opening: string; closing: string }>();
  for (const surfaceId of new Set(slots.map((slot) => slot.courtSurfaceId))) hoursBySurface.set(surfaceId, await surfaceHours(courtId, surfaceId));
  const now = vietnamNow();
  for (const slot of slots) {
    const { opening, closing } = hoursBySurface.get(slot.courtSurfaceId)!;
    const start = timeToMinutes(slot.startTime);
    const end = start + slot.minutes;
    const label = `${slot.startTime}-${minutesToTime(end)}`;
    if (start < timeToMinutes(opening) || end > timeToMinutes(closing)) {
      throw new ValidationError(`Khung giờ ${label} nằm ngoài giờ mở cửa ${opening}-${closing}`);
    }
    if (slot.bookingDate < now.date || (slot.bookingDate === now.date && end <= timeToMinutes(now.time))) {
      throw new ValidationError(`Khung giờ ${label} ngày ${slot.bookingDate} đã qua`);
    }
  }
}

/**
 * Customer account for a walk-in booking, found by the (already normalized) phone. Only USER accounts
 * count, so a staff, partner or admin sharing the number is never booked as the customer; otherwise a
 * walk-in account is created. `matchedExisting` lets the counter say which account the booking went to.
 */
async function resolveWalkInCustomer(client: Prisma.TransactionClient, customerName: string, customerPhone: string) {
  const existing = await client.user.findFirst({ where: { phone: customerPhone, role: "USER" }, orderBy: { createdAt: "asc" } });
  const customer =
    existing ??
    (await client.user.create({
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

const SERIALIZABLE = { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 } as const;

type WalkInSession = { courtSurfaceId: string; bookingDate: string; startTime: string; minutes: number };
type WalkInPayment = {
  paymentMethod: typeof PaymentMethod.CASH | typeof PaymentMethod.BANK_TRANSFER;
  paymentType?: "FULL_PAYMENT" | "DEPOSIT" | "PAY_AT_COURT";
  services?: Array<{ serviceId: string; quantity: number }>;
};
type WalkInRequest = WalkInPayment & {
  customerName: string;
  customerPhone: string;
  note?: string;
  /** Cash only: what staff confirmed taking from the customer; it must be what the booking records as paid. */
  cashReceived?: number;
};

/**
 * Prices a walk-in request without writing anything. Each session gets its court price (hour by hour, as online)
 * and what is collected now: the court charge, the court deposit, or nothing when paying at the court; services are
 * always paid later at checkout. A single booking or an order is booked whole or not at all; a weekly series
 * (`occurrences`) skips the weeks already taken. The quote shown to staff and the creation both use it, so the cash
 * staff confirm is exactly what the booking records as paid.
 */
async function planWalkIn(courtId: string, request: WalkInPayment & { slots: WalkInSession[]; occurrences?: number }) {
  const surfaceIds = [...new Set(request.slots.map((slot) => slot.courtSurfaceId))];
  const surfaces = await prisma.courtSurface.findMany({ where: { id: { in: surfaceIds }, courtId, status: CourtActiveStatus.ACTIVE } });
  if (surfaces.length !== surfaceIds.length) throw new NotFoundError("Sân con không tồn tại hoặc đang tạm ngưng");
  // Later weekly occurrences share the template's time of day, so checking the first date covers them.
  await assertWalkInSlotsBookable(courtId, request.slots);

  const payLater = request.paymentType === "PAY_AT_COURT";
  const paymentMethod = payLater ? PaymentMethod.CASH : request.paymentMethod;
  const wantsDeposit = request.paymentType === "DEPOSIT";
  const depositPercent = wantsDeposit ? await bookingRepository.courtDepositPercent(courtId) : 0;
  if (wantsDeposit && depositPercent <= 0) throw new ValidationError("Sân này không hỗ trợ đặt cọc");

  const serviceIds = (request.services ?? []).map((line) => line.serviceId);
  const availableServices = serviceIds.length ? await bookingRepository.services(serviceIds, courtId) : [];
  if (availableServices.length !== serviceIds.length) throw new ValidationError("Dịch vụ không hợp lệ");
  const serviceLines = (request.services ?? []).map((line) => {
    const service = availableServices.find((item) => item.id === line.serviceId)!;
    return { serviceId: line.serviceId, quantity: line.quantity, price: Number(service.price) };
  });
  const servicesSubtotal = serviceLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const weeks = request.occurrences ?? 1;
  const candidates = request.slots.flatMap((slot, templateIndex) =>
    Array.from({ length: weeks }, (_, week) => ({
      templateIndex,
      courtSurfaceId: slot.courtSurfaceId,
      bookingDate: addWeeks(slot.bookingDate, week),
      startText: slot.startTime,
      minutes: slot.minutes,
      startTime: timeToDate(slot.startTime),
      endTime: timeToDate(minutesToTime(timeToMinutes(slot.startTime) + slot.minutes))
    }))
  );
  // Every occurrence of every template is checked in 2 queries, including templates that land on each other.
  const problems = await walkInSlotProblems(prisma, courtId, candidates);
  if (!request.occurrences) assertNoWalkInSlotProblems(problems, candidates);

  // Fetched once for every session: no court/rules query per slot.
  const pricing = await dynamicPricingService.prefetch(courtId);
  const skipped: Array<{ courtSurfaceId: string; date: string; reason: string }> = [];
  const entries = candidates.flatMap((candidate, index) => {
    const problem = problems.get(index);
    if (problem) {
      skipped.push({ courtSurfaceId: candidate.courtSurfaceId, date: candidate.bookingDate, reason: walkInSkipReasons[problem] });
      return [];
    }
    const price = walkInCourtPrice(pricing, candidate.bookingDate, candidate.startText, candidate.minutes);
    const chargeAmount = payLater ? 0 : wantsDeposit ? calculateMinimumDeposit(price.courtSubtotal, depositPercent) : price.courtSubtotal;
    return [{ ...candidate, ...price, chargeAmount }];
  });
  return {
    payLater,
    paymentMethod,
    wantsDeposit,
    depositPercent,
    isCash: !payLater && paymentMethod === PaymentMethod.CASH,
    needsQr: !payLater && paymentMethod === PaymentMethod.BANK_TRANSFER,
    serviceLines,
    servicesSubtotal,
    entries,
    skipped,
    courtTotal: entries.reduce((sum, entry) => sum + entry.courtSubtotal, 0),
    collectNow: entries.reduce((sum, entry) => sum + entry.chargeAmount, 0)
  };
}

type WalkInPlan = Awaited<ReturnType<typeof planWalkIn>>;

/** Cash is recorded as paid when the booking is made, so staff must have confirmed taking exactly that amount. */
function assertCashTaken(plan: WalkInPlan, cashReceived: number | undefined) {
  if (!plan.isCash) return;
  if (cashReceived === undefined) throw new ValidationError("Hãy xác nhận số tiền mặt đã nhận của khách trước khi tạo đơn");
  if (cashReceived !== plan.collectNow) {
    throw new ConflictError(
      `Số tiền mặt cần thu là ${noteAmount(plan.collectNow)}, không phải ${noteAmount(cashReceived)}. Hãy xem lại rồi xác nhận lại.`,
      "WALK_IN_CASH_MISMATCH"
    );
  }
}

/** One QR from the platform's provider for what is collected now. */
async function createWalkInQr(amount: number, description: string) {
  const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_EXPIRES_MINUTES * 60 * 1000);
  const reference = paymentReference();
  const orderId =
    env.PAYMENT_PROVIDER === "PAYOS"
      ? String(Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")))
      : `${reference}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const providerResult = await paymentProvider.createQrPayment({ amount, currency: "VND", orderId, paymentReference: reference, description, expiresAt });
  return { reference, expiresAt, providerResult };
}

function walkInPaymentData(
  qr: Awaited<ReturnType<typeof createWalkInQr>>,
  input: { bookingId: string; bookingOrderId?: string; userId: string; amount: number; deposit: boolean }
) {
  return {
    bookingId: input.bookingId,
    bookingOrderId: input.bookingOrderId,
    userId: input.userId,
    provider: qr.providerResult.provider,
    paymentMethod: PaymentMethod.QR_TRANSFER,
    paymentType: input.deposit ? ("DEPOSIT" as const) : ("FULL_PAYMENT" as const),
    amount: input.amount,
    currency: "VND",
    status: "PENDING" as const,
    externalOrderId: qr.providerResult.externalOrderId,
    qrCodeUrl: qr.providerResult.qrCodeUrl ?? undefined,
    qrPayload: qr.providerResult.qrPayload ?? undefined,
    paymentReference: qr.reference,
    expiresAt: qr.expiresAt
  };
}

/** Creates the bookings (and their slots) of a walk-in; the selected services go on the first one only. */
async function createWalkInRows(
  tx: Prisma.TransactionClient,
  courtId: string,
  plan: WalkInPlan,
  entries: WalkInPlan["entries"],
  options: { customerId: string; bookingIds: string[]; bookingOrderId?: string; seriesIds?: string[]; note?: string }
) {
  const rows: Booking[] = [];
  for (const [index, entry] of entries.entries()) {
    // Services stay on the open tab: they add to the first booking's total, never to what is collected now.
    const subtotal = entry.courtSubtotal + (index === 0 ? plan.servicesSubtotal : 0);
    const booking = await tx.booking.create({
      data: {
        id: options.bookingIds[index],
        bookingCode: bookingCode(),
        userId: options.customerId,
        courtId,
        courtSurfaceId: entry.courtSurfaceId,
        bookingOrderId: options.bookingOrderId,
        bookingSeriesId: options.seriesIds?.[entry.templateIndex],
        bookingDate: toDbDate(entry.bookingDate),
        startTime: entry.startTime,
        endTime: entry.endTime,
        basePrice: entry.basePrice,
        dynamicAdjustmentAmount: entry.dynamicAdjustmentAmount,
        subtotal,
        totalPrice: subtotal,
        depositAmount: entry.chargeAmount,
        paymentMethod: plan.paymentMethod,
        paymentStatus: plan.isCash ? "PAID" : "UNPAID",
        bookingStatus: plan.isCash && plan.wantsDeposit ? BookingStatus.DEPOSIT_PAID : BookingStatus.CONFIRMED,
        note: options.note
      }
    });
    await tx.bookingSlot.create({
      data: {
        bookingId: booking.id,
        courtId,
        // Without it the slot reads as "whole court" and blocks every surface for online customers.
        court_surface_id: entry.courtSurfaceId,
        bookingDate: toDbDate(entry.bookingDate),
        startTime: entry.startTime,
        endTime: entry.endTime,
        slotPrice: entry.courtSubtotal
      }
    });
    rows.push(booking);
  }
  if (plan.serviceLines.length && rows.length) await bookingRepository.attachServicesToBooking(tx, rows[0].id, plan.serviceLines);
  return rows;
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
  /**
   * Today's bookings by the Vietnam date (whatever timezone the server runs in), and this month's revenue from the same
   * settlement ledger as the report, so the two always agree.
   */
  async dashboard(userId: string) {
    const courtId = await getManagedCourtId(userId);
    const today = vietnamNow().date;
    const [year, month] = today.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

    const [court, bookingsToday, pendingBookings, monthRevenue, recentBookings] = await Promise.all([
      prisma.court.findUnique({
        where: { id: courtId },
        select: { name: true }
      }),
      prisma.booking.count({
        where: {
          courtId,
          bookingDate: toDbDate(today)
        }
      }),
      prisma.booking.count({
        where: {
          courtId,
          bookingStatus: "PENDING"
        }
      }),
      reportRepository.revenueRows({ courtId }, toDbDate(`${today.slice(0, 7)}-01`), toDbDate(monthEnd)),
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
      revenue: monthRevenue.reduce((sum, row) => sum + row.grossAmount, 0),
      recentBookings
    };
  },

  /** Bookings of the staff member's court that are over but still open, with when the system finishes each. */
  async overdueBookings(userId: string) {
    return bookingOverdueService.openOverdue({ courtId: await getManagedCourtId(userId) });
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
      ...bookingBillInclude
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

    // The list shows each group's bill total (court + services - voucher), not bookings.total_price,
    // so "totalPrice" sorts the groups by that. Ties keep the database order above.
    let orderedKeys = groupKeys;
    if (query.sortBy === "totalPrice" && groupKeys.length) {
      const billRows = await prisma.booking.findMany({
        where: {
          courtId,
          OR: [
            { bookingOrderId: { in: groupKeys.filter((key) => isOrderKey.get(key)) } },
            { id: { in: groupKeys.filter((key) => !isOrderKey.get(key)) } }
          ]
        },
        select: bookingBillSelect
      });
      orderedKeys = sortGroupKeysByBillTotal(groupKeys, billRows, query.sortOrder);
    }

    const total = groupKeys.length;
    const pageKeys = orderedKeys.slice((page - 1) * limit, (page - 1) * limit + limit);
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
    const orderBookings = orderBookingsRaw.map((booking) => normalizeBookingServices(withBookingBill(booking)));
    const standaloneBookings = standaloneBookingsRaw.map((booking) => normalizeBookingServices(withBookingBill(booking)));

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

  /** History of a customer at this court only: someone who never booked here is not found, whatever id is asked for. */
  async customerBookingHistory(userId: string, customerId: string) {
    const courtId = await getManagedCourtId(userId);
    const bookings = await prisma.booking.findMany({
      where: { userId: customerId, courtId },
      orderBy: { bookingDate: "desc" },
      take: 20,
      include: {
        courtSurface: { select: { name: true, code: true } }
      }
    });
    if (!bookings.length) throw new NotFoundError("Không tìm thấy khách đã đặt sân tại đây");
    const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { id: true, fullName: true, phone: true } });
    if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

    return { customer, bookings: bookings.map((booking) => ({ ...booking, totalPrice: Number(booking.totalPrice) })) };
  },

  /**
   * Same rules as the partner's: cancelling needs the reason the customer is told, and finishing needs the bill paid
   * (money still owed is taken at the cashier, which finishes the booking itself).
   */
  async updateBookingStatus(userId: string, bookingId: string, status: BookingStatus, reason?: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, courtId }
    });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");

    // A no-show the system recorded (nobody checked the customer in) can be corrected if they did play.
    const correctingAutoNoShow = status === BookingStatus.COMPLETED && canCorrectAutoNoShow(booking);
    if (!correctingAutoNoShow && !(COURT_BOOKING_TRANSITIONS[booking.bookingStatus] ?? []).includes(status)) {
      throw new ValidationError("Không thể chuyển trạng thái đơn theo thao tác này");
    }
    if (
      (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) &&
      new Date() < bookingStartsAt(booking.bookingDate, booking.endTime)
    ) {
      throw new ValidationError("Chỉ có thể kết thúc đơn sau giờ đặt sân");
    }
    const cancelReason = reason?.trim();
    if (status === BookingStatus.CANCELLED && (!cancelReason || cancelReason.length < 3)) {
      throw new ValidationError("Nhập lý do huỷ đơn (ít nhất 3 ký tự) để gửi cho khách");
    }

    const { updated, settlement } = await prisma.$transaction(async (tx) => {
      if (status === BookingStatus.COMPLETED) await assertNothingOwed(booking.id, tx);
      const cancellation =
        status === BookingStatus.CANCELLED
          ? courtCancellationPayment(booking.paymentStatus, counterCollectedAmount(booking), await bookingRepository.onlineCollectedAmount(tx, booking))
          : null;
      // Moved only from the status it was read with: the partner, another tab or the overdue job acting meanwhile wins.
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, bookingStatus: booking.bookingStatus },
        data: cancellation
          ? {
              bookingStatus: status,
              cancelReason,
              cancelledAt: new Date(),
              refundAmount: cancellation.refundAmount,
              platformRetainedAmount: 0,
              paymentStatus: cancellation.paymentStatus
            }
          : {
              bookingStatus: status
            }
      });
      if (!count) throw new ConflictError("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang");
      const updatedBooking = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { court: { include: { partner: true } }, user: { select: { fullName: true, phone: true } } }
      });
      if (cancellation?.refundByAdmin) {
        await enqueueAdminEvent(tx, refundRequiredAdminEvent(updatedBooking, cancellation.refundByAdmin, "Nhân viên sân"));
      }

      let updatedSettlement = null;
      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        updatedSettlement = await settlementService.finishBooking(updatedBooking, status, tx);
      } else if (status === BookingStatus.CANCELLED) {
        await voucherRepository.releaseVoucherUses([booking.id], tx);
        updatedSettlement = await settlementService.cancelForBooking(booking.id, tx);
      }
      return { updated: updatedBooking, settlement: updatedSettlement };
    }, SERIALIZABLE);

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
    await notifyBookingDecision(updated, updated.court.name, status as "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED", {
      reason: cancelReason,
      refundAmount: Number(updated.refundAmount ?? 0)
    });
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
    if (!court) throw new NotFoundError("Không tìm thấy cơ sở được giao quản lý");

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

  /** Upcoming bookings on a sub-court, shown to staff before they pause it. */
  async surfaceAffectedBookings(userId: string, courtSurfaceId: string) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Không tìm thấy sân con thuộc quyền quản lý của bạn");
    return partnerRepository.upcomingBookings(courtId, { surfaceId: courtSurfaceId });
  },

  /**
   * Pausing works as for the partner: the customers of its upcoming bookings are told, the bookings stand. Staff can
   * reopen only a sub-court staff paused; one the partner paused waits for the partner.
   */
  async updateCourtSurfaceStatus(userId: string, courtSurfaceId: string, status: CourtActiveStatus) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Không tìm thấy sân con thuộc quyền quản lý của bạn");
    if (status === CourtActiveStatus.ACTIVE && surface.status === CourtActiveStatus.INACTIVE && surface.pausedByRole !== "RECIPIENT") {
      throw new ForbiddenError("Sân con này do đối tác tạm ngưng, chỉ đối tác mới mở lại được");
    }

    const pausing = status === CourtActiveStatus.INACTIVE && surface.status !== CourtActiveStatus.INACTIVE;
    const upcoming = pausing ? await partnerRepository.upcomingBookings(courtId, { surfaceId: courtSurfaceId }) : [];
    const result = await partnerRepository.updateCourtSurfaceStatus(courtSurfaceId, status, "RECIPIENT");
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    if (upcoming.length) {
      const court = await prisma.court.findUnique({ where: { id: courtId }, select: { name: true } });
      await notifyCourtChange(upcoming, { id: courtId, name: court?.name ?? "Sân" }, `tạm ngưng sân con ${surface.name}`);
    }
    return { ...result, notifiedBookings: upcoming.length };
  },

  async surfaceAvailability(userId: string, courtSurfaceId: string, date: string) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Không tìm thấy sân con thuộc quyền quản lý của bạn");

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      select: { openingTime: true, closingTime: true, prices: true }
    });
    if (!court) throw new NotFoundError("Không tìm thấy cơ sở được giao quản lý");

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

  /** Blocks free time on a sub-court, within its opening hours and not over already. */
  async lockSurfaceSlot(
    userId: string,
    courtSurfaceId: string,
    input: { bookingDate: string; startTime: string; minutes: number; reason?: string }
  ) {
    const courtId = await getManagedCourtId(userId);
    const surface = await prisma.courtSurface.findFirst({ where: { id: courtSurfaceId, courtId } });
    if (!surface) throw new NotFoundError("Không tìm thấy sân con thuộc quyền quản lý của bạn");

    const { opening, closing } = await surfaceHours(courtId, courtSurfaceId);
    const start = timeToMinutes(input.startTime);
    const end = start + input.minutes;
    const label = `${input.startTime}-${minutesToTime(end)}`;
    if (start < timeToMinutes(opening) || end > timeToMinutes(closing)) {
      throw new ValidationError(`Khung giờ ${label} nằm ngoài giờ mở cửa ${opening}-${closing}`);
    }
    const now = vietnamNow();
    if (input.bookingDate < now.date || (input.bookingDate === now.date && end <= timeToMinutes(now.time))) {
      throw new ValidationError(`Khung giờ ${label} ngày ${input.bookingDate} đã qua`);
    }

    const slot = { courtId, courtSurfaceId, date: toDbDate(input.bookingDate), startTime: timeToDate(input.startTime), endTime: timeToDate(minutesToTime(end)) };
    const block = await prisma.$transaction(async (tx) => {
      const taken = await slotTakenBy(tx, slot);
      if (taken) {
        throw new ConflictError(
          taken === "BOOKED" ? "Khung giờ này đã có khách đặt, không thể khoá" : "Khung giờ này đã nằm trong một lịch khoá khác",
          "LOCK_SLOT_CONFLICT"
        );
      }
      return tx.courtAvailabilityBlock.create({
        data: { courtId, courtSurfaceId, blockDate: slot.date, startTime: slot.startTime, endTime: slot.endTime, reason: input.reason, status: "ACTIVE" }
      });
    }, SERIALIZABLE);
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    return block;
  },

  async unlockSurfaceSlot(userId: string, blockId: string) {
    const courtId = await getManagedCourtId(userId);
    const block = await prisma.courtAvailabilityBlock.findFirst({ where: { id: blockId, courtId } });
    if (!block) throw new NotFoundError("Không tìm thấy lịch khoá này");
    const result = await prisma.courtAvailabilityBlock.update({ where: { id: blockId }, data: { status: "INACTIVE" } });
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    return result;
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
    if (!court) throw new NotFoundError("Không tìm thấy cơ sở được giao quản lý");

    const items = court.surfaces.map((surface) => {
      const bookings = court.bookings
        .filter((booking) => booking.courtSurfaceId === surface.id || booking.courtSurfaceId == null)
        .map((booking) => ({ ...booking, start: dbTime(booking.startTime), end: dbTime(booking.endTime) }));
      // A booking paid off at the cashier still fills its time, but it is never overdue nor waiting for anything.
      const open = bookings.filter((booking) => openOperationStatuses.includes(booking.bookingStatus));

      const currentBooking = bookings.find((booking) => timeToMinutes(booking.start) <= nowMinutes && timeToMinutes(booking.end) > nowMinutes);
      const latestEnded = [...open]
        .filter((booking) => timeToMinutes(booking.end) <= nowMinutes)
        .sort((left, right) => timeToMinutes(right.end) - timeToMinutes(left.end))[0];
      const nextBooking = open.find((booking) => timeToMinutes(booking.start) >= nowMinutes);
      const isOverdue = Boolean(!currentBooking && latestEnded && nowMinutes - timeToMinutes(latestEnded.end) <= 30 && !nextBooking);
      const minutesLeft = currentBooking ? timeToMinutes(currentBooking.end) - nowMinutes : null;

      let canExtend = false;
      if (currentBooking && currentBooking.bookingStatus !== BookingStatus.COMPLETED) {
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
          pausedByRole: surface.pausedByRole,
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

  /** Other active sub-courts the guest could move to for an extension: open until the new end and free from now. */
  async getAvailableSurfacesForExtension(userId: string, bookingId: string, minutes: number) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");

    const surfaces = await prisma.courtSurface.findMany({
      where: { courtId, status: CourtActiveStatus.ACTIVE, ...(booking.courtSurfaceId ? { id: { not: booking.courtSurfaceId } } : {}) },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, name: true }
    });

    const available = [];
    for (const surface of surfaces) {
      const { end, fits } = await extendedEnd(courtId, surface.id, booking, minutes);
      if (!fits) continue;
      const window = extensionWindow(booking, timeToDate(minutesToTime(end)), true);
      const taken = await slotTakenBy(prisma, { courtId, courtSurfaceId: surface.id, date: booking.bookingDate, ...window, excludeBookingId: booking.id });
      if (!taken) available.push(surface);
    }
    return available;
  },

  /**
   * Prices shown on the counter's "+N phút" and "Check-in sớm" buttons, computed exactly as extendBooking
   * and checkInBooking will charge them. The early check-in part is a snapshot of "now" (Vietnam time).
   * An extension past the sub-court's closing time is not offered (no price).
   */
  async timeChargeQuote(userId: string, bookingId: string, extendMinutes: number[]) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");
    const [policy, pricing, hours] = await Promise.all([
      courtTimeChargePolicy(courtId),
      dynamicPricingService.prefetch(courtId),
      surfaceHours(courtId, booking.courtSurfaceId)
    ]);
    const date = booking.bookingDate.toISOString().slice(0, 10);
    const endMinutes = timeToMinutes(dbTime(booking.endTime));

    const extensions = extendMinutes.map((minutes) => {
      const allowed = endMinutes + minutes <= timeToMinutes(hours.closing);
      return {
        minutes,
        allowed,
        amount: allowed ? extraTimeCharge(pricing, date, dbTime(booking.endTime), minutes, policy.extensionPricePercent).amount : null
      };
    });

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

  /**
   * Adds play time at the partner's extension % of the hour-by-hour price (collected at checkout), within the
   * sub-court's opening hours and only into free time. When the next booking or a block is in the way the guest can
   * move to another free sub-court, which then has to be free from now until the new end.
   */
  async extendBooking(userId: string, bookingId: string, minutes: number, targetSurfaceId?: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");
    if (!extendableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chỉ có thể gia hạn đơn đang chờ xử lý hoặc đã xác nhận");
    }

    const moving = Boolean(targetSurfaceId && targetSurfaceId !== booking.courtSurfaceId);
    let surfaceId = booking.courtSurfaceId;
    let movedTo: string | null = null;
    if (moving) {
      const surface = await prisma.courtSurface.findFirst({ where: { id: targetSurfaceId, courtId, status: CourtActiveStatus.ACTIVE } });
      if (!surface) throw new NotFoundError("Không tìm thấy sân con đang hoạt động thuộc quyền quản lý của bạn");
      surfaceId = surface.id;
      movedTo = surface.name;
    }
    const { end, closing, fits } = await extendedEnd(courtId, surfaceId, booking, minutes);
    if (!fits) throw new ValidationError(`Không gia hạn được quá giờ đóng cửa ${closing}`);
    const newEndTime = timeToDate(minutesToTime(end));

    const date = booking.bookingDate.toISOString().slice(0, 10);
    // The partner's extension % of the hour-by-hour court price, the same figure the quote showed staff.
    const [policy, pricing] = await Promise.all([courtTimeChargePolicy(courtId), dynamicPricingService.prefetch(courtId)]);
    const charge = extraTimeCharge(pricing, date, dbTime(booking.endTime), minutes, policy.extensionPricePercent);
    const window = extensionWindow(booking, newEndTime, moving);
    let note = appendNote(booking.note, `Gia hạn +${minutes} phút (${policy.extensionPricePercent}% giá giờ): ${noteAmount(charge.amount)}`);
    if (movedTo) note = appendNote(note, `Chuyển sang ${movedTo} lúc ${vietnamNow().time}`);

    return prisma.$transaction(async (tx) => {
      const taken = await slotTakenBy(tx, { courtId, courtSurfaceId: surfaceId, date: booking.bookingDate, ...window, excludeBookingId: booking.id });
      if (taken) {
        throw new ConflictError(
          moving
            ? "Sân được chọn cũng đã có lịch hoặc đang khoá, vui lòng chọn sân khác"
            : taken === "BLOCKED"
              ? "Sân này có lịch khoá ngay sau đó. Hãy chuyển khách sang sân trống."
              : "Sân này đã có lịch sau đó. Hãy chuyển khách sang sân trống.",
          "BOOKING_EXTENSION_CONFLICT"
        );
      }
      // Moved only from what was read: a second click or another counter extending meanwhile wins.
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, bookingStatus: booking.bookingStatus, endTime: booking.endTime },
        data: {
          endTime: newEndTime,
          courtSurfaceId: surfaceId,
          basePrice: { increment: charge.basePrice },
          dynamicAdjustmentAmount: { increment: charge.dynamicAdjustmentAmount },
          subtotal: { increment: charge.amount },
          totalPrice: { increment: charge.amount },
          note
        }
      });
      if (!count) throw new ConflictError("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang");
      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, endTime: booking.endTime },
        data: { endTime: newEndTime, court_surface_id: surfaceId, slotPrice: { increment: charge.amount } }
      });
      // Additional court time is collected at checkout.
      return tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    }, SERIALIZABLE);
  },

  /** What a walk-in costs and what is collected now, shown to staff before they take cash. Nothing is written. */
  async quoteWalkIn(userId: string, input: WalkInPayment & { slots: WalkInSession[]; occurrences?: number }) {
    const courtId = await getManagedCourtId(userId);
    const plan = await planWalkIn(courtId, input);
    return {
      sessions: plan.entries.length,
      skipped: plan.skipped,
      courtTotal: plan.courtTotal,
      servicesTotal: plan.servicesSubtotal,
      collectNow: plan.collectNow,
      depositPercent: plan.wantsDeposit ? plan.depositPercent : null
    };
  },

  async createWalkInBooking(userId: string, input: WalkInRequest & WalkInSession) {
    const courtId = await getManagedCourtId(userId);
    const plan = await planWalkIn(courtId, { ...input, slots: [input] });
    assertCashTaken(plan, input.cashReceived);
    const bookingId = await nextPrefixedId("b", "seq_bookings");
    // The QR is made before the transaction (the provider is slow); the slot is checked again inside it.
    const qr = plan.needsQr ? await createWalkInQr(plan.collectNow, plan.wantsDeposit ? "Dat coc san tai quay" : "Thanh toan dat san tai quay") : null;

    return prisma.$transaction(async (tx) => {
      assertNoWalkInSlotProblems(await walkInSlotProblems(tx, courtId, plan.entries), plan.entries);
      // Inside the transaction: a booking that fails leaves no empty walk-in account behind.
      const { customer, summary } = await resolveWalkInCustomer(tx, input.customerName, input.customerPhone);
      const [booking] = await createWalkInRows(tx, courtId, plan, plan.entries, { customerId: customer.id, bookingIds: [bookingId], note: input.note });
      const payment = qr
        ? await tx.payment.create({ data: walkInPaymentData(qr, { bookingId: booking.id, userId: customer.id, amount: plan.collectNow, deposit: plan.wantsDeposit }) })
        : null;
      return { booking, payment, customer: summary };
    }, SERIALIZABLE).catch(walkInSerializationConflict);
  },

  /**
   * Several (possibly different-date) time ranges at once, grouped under one BookingOrder so the staff UI and the
   * customer's history show one booking. Cash marks every booking paid at once; a transfer gets one QR for the
   * whole order, and payment.repository.applyWebhook pays every booking sharing the bookingOrderId.
   */
  async createWalkInBookingOrder(userId: string, input: WalkInRequest & { slots: WalkInSession[] }) {
    const courtId = await getManagedCourtId(userId);
    const plan = await planWalkIn(courtId, input);
    assertCashTaken(plan, input.cashReceived);
    const orderId = await nextPrefixedId("bo", "seq_booking_orders");
    const bookingIds = await Promise.all(plan.entries.map(() => nextPrefixedId("b", "seq_bookings")));
    const totalAmount = plan.courtTotal + plan.servicesSubtotal;
    const qr = plan.needsQr ? await createWalkInQr(plan.collectNow, plan.wantsDeposit ? "Dat coc san tai quay" : "Thanh toan dat san tai quay") : null;

    const { bookings, payment, customer } = await prisma.$transaction(async (tx) => {
      assertNoWalkInSlotProblems(await walkInSlotProblems(tx, courtId, plan.entries), plan.entries);
      const { customer, summary } = await resolveWalkInCustomer(tx, input.customerName, input.customerPhone);
      await tx.bookingOrder.create({
        data: {
          id: orderId,
          userId: customer.id,
          courtId,
          subtotal: totalAmount,
          totalAmount,
          paymentType: plan.payLater ? "PAY_AT_COURT" : plan.paymentMethod,
          status: plan.payLater || plan.isCash ? "CONFIRMED" : "PENDING",
          note: input.note
        }
      });
      const bookings = await createWalkInRows(tx, courtId, plan, plan.entries, { customerId: customer.id, bookingIds, bookingOrderId: orderId, note: input.note });
      const payment = qr
        ? await tx.payment.create({
            data: walkInPaymentData(qr, { bookingId: bookings[0].id, bookingOrderId: orderId, userId: customer.id, amount: plan.collectNow, deposit: plan.wantsDeposit })
          })
        : null;
      return { bookings, payment, customer: summary };
    }, SERIALIZABLE).catch(walkInSerializationConflict);

    return { orderId, bookings, payment, customer };
  },

  /**
   * Each selected slot repeats weekly for `occurrences` weeks; weeks already taken are skipped. A transfer gets one
   * BookingOrder and one QR for the whole series, made once the bookings exist since the amount depends on them.
   */
  async createRecurringWalkInBooking(userId: string, input: WalkInRequest & { slots: WalkInSession[]; occurrences: number }) {
    const courtId = await getManagedCourtId(userId);
    const plan = await planWalkIn(courtId, input);
    if (!plan.entries.length) throw new ConflictError("Mọi buổi đã chọn đều trùng lịch, chưa tạo được buổi nào", "WALK_IN_BOOKING_CONFLICT");
    assertCashTaken(plan, input.cashReceived);
    const bookingIds = await Promise.all(plan.entries.map(() => nextPrefixedId("b", "seq_bookings")));
    const seriesIds = await Promise.all(input.slots.map(() => nextPrefixedId("bs", "seq_booking_series")));
    const orderId = plan.needsQr ? await nextPrefixedId("bo", "seq_booking_orders") : null;
    const skipped = [...plan.skipped];

    const { created, customer, series } = await prisma.$transaction(async (tx) => {
      // Checked again inside the transaction: an occurrence booked since is skipped too, unless its cash was counted.
      const late = await walkInSlotProblems(tx, courtId, plan.entries);
      if (late.size && plan.isCash) {
        throw new ConflictError("Lịch vừa thay đổi nên số tiền mặt cần thu đã khác. Hãy tạo lại để xem số tiền mới.", "WALK_IN_CASH_MISMATCH");
      }
      const kept = plan.entries.filter((entry, index) => {
        const problem = late.get(index);
        if (problem) skipped.push({ courtSurfaceId: entry.courtSurfaceId, date: entry.bookingDate, reason: walkInSkipReasons[problem] });
        return !problem;
      });
      if (!kept.length) throw new ConflictError("Mọi buổi đã chọn đều trùng lịch, chưa tạo được buổi nào", "WALK_IN_BOOKING_CONFLICT");

      const { customer, summary } = await resolveWalkInCustomer(tx, input.customerName, input.customerPhone);
      // A series exists only for a template that got at least one booking.
      const templates = [...new Set(kept.map((entry) => entry.templateIndex))];
      for (const templateIndex of templates) {
        const slot = input.slots[templateIndex];
        await tx.bookingSeries.create({
          data: {
            id: seriesIds[templateIndex],
            courtId,
            courtSurfaceId: slot.courtSurfaceId,
            createdByUserId: userId,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            startTime: timeToDate(slot.startTime),
            durationMinutes: slot.minutes,
            firstBookingDate: toDbDate(slot.bookingDate),
            occurrencesRequested: input.occurrences,
            note: input.note
          }
        });
      }
      if (orderId) {
        const totalAmount = kept.reduce((sum, entry) => sum + entry.courtSubtotal, 0) + plan.servicesSubtotal;
        await tx.bookingOrder.create({
          data: { id: orderId, userId: customer.id, courtId, subtotal: totalAmount, totalAmount, paymentType: plan.paymentMethod, status: "PENDING", note: input.note }
        });
      }
      const created = await createWalkInRows(tx, courtId, plan, kept, {
        customerId: customer.id,
        bookingIds: kept.map((entry) => bookingIds[plan.entries.indexOf(entry)]),
        bookingOrderId: orderId ?? undefined,
        seriesIds,
        note: input.note
      });
      return { created, customer: summary, series: templates.map((templateIndex) => ({ id: seriesIds[templateIndex] })) };
    }, SERIALIZABLE).catch(walkInSerializationConflict);

    let payment = null;
    if (orderId) {
      const amount = created.reduce((sum, booking) => sum + Number(booking.depositAmount), 0);
      const qr = await createWalkInQr(amount, plan.wantsDeposit ? "Dat coc san dinh ky tai quay" : "Thanh toan dat san dinh ky tai quay");
      payment = await prisma.payment.create({
        data: walkInPaymentData(qr, { bookingId: created[0].id, bookingOrderId: orderId, userId: created[0].userId, amount, deposit: plan.wantsDeposit })
      });
    }

    return { series, created, skipped, payment, customer };
  },

  async paymentStatus(userId: string, paymentId: string) {
    const courtId = await getManagedCourtId(userId);
    const find = () =>
      prisma.payment.findFirst({
        where: { id: paymentId, booking: { courtId } },
        include: { booking: { select: { bookingStatus: true } } }
      });
    let payment = await find();
    if (!payment) throw new NotFoundError("Không tìm thấy thanh toán thuộc quyền quản lý của bạn");
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
    if (!payment) throw new NotFoundError("Không tìm thấy thanh toán thuộc quyền quản lý của bạn");
    if (payment.status !== "PAID") {
      if (!(payment.status === "PENDING" || payment.status === "UNPAID") || payment.expiresAt.getTime() <= Date.now()) {
        throw new ValidationError("Mã QR đã hết hạn hoặc bị huỷ nên đơn đã bị huỷ, vui lòng tạo lại đơn");
      }
      if (!paymentService.manualCompletionAllowed()) {
        throw new ForbiddenError("Thanh toán QR được xác nhận tự động khi tiền về tài khoản. Bấm 'Kiểm tra lại' nếu khách đã chuyển khoản");
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
    if (!payment) throw new NotFoundError("Không tìm thấy thanh toán thuộc quyền quản lý của bạn");
    if (payment.status === "PENDING" && payment.expiresAt.getTime() > Date.now()) {
      await syncPaymentWithProvider(payment);
    }
    return this.paymentStatus(userId, paymentId);
  },

  /** The same check-in as the cashier's (recipient.counter), for a booking of this staff member's court. */
  async checkInBooking(userId: string, bookingId: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");
    return checkInBooking(booking);
  },

  /**
   * The guest leaves before the booked end: the booking finishes now and frees the rest of its time. Only once the
   * bill is paid; money still owed is taken at the cashier, which finishes the booking itself.
   */
  async earlyCheckOutBooking(userId: string, bookingId: string) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, courtId } });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");
    if (!checkOutBookingStatuses.includes(booking.bookingStatus)) {
      throw new ValidationError("Chỉ check-out được đơn đã xác nhận hoặc đang chơi");
    }

    const { date: today, time: currentTime } = vietnamNow();
    const date = booking.bookingDate.toISOString().slice(0, 10);
    if (date !== today) throw new ValidationError("Chỉ check-out được đơn của hôm nay");
    if (timeToMinutes(currentTime) <= timeToMinutes(dbTime(booking.startTime)) || timeToMinutes(currentTime) >= timeToMinutes(dbTime(booking.endTime))) {
      throw new ValidationError("Chỉ check-out được khi khách đang trong giờ chơi");
    }

    const newEndTime = timeToDate(currentTime);
    const { updated, settlement } = await prisma.$transaction(async (tx) => {
      await assertNothingOwed(booking.id, tx);
      const { count } = await tx.booking.updateMany({
        where: { id: booking.id, bookingStatus: booking.bookingStatus, endTime: booking.endTime },
        data: { endTime: newEndTime, bookingStatus: BookingStatus.COMPLETED, note: appendNote(booking.note, `Khách check-out lúc ${currentTime}`) }
      });
      if (!count) throw new ConflictError("Đơn vừa được cập nhật ở nơi khác, hãy tải lại trang");
      const updatedBooking = await tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { court: { include: { partner: true } } } });
      await tx.bookingSlot.updateMany({
        where: { bookingId: booking.id, endTime: booking.endTime },
        data: { endTime: newEndTime }
      });
      const updatedSettlement = await settlementService.finishBooking(updatedBooking, BookingStatus.COMPLETED, tx);
      return { updated: updatedBooking, settlement: updatedSettlement };
    }, SERIALIZABLE);

    if (settlement) {
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    realtimeService.toCourt(courtId, realtimeEvents.courtAvailabilityUpdated, { courtId });
    return updated;
  }
};
