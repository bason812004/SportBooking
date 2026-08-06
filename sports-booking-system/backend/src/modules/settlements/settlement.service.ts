import type { Booking, PartnerProfile } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { toDbDate } from "../../shared/utils/time.js";
import { commissionService } from "../commission/commission.service.js";
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

function toDto(settlement: {
  grossAmount: unknown;
  voucherDiscount: unknown;
  platformDiscount: unknown;
  partnerDiscount: unknown;
  commissionRate: unknown;
  commissionAmount: unknown;
  serviceFee: unknown;
  netAmount: unknown;
  [key: string]: unknown;
}) {
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

function parseFilters(query: SettlementListQuery, partnerId?: string) {
  return {
    partnerId: partnerId ?? query.partnerId?.trim() ?? undefined,
    status: query.status,
    fromDate: query.fromDate ? toDbDate(query.fromDate) : undefined,
    toDate: query.toDate ? new Date(toDbDate(query.toDate).getTime() + 24 * 60 * 60 * 1000) : undefined
  };
}

function emitSettlementUpdated(settlement: { partnerId: string } & Record<string, unknown>) {
  realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
  realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
  realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
  realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
}

async function summarize(filters: { partnerId?: string; fromDate?: Date; toDate?: Date }) {
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
      throw new ValidationError("Chi co the quyet toan settlement dang cho xu ly");
    }

    await prisma.$transaction(async (tx) => {
      const count = await settlementRepository.transitionById(id, ["PENDING"], { status: "SETTLED", settledAt: new Date() }, tx);
      if (count === 0) throw new ValidationError("Settlement da duoc xu ly boi thao tac khac");
      const moved = await walletRepository.settlePending(settlement.partnerId, asNumber(settlement.netAmount), tx);
      if (moved === 0) throw new ValidationError("So du cho quyet toan cua vi khong du");
    });

    await recordAdminAction(actorId, "SETTLEMENT_COMPLETED", "SETTLEMENT", id, {
      bookingId: settlement.bookingId,
      partnerId: settlement.partnerId,
      netAmount: asNumber(settlement.netAmount)
    });
    const updated = await settlementRepository.byId(id);
    emitSettlementUpdated(updated!);
    return toDto(updated!);
  },

  async adminCancel(actorId: string, id: string) {
    const settlement = await settlementRepository.byId(id);
    if (!settlement) throw new NotFoundError("Khong tim thay settlement");
    if (settlement.status !== "PENDING" && settlement.status !== "SETTLED") {
      throw new ValidationError("Chi co the huy settlement dang cho xu ly hoac da quyet toan");
    }

    await prisma.$transaction(async (tx) => {
      const fromStatus = settlement.status as SettlementStatus;
      const count = await settlementRepository.transitionById(id, [fromStatus], { status: "CANCELLED" }, tx);
      if (count === 0) throw new ValidationError("Settlement da duoc xu ly boi thao tac khac");
      const netAmount = asNumber(settlement.netAmount);
      const reverted =
        fromStatus === "PENDING"
          ? await walletRepository.rollbackPending(settlement.partnerId, netAmount, tx)
          : await walletRepository.debitAvailable(settlement.partnerId, netAmount, tx);
      if (reverted === 0) {
        throw new ValidationError("So du vi khong du de hoan tra settlement nay");
      }
    });

    await recordAdminAction(actorId, "SETTLEMENT_CANCELLED", "SETTLEMENT", id, {
      bookingId: settlement.bookingId,
      partnerId: settlement.partnerId,
      previousStatus: settlement.status,
      netAmount: asNumber(settlement.netAmount)
    });
    const updated = await settlementRepository.byId(id);
    emitSettlementUpdated(updated!);
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
