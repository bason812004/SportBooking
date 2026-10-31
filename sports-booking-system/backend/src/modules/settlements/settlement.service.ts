import type { Booking, PartnerProfile } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage, toDbDate, vietnamNow } from "../../shared/utils/time.js";
import { courtAmount } from "../checkout/checkout.calculations.js";
import { commissionService } from "../commission/commission.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { walletRepository } from "../wallets/wallet.repository.js";
import { getPartnerProfileByUser } from "../wallets/wallet.service.js";
import { settlementRepository } from "./settlement.repository.js";
import type { DbClient, SettlementListQuery, SettlementStatus } from "./settlement.types.js";

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Court time the customer pays for (incl. early check-in and extensions) after the voucher; no services. */
export function commissionableCourtAmount(booking: { basePrice?: unknown; dynamicAdjustmentAmount?: unknown; totalPrice: unknown; voucherDiscountAmount?: unknown }) {
  return Math.max(0, round2(courtAmount(booking) - asNumber(booking.voucherDiscountAmount)));
}

/** The part of the booking's voucher discount the platform funds (an admin voucher); none once the use was given back. */
export function platformFundedDiscount(booking: { bookingVoucher?: { platformShare: unknown; releasedAt: Date | null } | null }) {
  const use = booking.bookingVoucher;
  return use && !use.releasedAt ? asNumber(use.platformShare) : 0;
}

function toDto<T extends {
  grossAmount: unknown;
  voucherDiscount: unknown;
  platformDiscount: unknown;
  partnerDiscount: unknown;
  commissionRate: unknown;
  commissionAmount: unknown;
  serviceFee: unknown;
  netAmount: unknown;
}>(settlement: T) {
  return {
    ...settlement,
    grossAmount: asNumber(settlement.grossAmount),
    voucherDiscount: asNumber(settlement.voucherDiscount),
    platformDiscount: asNumber(settlement.platformDiscount),
    partnerDiscount: asNumber(settlement.partnerDiscount),
    commissionRate: asNumber(settlement.commissionRate),
    commissionAmount: asNumber(settlement.commissionAmount),
    serviceFee: asNumber(settlement.serviceFee),
    netAmount: asNumber(settlement.netAmount)
  };
}

/** Days are Vietnam days: a settlement made at 01:00 on the 5th belongs to the 5th, not the 4th as in UTC. */
const vietnamDayStart = (day: string) => new Date(`${day}T00:00:00+07:00`);

function parseFilters(query: SettlementListQuery, partnerId?: string) {
  return {
    partnerId: partnerId ?? (query.partnerId?.trim() || undefined),
    status: query.status,
    collectedBy: query.collectedBy,
    search: query.search?.trim() || undefined,
    fromDate: query.fromDate ? vietnamDayStart(query.fromDate) : undefined,
    toDate: query.toDate ? new Date(vietnamDayStart(query.toDate).getTime() + 24 * 60 * 60 * 1000) : undefined
  };
}

/** Bookings whose online money may be released by hand: played, or the customer did not come. */
const FINISHED_BOOKING_STATUSES = ["COMPLETED", "NO_SHOW"];

function emitSettlementUpdated(settlement: { partnerId: string } & Record<string, unknown>) {
  realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
  realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
  realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
  realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
}

/** Tells the partner a settlement of theirs was cancelled or taken back, and why; a failed notice only logs. */
async function notifyPartnerOfCancellation(
  settlement: { partnerId: string; status: string; collectedBy: string; netAmount: unknown; booking?: { bookingCode: string } | null; bookingId: string },
  reason: string
) {
  const booking = settlement.booking?.bookingCode ?? settlement.bookingId;
  const what =
    settlement.collectedBy === "PARTNER"
      ? `Khoản hoa hồng của đơn ${booking} đã được huỷ (hoàn lại hoa hồng đã trừ).`
      : settlement.status === "SETTLED"
        ? `Khoản ${money(settlement.netAmount)} của đơn ${booking} đã bị thu hồi khỏi số dư khả dụng.`
        : `Khoản chờ quyết toán ${money(settlement.netAmount)} của đơn ${booking} đã bị huỷ.`;
  try {
    const userId = await settlementRepository.partnerUserId(settlement.partnerId);
    if (!userId) return;
    await notificationService.create({
      userId,
      title: "Khoản quyết toán đã bị điều chỉnh",
      content: `${what} Lý do: ${reason.trim().replace(/[.\s]+$/, "")}.`,
      type: "SETTLEMENT_CANCELLED",
      metadata: { bookingId: settlement.bookingId }
    });
  } catch (error) {
    console.error("[Settlement] Partner notification failed:", error);
  }
}

const money = (value: unknown) => `${asNumber(value).toLocaleString("vi-VN")}đ`;

async function summarize(filters: ReturnType<typeof parseFilters>) {
  const groups = await settlementRepository.summary(filters);
  const byStatus: Record<string, { count: number; grossAmount: number; commissionAmount: number; netAmount: number }> = {};
  const total = { count: 0, grossAmount: 0, commissionAmount: 0, netAmount: 0 };
  for (const group of groups) {
    const row = {
      count: group._count._all,
      grossAmount: asNumber(group._sum.grossAmount),
      commissionAmount: asNumber(group._sum.commissionAmount),
      netAmount: asNumber(group._sum.netAmount)
    };
    byStatus[group.status] = row;
    total.count += row.count;
    total.grossAmount += row.grossAmount;
    total.commissionAmount += row.commissionAmount;
    total.netAmount += row.netAmount;
  }
  return { total, byStatus };
}

export const settlementService = {
  /**
   * Tao settlement PENDING khi thanh toan online PAID.
   * Idempotent theo bookingId. Goi ben trong transaction cua payment webhook.
   */
  async createFromPaidBooking(
    booking: Booking & { court: { partner: Pick<PartnerProfile, "id" | "commissionRate"> } },
    paymentId: string | null,
    tx: DbClient
  ) {
    const existing = await settlementRepository.byBookingId(booking.id, tx);
    if (existing) return null;

    const partnerId = booking.court.partner.id;
    const grossAmount = asNumber(booking.totalPrice);
    const voucherDiscount = asNumber(booking.voucherDiscountAmount);
    const commissionRate = await commissionService.effectiveRate(booking.court.partner, tx);
    const commissionAmount = round2(grossAmount * (commissionRate / 100));
    const netAmount = round2(grossAmount - commissionAmount);

    const settlement = await settlementRepository.create(
      {
        bookingId: booking.id,
        partnerId,
        paymentId,
        grossAmount,
        voucherDiscount,
        platformDiscount: 0,
        partnerDiscount: voucherDiscount,
        commissionRate,
        commissionAmount,
        serviceFee: 0,
        netAmount
      },
      tx
    );
    await walletRepository.creditPending(partnerId, netAmount, tx);
    return settlement;
  },

  /**
   * Commission on court money the partner collected itself (cash, the partner's own QR, bank transfer).
   * Called whenever a booking becomes COMPLETED, however it was paid: the commission follows the court
   * time played, so collecting off the system does not avoid it. The partner already holds that money,
   * so the commission is taken from the wallet and whatever the wallet cannot cover becomes debt.
   * Only court time is commissionable (services sold at the counter are the partner's own sales), and the
   * part paid online was already charged through the PLATFORM settlement.
   * Idempotent: the PARTNER row keeps the gross already charged, so a reopened checkout (an extension)
   * only charges the increase. A row an admin cancelled means the commission was waived.
   * A voucher the platform funds (an admin voucher) is paid back here, once the court was played: the
   * platform owes the partner that part of the discount, so it counts as court money the partner earned
   * (commission included, as if no voucher was used) and is credited to the wallet, kept as platformDiscount.
   */
  async chargePartnerCollected(bookingId: string, tx: DbClient) {
    const booking = await settlementRepository.bookingForCollection(bookingId, tx);
    if (!booking) throw new NotFoundError("Booking không tồn tại");
    const platform = await settlementRepository.byBookingId(bookingId, tx);
    const existing = await settlementRepository.byBookingId(bookingId, tx, "PARTNER");
    if (existing && existing.status !== "SETTLED") return existing;

    const platformFunded = platformFundedDiscount(booking);
    const courtTotal = round2(commissionableCourtAmount(booking) + platformFunded);
    const onlineGross = platform && platform.status !== "CANCELLED" ? asNumber(platform.grossAmount) : 0;
    const partnerGross = Math.max(0, round2(courtTotal - onlineGross));
    const extraGross = Math.max(0, round2(partnerGross - asNumber(existing?.grossAmount)));
    const extraCredit = Math.max(0, round2(platformFunded - asNumber(existing?.platformDiscount)));
    let result = existing;
    if (extraGross > 0 || extraCredit > 0) {
      const partnerId = booking.court.partner.id;
      const rate = existing ? asNumber(existing.commissionRate) : await commissionService.effectiveRate(booking.court.partner, tx);
      const commission = round2(extraGross * rate / 100);
      if (existing) {
        await settlementRepository.incrementAmounts(
          existing.id,
          ["SETTLED"],
          { grossAmount: extraGross, commissionAmount: commission, netAmount: extraGross - commission, platformDiscount: extraCredit },
          tx
        );
        result = await settlementRepository.byBookingId(bookingId, tx, "PARTNER");
      } else {
        result = await settlementRepository.create({
          bookingId, partnerId, paymentId: null,
          collectedBy: "PARTNER", status: "SETTLED", settledAt: new Date(),
          grossAmount: partnerGross, voucherDiscount: 0, platformDiscount: platformFunded, partnerDiscount: 0,
          commissionRate: rate, commissionAmount: commission, serviceFee: 0, netAmount: partnerGross - commission
        }, tx);
      }
      // The platform's share first, so the commission is taken from it instead of becoming debt.
      await walletRepository.creditAvailable(partnerId, extraCredit, tx);
      await walletRepository.chargeCommission(partnerId, commission, tx);
      if (extraCredit > 0) await walletRepository.offsetDebt(partnerId, tx);
    }
    await commissionService.createEarning(booking, "COMPLETED", tx, courtTotal);
    return result;
  },

  /**
   * The money side of finishing a booking, whoever finishes it (partner, court staff, the overdue job): the
   * commission ledger earning, the online settlement released to the wallet and, when it was played, commission on
   * the court money collected at the counter. Call it in the transaction that set the booking's new status.
   */
  async finishBooking(
    booking: Booking & { court: { partner: Pick<PartnerProfile, "id" | "commissionRate"> } },
    status: "COMPLETED" | "NO_SHOW",
    tx: DbClient
  ) {
    await commissionService.createEarning(booking, status, tx);
    const settlement = await this.settleForBooking(booking.id, tx);
    if (status === "COMPLETED") await this.chargePartnerCollected(booking.id, tx);
    return settlement;
  },

  /**
   * Booking check-in som / gia han lam tang totalPrice khi settlement con PENDING ->
   * cong them phan phat sinh vao settlement va pending_balance cua vi.
   * No-op khi khong co settlement hoac settlement da SETTLED (thanh toan tien mat).
   */
  async addExtraGrossAmount(bookingId: string, extraGrossAmount: number, tx: DbClient) {
    if (extraGrossAmount <= 0) return null;
    const settlement = await settlementRepository.byBookingId(bookingId, tx);
    if (!settlement || settlement.status !== "PENDING") return null;

    const extraCommission = round2(extraGrossAmount * (asNumber(settlement.commissionRate) / 100));
    const extraNet = round2(extraGrossAmount - extraCommission);

    const count = await settlementRepository.incrementAmounts(
      settlement.id,
      ["PENDING"],
      { grossAmount: extraGrossAmount, commissionAmount: extraCommission, netAmount: extraNet },
      tx
    );
    if (count === 0) return null;

    await walletRepository.creditPending(settlement.partnerId, extraNet, tx);
    return {
      ...settlement,
      grossAmount: asNumber(settlement.grossAmount) + extraGrossAmount,
      commissionAmount: asNumber(settlement.commissionAmount) + extraCommission,
      netAmount: asNumber(settlement.netAmount) + extraNet
    };
  },

  /**
   * Booking hoan thanh -> settlement PENDING chuyen SETTLED, pending -> available.
   * No-op khi booking khong co settlement (vd thanh toan tien mat) hoac da xu ly.
   */
  async settleForBooking(bookingId: string, tx: DbClient) {
    const settlement = await settlementRepository.byBookingId(bookingId, tx);
    if (!settlement || settlement.status !== "PENDING") return null;

    const count = await settlementRepository.transitionById(
      settlement.id,
      ["PENDING"],
      { status: "SETTLED", settledAt: new Date() },
      tx
    );
    if (count === 0) return null;

    const moved = await walletRepository.settlePending(settlement.partnerId, asNumber(settlement.netAmount), tx);
    if (moved === 0) {
      throw new ValidationError("So du cho quyet toan cua vi khong khop voi settlement");
    }
    // Newly available online earnings pay off commission owed on money the partner collected itself.
    await walletRepository.offsetDebt(settlement.partnerId, tx);
    return { ...settlement, status: "SETTLED" as SettlementStatus, settledAt: new Date() };
  },

  /**
   * Booking bi huy khi settlement con PENDING -> rollback pending, settlement CANCELLED.
   * No-op khi khong co settlement hoac settlement da SETTLED.
   */
  async cancelForBooking(bookingId: string, tx: DbClient) {
    const settlement = await settlementRepository.byBookingId(bookingId, tx);
    if (!settlement || settlement.status !== "PENDING") return null;

    const count = await settlementRepository.transitionById(settlement.id, ["PENDING"], { status: "CANCELLED" }, tx);
    if (count === 0) return null;

    const rolled = await walletRepository.rollbackPending(settlement.partnerId, asNumber(settlement.netAmount), tx);
    if (rolled === 0) {
      throw new ValidationError("So du cho quyet toan cua vi khong khop voi settlement");
    }
    return { ...settlement, status: "CANCELLED" as SettlementStatus };
  },

  async adminSettle(actorId: string, id: string) {
    const settlement = await settlementRepository.byId(id);
    if (!settlement) throw new NotFoundError("Khong tim thay settlement");
    if (settlement.status !== "PENDING") {
      throw new ValidationError("Chỉ quyết toán được khoản đang chờ quyết toán");
    }
    // Released before the court is played, the money would stay with the partner even if the booking is then
    // cancelled and refunded (cancelling only rolls back a pending settlement).
    const bookingStatus = settlement.booking?.bookingStatus;
    if (!bookingStatus || !FINISHED_BOOKING_STATUSES.includes(bookingStatus)) {
      throw new ValidationError("Chỉ quyết toán tay được khi đơn đã hoàn thành hoặc khách không đến");
    }

    await prisma.$transaction(async (tx) => {
      const count = await settlementRepository.transitionById(id, ["PENDING"], { status: "SETTLED", settledAt: new Date() }, tx);
      if (count === 0) throw new ValidationError("Settlement da duoc xu ly boi thao tac khac");
      const moved = await walletRepository.settlePending(settlement.partnerId, asNumber(settlement.netAmount), tx);
      if (moved === 0) throw new ValidationError("So du cho quyet toan cua vi khong du");
      await walletRepository.offsetDebt(settlement.partnerId, tx);
      await recordAdminAction(actorId, "SETTLEMENT_COMPLETED", "SETTLEMENT", id, {
        bookingId: settlement.bookingId,
        partnerId: settlement.partnerId,
        netAmount: asNumber(settlement.netAmount)
      }, tx);
    });

    const updated = await settlementRepository.byId(id);
    emitSettlementUpdated(updated!);
    return toDto(updated!);
  },

  /** Cancels a pending settlement or takes back a settled one; the reason is recorded and sent to the partner. */
  async adminCancel(actorId: string, id: string, reason: string) {
    const settlement = await settlementRepository.byId(id);
    if (!settlement) throw new NotFoundError("Không tìm thấy khoản quyết toán");
    if (settlement.status !== "PENDING" && settlement.status !== "SETTLED") {
      throw new ValidationError("Chỉ huỷ được khoản đang chờ quyết toán hoặc đã quyết toán");
    }

    await prisma.$transaction(async (tx) => {
      const fromStatus = settlement.status as SettlementStatus;
      const count = await settlementRepository.transitionById(id, [fromStatus], { status: "CANCELLED" }, tx);
      if (count === 0) throw new ConflictError("Khoản quyết toán vừa được xử lý ở nơi khác, hãy tải lại trang");
      // The partner holds that money; cancelling waives the commission charged on it and takes back what the
      // platform paid toward a voucher (from the balance, or as debt when the balance cannot cover it).
      if (settlement.collectedBy === "PARTNER") {
        await walletRepository.refundCommission(settlement.partnerId, asNumber(settlement.commissionAmount), tx);
        await walletRepository.chargeCommission(settlement.partnerId, asNumber(settlement.platformDiscount), tx);
      } else {
        const netAmount = asNumber(settlement.netAmount);
        const reverted =
          fromStatus === "PENDING"
            ? await walletRepository.rollbackPending(settlement.partnerId, netAmount, tx)
            : await walletRepository.debitAvailable(settlement.partnerId, netAmount, tx);
        if (reverted === 0) {
          throw new ValidationError("Số dư ví của đối tác không đủ để thu hồi khoản này (có thể đối tác đã rút)");
        }
      }
      await recordAdminAction(actorId, "SETTLEMENT_CANCELLED", "SETTLEMENT", id, {
        bookingId: settlement.bookingId,
        partnerId: settlement.partnerId,
        previousStatus: settlement.status,
        netAmount: asNumber(settlement.netAmount),
        reason
      }, tx);
    });
    const updated = await settlementRepository.byId(id);
    emitSettlementUpdated(updated!);
    await notifyPartnerOfCancellation(settlement, reason);
    return toDto(updated!);
  },

  async listMine(userId: string, query: SettlementListQuery) {
    const profile = await getPartnerProfileByUser(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await settlementRepository.list(parseFilters(query, profile.id), page, limit);
    return { items: items.map(toDto), meta: paginationMeta(page, limit, total) };
  },

  async detailMine(userId: string, id: string) {
    const profile = await getPartnerProfileByUser(userId);
    const settlement = await settlementRepository.byId(id);
    if (!settlement) throw new NotFoundError("Khong tim thay settlement");
    if (settlement.partnerId !== profile.id) throw new ForbiddenError("Ban khong co quyen xem settlement nay");
    return toDto(settlement);
  },

  /**
   * The partner's revenue for one month of play (booking dates, so Vietnam days), from the ledger the wallet uses:
   * settled money is revenue, money still waiting for its booking to finish is shown apart, cancelled settlements
   * are left out.
   */
  async revenueMonth(partnerId: string, month?: string) {
    const value = month ?? vietnamNow().date.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new ValidationError("Tháng phải có dạng YYYY-MM");
    const [year, monthNumber] = value.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const rows = await settlementRepository.forPlayDates(partnerId, toDbDate(`${value}-01`), toDbDate(`${value}-${String(lastDay).padStart(2, "0")}`));
    const items = rows.map(toDto);
    const totals = (list: typeof items) =>
      list.reduce(
        (sum, row) => ({
          grossAmount: round2(sum.grossAmount + row.grossAmount),
          commissionAmount: round2(sum.commissionAmount + row.commissionAmount),
          netAmount: round2(sum.netAmount + row.netAmount),
          count: sum.count + 1
        }),
        { grossAmount: 0, commissionAmount: 0, netAmount: 0, count: 0 }
      );
    return {
      month: value,
      settled: totals(items.filter((row) => row.status === "SETTLED")),
      pending: totals(items.filter((row) => row.status !== "SETTLED")),
      items
    };
  },

  async summaryMine(userId: string, query: SettlementListQuery) {
    const profile = await getPartnerProfileByUser(userId);
    return summarize(parseFilters(query, profile.id));
  },

  async adminList(query: SettlementListQuery) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await settlementRepository.list(parseFilters(query), page, limit);
    return { items: items.map(toDto), meta: paginationMeta(page, limit, total) };
  },

  async adminSummary(query: SettlementListQuery) {
    return summarize(parseFilters(query));
  }
};
