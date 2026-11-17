import type { Booking, PartnerProfile } from "@prisma/client";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { vietnamNow } from "../../shared/utils/time.js";
import { commissionRepository } from "./commission.repository.js";
import {
  BOOKING_DEPOSIT_KEY,
  DEFAULT_COMMISSION_KEY,
  type CommissionSummary,
  type DbClient
} from "./commission.types.js";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function roundCommission(gross: number, rate: number) { return Math.round(gross * rate) / 100; }

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function validateRate(rate: number) {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new ValidationError("Ty le hoa hong phai nam trong khoang 0 den 100");
  }
  return Math.round(rate * 100) / 100;
}

/** A calendar month in Vietnam time: it starts at 00:00 on the 1st in Vietnam (17:00 the day before in UTC). */
export function monthRange(month?: string) {
  const value = month ?? vietnamNow().date.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new ValidationError("Thang phai co dinh dang YYYY-MM");
  }
  const [year, monthNumber] = value.split("-").map(Number);
  return {
    month: value,
    from: new Date(Date.UTC(year, monthNumber - 1, 1) - VIETNAM_OFFSET_MS),
    to: new Date(Date.UTC(year, monthNumber, 1) - VIETNAM_OFFSET_MS)
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
  /** The default rate with who it applies to: the partners without a rate of their own. */
  async defaultRate() {
    const [setting, coverage] = await Promise.all([commissionRepository.setting(DEFAULT_COMMISSION_KEY), commissionRepository.rateCoverage()]);
    return {
      rate: asNumber(setting?.numericValue ?? 10),
      partnersUsingDefault: coverage.usingDefault,
      overrides: coverage.overrides.map((partner) => ({ partnerId: partner.id, businessName: partner.businessName, rate: asNumber(partner.commissionRate) }))
    };
  },

  rateHistory() {
    return commissionRepository.rateHistory();
  },

  async updateDefaultRate(rate: number, db?: DbClient) {
    const normalized = validateRate(rate);
    const setting = await commissionRepository.upsertSetting(
      DEFAULT_COMMISSION_KEY,
      normalized,
      "Default platform commission percentage",
      db
    );
    return { rate: asNumber(setting.numericValue) };
  },

  async depositRate(db?: DbClient) {
    const setting = await commissionRepository.setting(BOOKING_DEPOSIT_KEY, db);
    return validateRate(asNumber(setting?.numericValue ?? 50));
  },

  async partnerRate(partnerId: string, db?: DbClient) {
    const [partner, defaultSetting] = await Promise.all([
      commissionRepository.partner(partnerId, db),
      commissionRepository.setting(DEFAULT_COMMISSION_KEY, db)
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

  /** Within the caller's transaction when given, read back through it so the new rate shows before it commits. */
  async updatePartnerRate(partnerId: string, rate: number | null, db?: DbClient) {
    if (!(await commissionRepository.partner(partnerId, db))) {
      throw new NotFoundError("Khong tim thay doi tac");
    }
    const partner = await commissionRepository.setPartnerRate(
      partnerId,
      rate === null ? null : validateRate(rate),
      db
    );
    return this.partnerRate(partner.id, db);
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
    db: DbClient,
    invoiceTotal?: number
  ) {
    const existing = await commissionRepository.earningByBooking(booking.id, db);
    if (existing) {
      // The invoice grew since the earning was written (an extension, a platform-funded voucher, a corrected
      // no-show): record the difference as an adjustment at the earning's rate.
      if (invoiceTotal !== undefined) {
        const extra = Math.round((invoiceTotal - (await commissionRepository.recordedEarningGross(booking.id, db))) * 100) / 100;
        if (extra > 0) {
          const rate = asNumber(existing.commissionRate);
          const commissionAmount = roundCommission(extra, rate);
          return commissionRepository.createAdjustment(
            {
              bookingId: booking.id,
              partnerId: existing.partnerId,
              eventType,
              grossAmount: extra,
              commissionRate: rate,
              commissionAmount,
              netAmount: Math.round((extra - commissionAmount) * 100) / 100,
              originalTransactionId: existing.id
            },
            db
          );
        }
      }
      return existing;
    }

    const grossAmount =
      invoiceTotal ?? (eventType === "NO_SHOW" ? asNumber(booking.depositAmount) : asNumber(booking.totalPrice));
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
    const { totals, perPartner, partnerNames } = await commissionRepository.reportAggregate(
      range.from,
      range.to
    );

    return {
      month: range.month,
      summary: {
        grossAmount: asNumber(totals._sum.grossAmount),
        commissionAmount: asNumber(totals._sum.commissionAmount),
        netAmount: asNumber(totals._sum.netAmount),
        transactionCount: totals._count
      },
      partners: perPartner
        .map((row) => ({
          partnerId: row.partnerId,
          businessName: partnerNames.get(row.partnerId) ?? "",
          grossAmount: asNumber(row._sum.grossAmount),
          commissionAmount: asNumber(row._sum.commissionAmount),
          netAmount: asNumber(row._sum.netAmount),
          transactionCount: row._count
        }))
        .sort((a, b) => b.commissionAmount - a.commissionAmount)
    };
  }
};
