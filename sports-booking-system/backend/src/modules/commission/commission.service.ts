import type { Booking, PartnerProfile } from "@prisma/client";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { commissionRepository } from "./commission.repository.js";
import {
  BOOKING_DEPOSIT_KEY,
  DEFAULT_COMMISSION_KEY,
  type CommissionSummary,
  type DbClient
} from "./commission.types.js";

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function validateRate(rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new ValidationError("Ty le hoa hong phai nam trong khoang 0 den 100");
  }
  return Math.round(rate * 100) / 100;
}

export function monthRange(month?: string) {
  const value = month ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ValidationError("Thang phai co dinh dang YYYY-MM");
  }
  const [year, monthNumber] = value.split("-").map(Number);
  return {
    month: value,
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1))
  };
}

function summarize(
  transactions: Array<{
    grossAmount: unknown;
    commissionAmount: unknown;
    netAmount: unknown;
  }>
): CommissionSummary {
  return transactions.reduce<CommissionSummary>(
    (total, item) => ({
      grossAmount: total.grossAmount + asNumber(item.grossAmount),
      commissionAmount: total.commissionAmount + asNumber(item.commissionAmount),
      netAmount: total.netAmount + asNumber(item.netAmount),
      transactionCount: total.transactionCount + 1
    }),
    { grossAmount: 0, commissionAmount: 0, netAmount: 0, transactionCount: 0 }
  );
}

export const commissionService = {
  async defaultRate() {
    const setting = await commissionRepository.setting(DEFAULT_COMMISSION_KEY);
    return { rate: asNumber(setting?.numericValue ?? 10) };
  },

  async updateDefaultRate(rate: number) {
    const normalized = validateRate(rate);
    const setting = await commissionRepository.upsertSetting(
      DEFAULT_COMMISSION_KEY,
      normalized,
      "Default platform commission percentage"
    );
    return { rate: asNumber(setting.numericValue) };
  },

  async depositRate(db?: DbClient) {
    const setting = await commissionRepository.setting(BOOKING_DEPOSIT_KEY, db);
    return validateRate(asNumber(setting?.numericValue ?? 50));
  },

  async partnerRate(partnerId: string) {
    const [partner, defaultSetting] = await Promise.all([
      commissionRepository.partner(partnerId),
      commissionRepository.setting(DEFAULT_COMMISSION_KEY)
    ]);
    if (!partner) throw new NotFoundError("Khong tim thay doi tac");
    const defaultRate = asNumber(defaultSetting?.numericValue ?? 10);
    return {
      partnerId: partner.id,
      businessName: partner.businessName,
      overrideRate: partner.commissionRate === null ? null : asNumber(partner.commissionRate),
      defaultRate,
      effectiveRate: partner.commissionRate === null ? defaultRate : asNumber(partner.commissionRate)
    };
  },

  async updatePartnerRate(partnerId: string, rate: number | null) {
    if (!(await commissionRepository.partner(partnerId))) {
      throw new NotFoundError("Khong tim thay doi tac");
    }
    const partner = await commissionRepository.setPartnerRate(
      partnerId,
      rate === null ? null : validateRate(rate)
    );
    return this.partnerRate(partner.id);
  },

  async effectiveRate(
    partner: Pick<PartnerProfile, "commissionRate">,
    db: DbClient
  ) {
    if (partner.commissionRate !== null) return asNumber(partner.commissionRate);
    const setting = await commissionRepository.setting(DEFAULT_COMMISSION_KEY, db);
    return asNumber(setting?.numericValue ?? 10);
  },

  async createEarning(
    booking: Booking & {
      court: { partner: Pick<PartnerProfile, "id" | "commissionRate"> };
    },
    eventType: "COMPLETED" | "NO_SHOW",
    db: DbClient
  ) {
    const existing = await commissionRepository.earningByBooking(booking.id, db);
    if (existing) return existing;

    const grossAmount =
      eventType === "NO_SHOW" ? asNumber(booking.depositAmount) : asNumber(booking.totalPrice);
    const commissionRate = await this.effectiveRate(booking.court.partner, db);
    const commissionAmount = Math.round(grossAmount * (commissionRate / 100) * 100) / 100;
    const netAmount = Math.round((grossAmount - commissionAmount) * 100) / 100;

    return commissionRepository.createEarning(
      {
        bookingId: booking.id,
        partnerId: booking.court.partner.id,
        eventType,
        grossAmount,
        commissionRate,
        commissionAmount,
        netAmount
      },
      db
    );
  },

  async adminReport(month?: string) {
    const range = monthRange(month);
    const transactions = await commissionRepository.report(range.from, range.to);
    const partners = new Map<
      string,
      {
        partnerId: string;
        businessName: string;
        grossAmount: number;
        commissionAmount: number;
        netAmount: number;
        transactionCount: number;
      }
    >();

    for (const item of transactions) {
      const current = partners.get(item.partnerId) ?? {
        partnerId: item.partnerId,
        businessName: item.partner.businessName,
        grossAmount: 0,
        commissionAmount: 0,
        netAmount: 0,
        transactionCount: 0
      };
      current.grossAmount += asNumber(item.grossAmount);
      current.commissionAmount += asNumber(item.commissionAmount);
      current.netAmount += asNumber(item.netAmount);
      current.transactionCount += 1;
      partners.set(item.partnerId, current);
    }

    return {
      month: range.month,
      summary: summarize(transactions),
      partners: [...partners.values()].sort(
        (a, b) => b.commissionAmount - a.commissionAmount
      )
    };
  },

  async partnerReport(partnerId: string, month?: string) {
    const range = monthRange(month);
    const transactions = await commissionRepository.partnerReport(
      partnerId,
      range.from,
      range.to
    );
    return {
      month: range.month,
      summary: summarize(transactions),
      items: transactions.map((item) => ({
        id: item.id,
        bookingId: item.bookingId,
        bookingCode: item.booking.bookingCode,
        bookingDate: item.booking.bookingDate,
        court: item.booking.court,
        eventType: item.eventType,
        transactionType: item.transactionType,
        grossAmount: asNumber(item.grossAmount),
        commissionRate: asNumber(item.commissionRate),
        commissionAmount: asNumber(item.commissionAmount),
        netAmount: asNumber(item.netAmount),
        createdAt: item.createdAt
      }))
    };
  }
};
