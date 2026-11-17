import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateVoucherDiscount } from "../../shared/utils/businessRules.js";
import { durationHours } from "../../shared/utils/time.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { courtRepository } from "../courts/court.repository.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { voucherRepository, type VoucherRow } from "./voucher.repository.js";
import { activationProblem, normalizeVoucherTerms, runningVoucherChanges, type VoucherTermsInput } from "./voucher.terms.js";
import {
  evaluateVoucherEligibility,
  translateReason,
  type EligibilityContext,
  type EligibilityReasonCode,
  type VoucherLike
} from "./voucher.eligibility.js";

let activeVouchersCache: VoucherRow[] | null = null;
let activeVouchersCacheTime = 0;

export const voucherService = {
  async list() {
    const now = Date.now();
    if (activeVouchersCache && now - activeVouchersCacheTime < 30000) {
      return activeVouchersCache;
    }
    const data = await voucherRepository.listActive();
    activeVouchersCache = data;
    activeVouchersCacheTime = now;
    return data;
  },

  invalidateListCache() {
    activeVouchersCache = null;
  },

  async detail(id: string) {
    const [voucher] = await voucherRepository.findActiveById(id);
    if (!voucher) throw new NotFoundError("Không tìm thấy voucher");
    return voucher;
  },

  async trackClick(id: string) {
    const clicked = await voucherRepository.incrementClickCount(id);
    if (!clicked || clicked.length === 0) throw new NotFoundError("Không tìm thấy voucher");
    return clicked[0];
  },

  async claim(userId: string, voucherId: string) {
    const voucher = await voucherRepository.findActiveVoucher(voucherId);
    if (!voucher) throw new NotFoundError("Không tìm thấy voucher khả dụng");
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
      throw new ValidationError("Voucher đã hết lượt sử dụng", { voucher: ["usage_limit"] });
    }
    if (await voucherRepository.userVoucher(userId, voucherId)) {
      throw new ConflictError("Bạn đã nhận voucher này", "VOUCHER_ALREADY_CLAIMED");
    }
    const claimed = await voucherRepository.claim(userId, voucherId);
    void trackEvent({
      userId,
      partnerId: voucher.partnerId,
      eventType: "VOUCHER_CLAIMED",
      entityType: "VOUCHER",
      entityId: voucherId
    }).catch(() => undefined);
    realtimeService.toPublic(realtimeEvents.voucherClaimed, { id: voucherId, usedCount: voucher.usedCount });
    return claimed;
  },

  async claimAllPlatformVouchers(userId: string) {
    const [platformVouchers, claimedVoucherIds] = await Promise.all([
      voucherRepository.listActivePlatform(),
      voucherRepository.getUserClaimedVoucherIds(userId)
    ]);

    const toClaim: VoucherRow[] = [];
    const skipped: Array<{ id: string; code: string; reason: string }> = [];

    for (const v of platformVouchers) {
      if (v.usageLimit != null && v.usedCount >= v.usageLimit) {
        skipped.push({ id: v.id, code: v.code, reason: "het_luot" });
        continue;
      }
      if (claimedVoucherIds.has(v.id)) {
        skipped.push({ id: v.id, code: v.code, reason: "da_nhan" });
        continue;
      }
      toClaim.push(v);
    }

    const claimed: Array<{ id: string; code: string; title: string }> = [];
    if (toClaim.length > 0) {
      const batchResult = await voucherRepository.claimBatch(
        userId,
        toClaim.map((v) => v.id)
      );
      const claimedSet = new Set(batchResult.map((r) => r.voucher_id));
      for (const v of toClaim) {
        if (claimedSet.has(v.id)) {
          claimed.push({ id: v.id, code: v.code, title: v.title });
        } else {
          skipped.push({ id: v.id, code: v.code, reason: "da_nhan" });
        }
      }
      void Promise.all(
        claimed.map((c) =>
          trackEvent({
            userId,
            partnerId: null,
            eventType: "VOUCHER_CLAIMED",
            entityType: "VOUCHER",
            entityId: c.id
          }).catch(() => undefined)
        )
      );
    }

    return {
      claimedCount: claimed.length,
      skippedCount: skipped.length,
      claimedVouchers: claimed,
      skippedVouchers: skipped
    };
  },

  async claimAllVouchers(userId: string) {
    const [vouchers, claimedVoucherIds] = await Promise.all([
      voucherRepository.listActive(),
      voucherRepository.getUserClaimedVoucherIds(userId)
    ]);
    const now = new Date();
    const toClaim: VoucherRow[] = [];
    const skipped: Array<{ id: string; code: string; reason: string }> = [];

    for (const v of vouchers) {
      if (v.status !== "ACTIVE") {
        skipped.push({ id: v.id, code: v.code, reason: "inactive" });
        continue;
      }
      if (new Date(v.endDate) < now || new Date(v.startDate) > now) {
        skipped.push({ id: v.id, code: v.code, reason: "expired_or_not_started" });
        continue;
      }
      if (v.usageLimit != null && v.usedCount >= v.usageLimit) {
        skipped.push({ id: v.id, code: v.code, reason: "het_luot" });
        continue;
      }
      if (claimedVoucherIds.has(v.id)) {
        skipped.push({ id: v.id, code: v.code, reason: "da_nhan" });
        continue;
      }
      toClaim.push(v);
    }

    const claimed: Array<{ id: string; code: string; title: string }> = [];
    if (toClaim.length > 0) {
      const batchResult = await voucherRepository.claimBatch(
        userId,
        toClaim.map((v) => v.id)
      );
      const claimedSet = new Set(batchResult.map((r) => r.voucher_id));
      for (const v of toClaim) {
        if (claimedSet.has(v.id)) {
          claimed.push({ id: v.id, code: v.code, title: v.title });
        } else {
          skipped.push({ id: v.id, code: v.code, reason: "da_nhan" });
        }
      }
      void Promise.all(
        claimed.map((c) =>
          trackEvent({
            userId,
            partnerId: null,
            eventType: "VOUCHER_CLAIMED",
            entityType: "VOUCHER",
            entityId: c.id
          }).catch(() => undefined)
        )
      );
    }

    return {
      claimedCount: claimed.length,
      skippedCount: skipped.length,
      claimedVouchers: claimed,
      skippedVouchers: skipped
    };
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
    if (!voucher) throw new NotFoundError("Voucher không hợp lệ");

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
    if (input.userId && (await voucherRepository.userHasLiveUse(input.userId, voucher.id))) {
      throw new ValidationError(translateReason("VOUCHER_ALREADY_USED"), { eligibility: ["VOUCHER_ALREADY_USED"] });
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

  async checkOne(voucher: VoucherLike | VoucherRow, ctx: EligibilityContext) {
    const systemHolidays = (await voucherRepository.isHoliday(ctx.bookingDate)).map(() => ctx.bookingDate);
    // Rows carry the owner and court as objects; the scope check needs their ids and the booked court's partner.
    const row = voucher as Partial<VoucherRow> & VoucherLike;
    const scoped: VoucherLike = {
      ...voucher,
      partnerId: row.partnerId !== undefined ? row.partnerId : row.partner?.id ?? null,
      courtId: row.courtId ?? row.court?.id ?? null
    } as VoucherLike;
    const courtPartnerId = ctx.courtPartnerId !== undefined ? ctx.courtPartnerId : await voucherRepository.courtPartnerId(ctx.courtId);
    return evaluateVoucherEligibility(scoped, { ...ctx, courtPartnerId, systemHolidays });
  },

  /**
   * The authoritative voucher check for a booking quote (checkout and chatbot go through it): status, dates,
   * usage, court/partner scope, day/time/holiday conditions for every booked slot, and one use per customer.
   */
  async evaluateForQuote(input: {
    voucherId?: string;
    code?: string;
    courtId: string;
    userId?: string;
    subtotal: number;
    slots: Array<{ date: string; startTime: string; endTime: string }>;
  }): Promise<{ eligible: true; voucherId: string; discountAmount: number } | { eligible: false; code: EligibilityReasonCode; message: string }> {
    const voucher = await voucherRepository.findForEligibility({ voucherId: input.voucherId, code: input.code });
    if (!voucher) return { eligible: false, code: "VOUCHER_NOT_FOUND", message: translateReason("VOUCHER_NOT_FOUND") };
    const courtPartnerId = await voucherRepository.courtPartnerId(input.courtId);

    let discountAmount = 0;
    for (const slot of input.slots) {
      const result = await this.checkOne(voucher, {
        bookingDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        courtId: input.courtId,
        courtPartnerId,
        subtotal: input.subtotal
      });
      if (!result.eligible) return { eligible: false, code: result.code, message: result.message };
      discountAmount = result.discountAmount;
    }
    if (input.userId && (await voucherRepository.userHasLiveUse(input.userId, voucher.id))) {
      return { eligible: false, code: "VOUCHER_ALREADY_USED", message: translateReason("VOUCHER_ALREADY_USED") };
    }
    return { eligible: true, voucherId: voucher.id, discountAmount };
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
    const courtPartnerId = await voucherRepository.courtPartnerId(input.courtId);
    const usedByUser = input.userId ? await voucherRepository.liveVoucherIdsForUser(input.userId) : new Set<string>();
    const result = [];
    for (const v of vouchers) {
      const checked = await this.checkOne(v, {
        courtId: input.courtId,
        courtPartnerId,
        bookingDate: input.bookingDate,
        startTime: input.startTime,
        endTime: input.endTime,
        subtotal: input.subtotal
      });
      const eligibility = checked.eligible && usedByUser.has(v.id)
        ? { eligible: false as const, code: "VOUCHER_ALREADY_USED" as const, message: translateReason("VOUCHER_ALREADY_USED", input.lang ?? "vi") }
        : checked;
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
      throw new ValidationError("Vui lòng cung cấp mã voucher hoặc id voucher");
    }

    const [voucher] = await voucherRepository.findUsableFull({
      voucherId: input.voucherId,
      code: input.code,
      courtId: input.courtId
    });
    if (!voucher) throw new NotFoundError("Mã voucher không hợp lệ hoặc đã hết hạn");

    if (input.startTime >= input.endTime) {
      throw new ValidationError("Khung giờ không hợp lệ");
    }

    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("Sân không tồn tại hoặc chưa được duyệt");

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
        if (!service) throw new ValidationError(`Dịch vụ ${line.serviceId} không tồn tại`);
        if (service.status !== "ACTIVE") throw new ValidationError(`Dịch vụ ${service.name} không khả dụng`);
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
    if (input.userId && (await voucherRepository.userHasLiveUse(input.userId, voucher.id))) {
      throw new ValidationError(translateReason("VOUCHER_ALREADY_USED"), { eligibility: ["VOUCHER_ALREADY_USED"] });
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
    if (!voucher) throw new NotFoundError("Không tìm thấy voucher của bạn");
    return voucher;
  },

  async createForPartner(partnerId: string, input: PartnerVoucherInput) {
    const terms = await partnerVoucherTerms(partnerId, input);
    const created = await withVoucherCodeGuard(() => voucherRepository.createForPartner(partnerId, terms));
    return this.detailForPartner(partnerId, created.id);
  },

  /** A draft can change entirely; an activated voucher only its wording, end date and usage limit. */
  async updateForPartner(partnerId: string, id: string, input: Partial<PartnerVoucherInput>) {
    const current = await this.detailForPartner(partnerId, id);
    if (current.status === "DRAFT") {
      const terms = await partnerVoucherTerms(partnerId, requireFullTerms(input), id);
      if (!(await withVoucherCodeGuard(() => voucherRepository.updateForPartner(id, partnerId, terms)))) {
        throw new ConflictError("Voucher vừa được kích hoạt, hãy tải lại trang");
      }
    } else {
      const changes = runningVoucherChanges(current, input);
      if (Object.keys(changes).length && !(await voucherRepository.updateRunning(id, changes, partnerId))) {
        throw new ConflictError("Voucher không còn sửa được, hãy tải lại trang");
      }
      this.invalidateListCache();
    }
    return this.detailForPartner(partnerId, id);
  },

  async activateForPartner(partnerId: string, id: string) {
    const voucher = await this.detailForPartner(partnerId, id);
    if (voucher.lockedByAdmin) {
      throw new ForbiddenError("Voucher đang bị quản trị viên tạm ngưng. Hãy liên hệ quản trị viên để được kích hoạt lại");
    }
    const problem = activationProblem(voucher);
    if (problem) throw new ValidationError(problem);
    // Moves only from the status just checked, so an admin's disable made meanwhile is not overridden.
    if (!(await voucherRepository.setStatus(id, partnerId, [voucher.status], "ACTIVE"))) {
      throw new ConflictError("Trạng thái voucher vừa thay đổi, hãy tải lại trang");
    }
    this.invalidateListCache();
    const activated = await this.detailForPartner(partnerId, id);
    const [publicVoucher] = await voucherRepository.findActiveById(id);
    realtimeService.toPublic(realtimeEvents.voucherNew, publicVoucher ?? activated);
    return activated;
  },

  async disableForPartner(partnerId: string, id: string) {
    const voucher = await this.detailForPartner(partnerId, id);
    if (voucher.status !== "ACTIVE") throw new ValidationError("Voucher không đang hoạt động");
    if (!(await voucherRepository.setStatus(id, partnerId, ["ACTIVE"], "DISABLED"))) {
      throw new ConflictError("Trạng thái voucher vừa thay đổi, hãy tải lại trang");
    }
    this.invalidateListCache();
    realtimeService.toPublic(realtimeEvents.voucherNew, { id, status: "DISABLED" });
    return this.detailForPartner(partnerId, id);
  },

  async deleteForPartner(partnerId: string, id: string) {
    await this.detailForPartner(partnerId, id);
    const deleted = await voucherRepository.deleteDraft(id, partnerId);
    if (!deleted) throw new ValidationError("Chỉ có thể xóa voucher nháp chưa được sử dụng");
    return { id };
  },

  async listPartner(userId: string) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tài khoản đối tác chưa có hồ sơ");
    return this.listForPartner(profile.id);
  },

  async detailPartner(userId: string, id: string) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tài khoản đối tác chưa có hồ sơ");
    return this.detailForPartner(profile.id, id);
  },

  async createPartner(userId: string, input: PartnerVoucherInput) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tài khoản đối tác chưa có hồ sơ");
    return this.createForPartner(profile.id, input);
  },

  async updatePartner(userId: string, id: string, input: Partial<PartnerVoucherInput>) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tài khoản đối tác chưa có hồ sơ");
    return this.updateForPartner(profile.id, id, input);
  },

  async deletePartner(userId: string, id: string) {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tài khoản đối tác chưa có hồ sơ");
    return this.deleteForPartner(profile.id, id);
  },

  async setPartnerStatus(userId: string, id: string, status: "ACTIVE" | "DISABLED") {
    const profile = await voucherRepository.partnerProfile(userId);
    if (!profile) throw new ForbiddenError("Tài khoản đối tác chưa có hồ sơ");
    return status === "ACTIVE" ? this.activateForPartner(profile.id, id) : this.disableForPartner(profile.id, id);
  }
};

type PartnerVoucherInput = VoucherTermsInput & { courtId?: string | null };

const REQUIRED_TERMS = ["code", "title", "discountType", "discountValue", "startDate", "endDate"] as const;

/** Editing a draft replaces all its terms, so the update must carry every required field. */
export function requireFullTerms<T extends Partial<VoucherTermsInput>>(input: T) {
  const missing = REQUIRED_TERMS.filter((field) => input[field] === undefined);
  if (missing.length) throw new ValidationError(`Thiếu thông tin voucher: ${missing.join(", ")}`);
  return input as T & VoucherTermsInput;
}

/** Throws when the code is taken by any other voucher (codes are unique across admin and partner vouchers). */
export async function assertVoucherCodeFree(code: string, excludeId?: string) {
  const [duplicate] = await voucherRepository.codeExists(code, excludeId);
  if (duplicate.exists) throw new ConflictError("Mã voucher đã tồn tại", "VOUCHER_CODE_EXISTS");
}

/** Runs a voucher write; a code saved by another request since assertVoucherCodeFree reads as the same conflict. */
export async function withVoucherCodeGuard<T>(write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    const failure = error as { code?: string; meta?: { code?: string }; message?: string };
    if (failure?.code === "P2002" || failure?.meta?.code === "23505" || /23505|unique constraint/i.test(failure?.message ?? "")) {
      throw new ConflictError("Mã voucher đã tồn tại", "VOUCHER_CODE_EXISTS");
    }
    throw error;
  }
}

async function partnerVoucherTerms(partnerId: string, input: PartnerVoucherInput, excludeId?: string) {
  const terms = normalizeVoucherTerms(input);
  if (input.courtId && !(await voucherRepository.courtBelongsToPartner(input.courtId, partnerId))) {
    throw new ValidationError("Sân áp dụng không thuộc đối tác");
  }
  await assertVoucherCodeFree(terms.code, excludeId);
  return { ...terms, courtId: input.courtId || null };
}

export type { EligibilityReasonCode };
export { translateReason };