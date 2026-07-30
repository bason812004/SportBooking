import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateVoucherDiscount } from "../../shared/utils/businessRules.js";
import { durationHours } from "../../shared/utils/time.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { courtRepository } from "../courts/court.repository.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { voucherRepository, type VoucherRow } from "./voucher.repository.js";
import {
  evaluateVoucherEligibility,
  translateReason,
  type EligibilityContext,
  type EligibilityReasonCode,
  type VoucherLike
} from "./voucher.eligibility.js";

export const voucherService = {
  list() {
    return voucherRepository.listActive();
  },

  async detail(id: string) {
    const [voucher] = await voucherRepository.findActiveById(id);
    if (!voucher) throw new NotFoundError("Khong tim thay voucher");
    return voucher;
  },

  async trackClick(id: string) {
    const clicked = await voucherRepository.incrementClickCount(id);
    if (!clicked || clicked.length === 0) throw new NotFoundError("Khong tim thay voucher");
    return clicked[0];
  },

  async claim(userId: string, voucherId: string) {
    const voucher = await voucherRepository.findActiveVoucher(voucherId);
    if (!voucher) throw new NotFoundError("Khong tim thay voucher kha dung");
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
      throw new ValidationError("Voucher da het luot su dung", { voucher: ["usage_limit"] });
    }
    if (await voucherRepository.userVoucher(userId, voucherId)) {
      throw new ConflictError("Ban da nhan voucher nay", "VOUCHER_ALREADY_CLAIMED");
    }
    const claimed = await voucherRepository.claim(userId, voucherId);
    await trackEvent({
      userId,
      partnerId: voucher.partnerId,
      eventType: "VOUCHER_CLAIMED",
      entityType: "VOUCHER",
      entityId: voucherId
    });
    realtimeService.toPublic(realtimeEvents.voucherClaimed, { id: voucherId, usedCount: voucher.usedCount });
    return claimed;
  },

  async claimAllPlatformVouchers(userId: string) {
    const platformVouchers = await voucherRepository.listActivePlatform();
    const claimed: Array<{ id: string; code: string; title: string }> = [];
    const skipped: Array<{ id: string; code: string; reason: string }> = [];
    for (const v of platformVouchers) {
      try {
        if (v.usageLimit != null && v.usedCount >= v.usageLimit) {
          skipped.push({ id: v.id, code: v.code, reason: "het_luot" });
          continue;
        }
        if (await voucherRepository.userVoucher(userId, v.id)) {
          skipped.push({ id: v.id, code: v.code, reason: "da_nhan" });
          continue;
        }
        const c = await voucherRepository.claim(userId, v.id);
        claimed.push({ id: c.voucherId ?? v.id, code: v.code, title: v.title });
        await trackEvent({ userId, partnerId: null, eventType: "VOUCHER_CLAIMED", entityType: "VOUCHER", entityId: v.id });
      } catch {
        skipped.push({ id: v.id, code: v.code, reason: "loi" });
      }
    }
    return { claimed, skipped };
  },

  listForUser(userId: string) {
    return voucherRepository.listForUser(userId);
  },

  /**
   * Apply voucher to a booking subtotal.
   * Validates full eligibility (status/date/day/time/holiday/min-amount).
   */
  async apply(input: { userId?: string; voucherId?: string; code?: string; courtId: string; subtotal: number; bookingDate?: string; startTime?: string; endTime?: string }) {
    const [voucher] = await voucherRepository.findUsableFull({
      voucherId: input.voucherId,
      code: input.code,
      courtId: input.courtId
    });
    if (!voucher) throw new NotFoundError("Voucher khong hop le");

    const eligibility = await this.checkOne(voucher, {
      bookingDate: input.bookingDate ?? new Date().toISOString().slice(0, 10),
      startTime: input.startTime ?? "00:00",
      endTime: input.endTime ?? "23:59",
      courtId: input.courtId,
      subtotal: input.subtotal
    });
    if (!eligibility.eligible) {
      throw new ValidationError(eligibility.message, { eligibility: [eligibility.code] });
    }

    const discount = calculateVoucherDiscount({
      subtotal: input.subtotal,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      maxDiscountAmount: voucher.maxDiscountAmount == null ? null : Number(voucher.maxDiscountAmount),
      minBookingAmount: Number(voucher.minBookingAmount)
    });

    await trackEvent({
      userId: input.userId,
      partnerId: voucher.partner?.id ?? null,
      eventType: "VOUCHER_APPLIED",
      entityType: "VOUCHER",
      entityId: voucher.id,
      metadataJson: { courtId: input.courtId, subtotal: input.subtotal, discountAmount: discount.discountAmount }
    });

    return {
      voucherId: voucher.id,
      code: voucher.code,
      fundedBy: voucher.fundedBy,
      partnerFundingPercent: Number(voucher.partnerFundingPercent),
      platformFundingPercent: Number(voucher.platformFundingPercent),
      ...discount,
      ...eligibility
    };
  },

  async checkOne(voucher: VoucherLike, ctx: EligibilityContext) {
    const systemHolidays = (await voucherRepository.isHoliday(ctx.bookingDate)).map(() => ctx.bookingDate);
    return evaluateVoucherEligibility(voucher, { ...ctx, systemHolidays });
  },

  /**
   * Live eligibility check for an entire voucher pool against a chosen
   * court / date / time slot. Used by the booking page to filter what to
   * display to the user.
   */
  async checkEligibilityForBooking(input: {
    courtId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    subtotal: number;
    lang?: "vi" | "en";
    userId?: string;
  }) {
    const vouchers = await voucherRepository.listActive();
    const result = [];
    for (const v of vouchers) {
      const eligibility = await this.checkOne(v, {
        courtId: input.courtId,
        bookingDate: input.bookingDate,
        startTime: input.startTime,
        endTime: input.endTime,
        subtotal: input.subtotal
      });
      result.push({
        voucher: this.serializeForEligibility(v),
        eligible: eligibility.eligible,
        reason: eligibility.eligible ? null : { code: eligibility.code, message: eligibility.message },
        discountAmount: eligibility.eligible ? eligibility.discountAmount : 0,
        finalAmount: eligibility.eligible ? eligibility.finalAmount : input.subtotal,
        priorityScore: this.computePriorityScore(
          this.serializeForEligibility(v),
          eligibility.eligible ? eligibility.discountAmount : 0,
          input.userId
        )
      });
    }

    // Separate into available / unavailable
    const available = result.filter(r => r.eligible);
    const unavailable = result.filter(r => !r.eligible);

    // Sort available: highest discount first, then soonest expiry, then platform before partner
    available.sort((a, b) => {
      if (b.discountAmount !== a.discountAmount) return b.discountAmount - a.discountAmount;
      const aExpiry = new Date(a.voucher.endDate).getTime();
      const bExpiry = new Date(b.voucher.endDate).getTime();
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      return (b.voucher.fundedBy === "PLATFORM" ? 1 : 0) - (a.voucher.fundedBy === "PLATFORM" ? 1 : 0);
    });

    // Sort unavailable: most impactful reason first
    unavailable.sort((a, b) => {
      const aCode = a.reason?.code ?? "";
      const bCode = b.reason?.code ?? "";
      const reasonOrder = [
        "VOUCHER_EXPIRED", "VOUCHER_USAGE_LIMIT_REACHED",
        "VOUCHER_MIN_BOOKING_AMOUNT", "VOUCHER_WRONG_DAY",
        "VOUCHER_WRONG_TIME", "VOUCHER_WRONG_COURT",
        "VOUCHER_NOT_HOLIDAY", "VOUCHER_NOT_STARTED", "VOUCHER_APPLICABLE_END_DATE",
        "VOUCHER_APPLICABLE_START_DATE", "VOUCHER_INACTIVE", "VOUCHER_NOT_FOUND"
      ];
      const aIdx = reasonOrder.indexOf(aCode);
      const bIdx = reasonOrder.indexOf(bCode);
      return aIdx - bIdx;
    });

    return {
      bestVoucher: available[0] ?? null,
      availableVouchers: available,
      unavailableVouchers: unavailable
    };
  },

  /**
   * Priority score for sorting vouchers — higher = more valuable.
   * Factors: discount amount, funding source, court specificity, expiry urgency.
   */
  computePriorityScore(
    voucher: ReturnType<typeof this.serializeForEligibility>,
    estimatedDiscount: number,
    _userId?: string
  ): number {
    // Normalise discount to a 0-40 point scale (max 400k VND = 40 pts)
    const discountPoints = Math.min(40, Math.round((estimatedDiscount / 400_000) * 40));
    // Platform vouchers are best for users (no partner cost)
    const fundingPoints = voucher.fundedBy === "PLATFORM" ? 8 : voucher.fundedBy === "SHARED" ? 5 : 0;
    // Court-specific vouchers are more relevant to the current booking
    const scopePoints = voucher.courtId ? 3 : 0;
    // Deprioritise vouchers expiring within 3 days
    const daysLeft = Math.ceil((new Date(voucher.endDate).getTime() - Date.now()) / 86_400_000);
    const expiryPoints = daysLeft <= 3 ? -5 : 0;
    return 50 + discountPoints + fundingPoints + scopePoints + expiryPoints;
  },

  serializeForEligibility(v: VoucherRow) {
    return {
      id: v.id,
      code: v.code,
      title: v.title,
      description: v.description,
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      maxDiscountAmount: v.maxDiscountAmount == null ? null : Number(v.maxDiscountAmount),
      minBookingAmount: Number(v.minBookingAmount),
      usageLimit: v.usageLimit,
      usedCount: v.usedCount,
      clickCount: v.clickCount,
      startDate: v.startDate,
      endDate: v.endDate,
      status: v.status,
      fundedBy: v.fundedBy,
      partnerFundingPercent: Number(v.partnerFundingPercent),
      platformFundingPercent: Number(v.platformFundingPercent),
      applicableDays: v.applicableDays,
      startTime: v.startTime,
      endTime: v.endTime,
      holidayOnly: v.holidayOnly,
      holidayDates: v.holidayDates,
      applicableStartDate: v.applicableStartDate,
      applicableEndDate: v.applicableEndDate,
      partner: v.partner,
      court: v.court,
      courtId: v.court?.id ?? null
    };
  },

  /**
   * Validate voucher for a not-yet-created booking. Backend computes
   * subtotal (court + services), evaluates eligibility and returns
   * the discount breakdown plus i18n message.
   */
  async validate(input: {
    userId?: string;
    voucherId?: string;
    code?: string;
    courtId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    services?: Array<{ serviceId: string; quantity: number }>;
  }) {
    if (!input.code && !input.voucherId) {
      throw new ValidationError("Vui long cung cap ma voucher hoac id voucher");
    }

    const [voucher] = await voucherRepository.findUsableFull({
      voucherId: input.voucherId,
      code: input.code,
      courtId: input.courtId
    });
    if (!voucher) throw new NotFoundError("Ma voucher khong hop le hoac da het han");

    if (input.startTime >= input.endTime) {
      throw new ValidationError("Khung gio khong hop le");
    }

    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("San khong ton tai hoac chua duoc duyet");

    const dynamicPrice = await dynamicPricingService.calculate(input.courtId, {
      date: input.bookingDate,
      startTime: input.startTime,
      endTime: input.endTime
    });
    const hours = durationHours(input.startTime, input.endTime);
    const courtTotal = dynamicPrice.finalPrice * hours;

    let servicesTotal = 0;
    const serviceIds = (input.services ?? []).map((s) => s.serviceId);
    if (serviceIds.length) {
      const services = await courtRepository.servicesByIds(serviceIds);
      const serviceMap = new Map(services.map((s) => [s.id, s]));
      for (const line of input.services ?? []) {
        const service = serviceMap.get(line.serviceId);
        if (!service) throw new ValidationError(`Dich vu ${line.serviceId} khong ton tai`);
        if (service.status !== "ACTIVE") throw new ValidationError(`Dich vu ${service.name} khong kha dung`);
        servicesTotal += Number(service.price) * line.quantity;
      }
    }

    const subtotal = Math.round(courtTotal + servicesTotal);
    const eligibility = await this.checkOne(voucher, {
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime: input.endTime,
      courtId: input.courtId,
      subtotal
    });
    if (!eligibility.eligible) {
      throw new ValidationError(eligibility.message, { eligibility: [eligibility.code] });
    }

    const discountAmount = eligibility.discountAmount;
    const finalTotal = eligibility.finalAmount;
    const message =
      voucher.discountType === "PERCENTAGE"
        ? `Giam ${voucher.discountValue}% (toi da ${voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount).toLocaleString("vi-VN") + " VND" : "khong gioi han"})`
        : `Giam ${Number(voucher.discountValue).toLocaleString("vi-VN")} VND`;

    await trackEvent({
      userId: input.userId,
      partnerId: voucher.partner?.id ?? null,
      eventType: "VOUCHER_APPLIED",
      entityType: "VOUCHER",
      entityId: voucher.id,
      metadataJson: { courtId: input.courtId, subtotal, discountAmount, validateOnly: true }
    });

    return {
      voucher: this.serializeForEligibility(voucher),
      courtSubtotal: Math.round(courtTotal),
      servicesSubtotal: Math.round(servicesTotal),
      subtotal,
      discountAmount,
      finalTotal,
      platformShare: eligibility.platformShare,
      partnerShare: eligibility.partnerShare,
      message
    };
  },

  async listForPartner(partnerId: string) {
    return voucherRepository.listForPartner(partnerId);
  },

  async detailForPartner(partnerId: string, id: string) {
    const [voucher] = await voucherRepository.findForPartner(id, partnerId);
    if (!voucher) throw new NotFoundError("Khong tim thay voucher cua ban");
    return voucher;
  },

  async createForPartner(partnerId: string, input: PartnerVoucherInput) {
    const normalized = await validatePartnerVoucher(partnerId, input);
    const created = await voucherRepository.createForPartner(partnerId, normalized);
    return this.detailForPartner(partnerId, created.id);
  },

  async updateForPartner(partnerId: string, id: string, input: PartnerVoucherInput) {
    const current = await this.detailForPartner(partnerId, id);
    if (current.status !== "DRAFT") {
      throw new ValidationError("Chi co the sua voucher dang nhap");
    }
    const normalized = await validatePartnerVoucher(partnerId, input, id);
    await voucherRepository.updateForPartner(id, partnerId, normalized);
    return this.detailForPartner(partnerId, id);
  },

  async activateForPartner(partnerId: string, id: string) {
    const voucher = await this.detailForPartner(partnerId, id);
    if (!["DRAFT", "DISABLED"].includes(voucher.status)) {
      throw new ValidationError("Voucher khong the kich hoat");
    }
    if (new Date(voucher.endDate) <= new Date()) {
      throw new ValidationError("Voucher da het han");
    }
    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      throw new ValidationError("Voucher da het luot su dung");
    }
    await voucherRepository.setStatus(id, partnerId, ["DRAFT", "DISABLED"], "ACTIVE");
    const activated = await this.detailForPartner(partnerId, id);
    const [publicVoucher] = await voucherRepository.findActiveById(id);
    realtimeService.toPublic(realtimeEvents.voucherNew, publicVoucher ?? activated);
    return activated;
  },

  async disableForPartner(partnerId: string, id: string) {
    const voucher = await this.detailForPartner(partnerId, id);
    if (voucher.status !== "ACTIVE") throw new ValidationError("Voucher khong dang hoat dong");
    await voucherRepository.setStatus(id, partnerId, ["ACTIVE"], "DISABLED");
    realtimeService.toPublic(realtimeEvents.voucherNew, { id, status: "DISABLED" });
    return this.detailForPartner(partnerId, id);
  },

  async deleteForPartner(partnerId: string, id: string) {
    await this.detailForPartner(partnerId, id);
    const deleted = await voucherRepository.deleteDraft(id, partnerId);
    if (!deleted) throw new ValidationError("Chi co the xoa voucher nhap chua duoc su dung");
    return { id };
  },

  async listPartner(userId: string) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return this.listForPartner(profile.id);
  },

  async createPartner(userId: string, input: PartnerVoucherInput) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return this.createForPartner(profile.id, input);
  },

  async updatePartner(userId: string, id: string, input: PartnerVoucherInput) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return this.updateForPartner(profile.id, id, input);
  },

  async deletePartner(userId: string, id: string) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return this.deleteForPartner(profile.id, id);
  },

  async setPartnerStatus(userId: string, id: string, status: "ACTIVE" | "DISABLED") {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
    return status === "ACTIVE" ? this.activateForPartner(profile.id, id) : this.disableForPartner(profile.id, id);
  }
};

type PartnerVoucherInput = {
  courtId?: string | null;
  code: string;
  title: string;
  description?: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number | null;
  minBookingAmount: number;
  usageLimit?: number | null;
  startDate: string;
  endDate: string;
  applicableDays?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  holidayOnly?: boolean;
  holidayDates?: string[] | null;
  applicableStartDate?: string | null;
  applicableEndDate?: string | null;
};

async function validatePartnerVoucher(partnerId: string, input: PartnerVoucherInput, excludeId?: string) {
  const code = input.code.trim().toUpperCase();
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (startDate >= endDate) throw new ValidationError("Ngay bat dau phai truoc ngay ket thuc");
  if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
    throw new ValidationError("Voucher phan tram khong duoc vuot qua 100%");
  }
  if (input.courtId && !(await voucherRepository.courtBelongsToPartner(input.courtId, partnerId))) {
    throw new ValidationError("San ap dung khong thuoc doi tac");
  }
  const [duplicate] = await voucherRepository.codeExists(code, excludeId);
  if (duplicate.exists) throw new ConflictError("Ma voucher da ton tai", "VOUCHER_CODE_EXISTS");

  // Validate time window if both supplied
  if (input.startTime && input.endTime && input.startTime >= input.endTime) {
    throw new ValidationError("Gio bat dau phai truoc gio ket thuc");
  }

  return {
    ...input,
    code,
    courtId: input.courtId || null,
    maxDiscountAmount: input.discountType === "PERCENTAGE" ? input.maxDiscountAmount ?? null : null,
    usageLimit: input.usageLimit ?? null,
    startDate,
    endDate,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    holidayOnly: input.holidayOnly ?? false,
    holidayDates: input.holidayDates ?? null,
    applicableStartDate: input.applicableStartDate ? new Date(input.applicableStartDate) : null,
    applicableEndDate: input.applicableEndDate ? new Date(input.applicableEndDate) : null
  };
}

export type { EligibilityReasonCode };
export { translateReason };