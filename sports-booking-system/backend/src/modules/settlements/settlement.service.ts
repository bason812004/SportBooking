import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { commissionService } from "../commission/commission.service.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { settlementRepository } from "./settlement.repository.js";
import type { SettlementBreakdown } from "./settlement.types.js";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

async function ensureWallet(partnerId: string, tx: Prisma.TransactionClient) {
  const existing = await tx.partnerWallet.findUnique({ where: { partnerId } });
  if (existing) return existing;
  return tx.partnerWallet.create({
    data: { partnerId, availableBalance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0, currency: "VND" }
  });
}

export const settlementService = {
  /**
   * Tính breakdown cho 1 booking để tạo settlement.
   * Quy tắc:
   * gross_amount  = subtotal (tổng giá gốc court + services, KHÔNG trừ voucher)
   * voucher_discount = tổng voucher đã áp dụng
   * platform_discount = giá trị Platform Voucher (hiện tại = 0 vì chưa có Platform voucher)
   * partner_discount = voucher của Partner (voucherDiscountAmount)
   * commission_amount = gross_amount * commission_rate%
   * net_amount = gross_amount - commission_amount
   */
  async calculateBreakdown(bookingId: string): Promise<SettlementBreakdown> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: { include: { partner: true } },
        bookingServices: { include: { service: true } },
        bookingVoucher: { include: { voucher: true } },
        bookingSlots: true
      }
    });
    if (!booking) throw new NotFoundError("Booking not found");

    const partnerId = booking.court.partnerId;
    const commissionRate = await commissionService.effectiveRate(booking.court.partner, prisma);

    const slotTotal = booking.bookingSlots.reduce((sum, slot) => sum + Number(slot.slotPrice), 0);
    const serviceTotal = booking.bookingServices.reduce((sum, bs) => sum + Number(bs.price) * bs.quantity, 0);
    const grossAmount = round2(slotTotal + serviceTotal);

    const voucherDiscount = toNum(booking.voucherDiscountAmount);

    const platformDiscount = 0;
    const partnerDiscount = voucherDiscount;

    const commissionAmount = round2(grossAmount * (commissionRate / 100));
    const serviceFee = 0;
    const netAmount = round2(grossAmount - commissionAmount);

    return {
      grossAmount,
      voucherDiscount,
      platformDiscount,
      partnerDiscount,
      commissionAmount,
      serviceFee,
      netAmount,
      commissionRate
    };
  },

  /**
   * Tạo settlement khi payment webhook xác nhận PAID.
   * Hook vào payment.service.ts applyWebhook → gọi hàm này.
   */
  async createSettlementFromPayment(
    bookingId: string,
    paymentId: string,
    tx: Prisma.TransactionClient
  ) {
    const existing = await tx.settlement.findUnique({ where: { bookingId } });
    if (existing) return existing;

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: { include: { partner: true } },
        bookingServices: { include: { service: true } },
        bookingVoucher: { include: { voucher: true } },
        bookingSlots: true
      }
    });
    if (!booking) throw new NotFoundError("Booking not found");
    if (booking.paymentStatus !== "PAID") {
      throw new ValidationError("Booking chua duoc thanh toan");
    }

    const partnerId = booking.court.partnerId;
    const commissionRate = await commissionService.effectiveRate(booking.court.partner, tx);

    const slotTotal = booking.bookingSlots.reduce((sum, slot) => sum + Number(slot.slotPrice), 0);
    const serviceTotal = booking.bookingServices.reduce((sum, bs) => sum + Number(bs.price) * bs.quantity, 0);
    const grossAmount = round2(slotTotal + serviceTotal);

    // Tinh voucher discount theo funded_by:
    //  - PLATFORM: platform chi tra -> khong tru doanh thu partner
    //  - PARTNER: partner chi tra -> tru doanh thu partner
    //  - SHARED: chia theo ty le partner_funding_percent / platform_funding_percent
    const voucherDiscount = toNum(booking.voucherDiscountAmount);
    let platformDiscount = 0;
    let partnerDiscount = 0;
    if (booking.bookingVoucher?.voucher) {
      const v = booking.bookingVoucher.voucher;
      const fundedBy = v.fundedBy ?? "PARTNER";
      const partnerPct = Number(v.partnerFundingPercent ?? 100);
      const platformPct = Number(v.platformFundingPercent ?? 0);
      if (fundedBy === "PLATFORM") {
        platformDiscount = voucherDiscount;
        partnerDiscount = 0;
      } else if (fundedBy === "PARTNER") {
        platformDiscount = 0;
        partnerDiscount = voucherDiscount;
      } else {
        // SHARED
        platformDiscount = round2(voucherDiscount * (platformPct / 100));
        partnerDiscount = round2(voucherDiscount * (partnerPct / 100));
      }
    } else {
      partnerDiscount = voucherDiscount;
    }

    const commissionAmount = round2(grossAmount * (commissionRate / 100));
    // Net cho partner = gross - commission - partner-funded voucher discount
    const netAmount = round2(Math.max(0, grossAmount - commissionAmount - partnerDiscount));

    await ensureWallet(partnerId, tx);

    const settlement = await tx.settlement.create({
      data: {
        bookingId,
        partnerId,
        paymentId,
        grossAmount,
        voucherDiscount,
        platformDiscount,
        partnerDiscount,
        commissionAmount,
        serviceFee: 0,
        netAmount,
        status: "PENDING"
      }
    });

    await tx.partnerWallet.update({
      where: { partnerId },
      data: {
        pendingBalance: { increment: netAmount },
        totalEarned: { increment: netAmount }
      }
    });

    return settlement;
  },

  /**
   * Settlement COMPLETED khi booking COMPLETED hoặc đã qua thời gian refund.
   * Chuyển tiền từ pending_balance → available_balance.
   */
  async settle(settlementId: string, actorId: string) {
    const settlement = await settlementRepository.findById(settlementId);
    if (!settlement) throw new NotFoundError("Settlement not found");
    if (settlement.status !== "PENDING") {
      throw new ValidationError(`Settlement da ${settlement.status === "SETTLED" ? "duoc quyet toan" : "bi huy"}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const settled = await tx.settlement.update({
        where: { id: settlementId },
        data: { status: "SETTLED", settledAt: new Date() },
        include: { partner: true }
      });

      await tx.partnerWallet.update({
        where: { partnerId: settlement.partnerId },
        data: {
          pendingBalance: { decrement: settlement.netAmount },
          availableBalance: { increment: settlement.netAmount }
        }
      });

      await recordAdminAction(actorId, "SETTLEMENT_COMPLETED", "SETTLEMENT", settlementId, {
        bookingId: settlement.bookingId,
        netAmount: settlement.netAmount,
        partnerId: settlement.partnerId
      });

      return settled;
    });

    realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, updated);
    realtimeService.toAdmin(realtimeEvents.settlementUpdated, updated);
    return updated;
  },

  /**
   * Huỷ settlement (booking cancelled, refund, etc.)
   */
  async cancel(settlementId: string, actorId: string, reason?: string) {
    const settlement = await settlementRepository.findById(settlementId);
    if (!settlement) throw new NotFoundError("Settlement not found");
    if (settlement.status === "SETTLED") {
      throw new ValidationError("Khong the huy settlement da quyet toan");
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const updated = await tx.settlement.update({
        where: { id: settlementId },
        data: { status: "CANCELLED" }
      });

      if (settlement.status === "PENDING") {
        await tx.partnerWallet.update({
          where: { partnerId: settlement.partnerId },
          data: { pendingBalance: { decrement: settlement.netAmount } }
        });
      }

      await recordAdminAction(actorId, "SETTLEMENT_CANCELLED", "SETTLEMENT", settlementId, {
        bookingId: settlement.bookingId,
        reason,
        netAmount: settlement.netAmount
      });

      return updated;
    });

    realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, cancelled);
    return cancelled;
  },

  async getById(id: string) {
    const s = await settlementRepository.findById(id);
    if (!s) throw new NotFoundError("Settlement not found");
    return {
      ...s,
      grossAmount: toNum(s.grossAmount),
      voucherDiscount: toNum(s.voucherDiscount),
      platformDiscount: toNum(s.platformDiscount),
      partnerDiscount: toNum(s.partnerDiscount),
      commissionAmount: toNum(s.commissionAmount),
      serviceFee: toNum(s.serviceFee),
      netAmount: toNum(s.netAmount)
    };
  },

  async listForPartner(partnerId: string, page: number, limit: number) {
    const { items, total } = await settlementRepository.listByPartner(partnerId, page, limit);
    return {
      items: items.map((s) => ({
        ...s,
        grossAmount: toNum(s.grossAmount),
        voucherDiscount: toNum(s.voucherDiscount),
        platformDiscount: toNum(s.platformDiscount),
        partnerDiscount: toNum(s.partnerDiscount),
        commissionAmount: toNum(s.commissionAmount),
        serviceFee: toNum(s.serviceFee),
        netAmount: toNum(s.netAmount)
      })),
      total
    };
  },

  async listAll(filters: {
    page: number;
    limit: number;
    partnerId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const { items, total } = await settlementRepository.listAll({
      page: filters.page,
      limit: filters.limit,
      partnerId: filters.partnerId,
      status: filters.status,
      fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
      toDate: filters.toDate ? new Date(filters.toDate) : undefined
    });
    return {
      items: items.map((s: any) => ({
        ...s,
        grossAmount: toNum(s.grossAmount),
        voucherDiscount: toNum(s.voucherDiscount),
        platformDiscount: toNum(s.platformDiscount),
        partnerDiscount: toNum(s.partnerDiscount),
        commissionAmount: toNum(s.commissionAmount),
        serviceFee: toNum(s.serviceFee),
        netAmount: toNum(s.netAmount)
      })),
      total
    };
  },

  async summaryForAdmin(filters: { partnerId?: string; status?: string }) {
    return settlementRepository.summary(filters);
  }
};
