import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateVoucherDiscount } from "../../shared/utils/businessRules.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { voucherRepository } from "./voucher.repository.js";

export const voucherService = {
  list() {
    return voucherRepository.listActive();
  },

  async detail(id: string) {
    const [voucher] = await voucherRepository.findActiveById(id);
    if (!voucher) throw new NotFoundError("Khong tim thay voucher");
    return voucher;
  },

  async claim(userId: string, voucherId: string) {
    const voucher = await voucherRepository.findActiveVoucher(voucherId);
    if (!voucher) throw new NotFoundError("Khong tim thay voucher kha dung");
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
      throw new ValidationError("Voucher da het luot su dung");
    }
    if (await voucherRepository.userVoucher(userId, voucherId)) {
      throw new ConflictError("Ban da nhan voucher nay", "VOUCHER_ALREADY_CLAIMED");
    }
    const claimed = await voucherRepository.claim(userId, voucherId);
    await trackEvent({ userId, partnerId: voucher.partnerId, eventType: "VOUCHER_CLAIMED", entityType: "VOUCHER", entityId: voucherId });
    return claimed;
  },

  listForUser(userId: string) {
    return voucherRepository.listForUser(userId);
  },

  async apply(input: { userId?: string; voucherId?: string; code?: string; courtId: string; subtotal: number }) {
    const voucher = await voucherRepository.findUsable({ voucherId: input.voucherId, code: input.code, courtId: input.courtId });
    if (!voucher) throw new NotFoundError("Voucher khong hop le");
    const court = await voucherRepository.partnerCourt(input.courtId, voucher.partnerId);
    if (!court) throw new ValidationError("Voucher khong ap dung cho san nay");
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
      throw new ValidationError("Voucher da het luot su dung");
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
      partnerId: voucher.partnerId,
      eventType: "VOUCHER_APPLIED",
      entityType: "VOUCHER",
      entityId: voucher.id,
      metadataJson: { courtId: input.courtId, subtotal: input.subtotal, discountAmount: discount.discountAmount }
    });

    return { voucherId: voucher.id, code: voucher.code, ...discount };
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
    return this.detailForPartner(partnerId, id);
  },

  async disableForPartner(partnerId: string, id: string) {
    const voucher = await this.detailForPartner(partnerId, id);
    if (voucher.status !== "ACTIVE") throw new ValidationError("Voucher khong dang hoat dong");
    await voucherRepository.setStatus(id, partnerId, ["ACTIVE"], "DISABLED");
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
  },

  listAdmin() {
    return voucherRepository.listAdmin();
  },

  disableAdmin(id: string) {
    return voucherRepository.disableAdmin(id);
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
  return {
    ...input,
    code,
    courtId: input.courtId || null,
    maxDiscountAmount: input.discountType === "PERCENTAGE" ? input.maxDiscountAmount ?? null : null,
    usageLimit: input.usageLimit ?? null,
    startDate,
    endDate
  };
}
