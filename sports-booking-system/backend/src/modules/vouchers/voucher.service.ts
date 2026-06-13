import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
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
