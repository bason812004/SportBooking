import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { calculateVoucherDiscount } from "../../shared/utils/businessRules.js";
import { trackEvent } from "../analytics/analytics.service.js";
import { voucherRepository } from "./voucher.repository.js";
export const voucherService = {
    list() {
        return voucherRepository.listActive();
    },
    async detail(id) {
        const [voucher] = await voucherRepository.findActiveById(id);
        if (!voucher)
            throw new NotFoundError("Khong tim thay voucher");
        return voucher;
    },
    async claim(userId, voucherId) {
        const voucher = await voucherRepository.findActiveVoucher(voucherId);
        if (!voucher)
            throw new NotFoundError("Khong tim thay voucher kha dung");
        if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit)
            throw new ValidationError("Voucher da het luot su dung");
        if (await voucherRepository.userVoucher(userId, voucherId))
            throw new ConflictError("Ban da nhan voucher nay", "VOUCHER_ALREADY_CLAIMED");
        const claimed = await voucherRepository.claim(userId, voucherId);
        await trackEvent({ userId, partnerId: voucher.partnerId, eventType: "VOUCHER_CLAIMED", entityType: "VOUCHER", entityId: voucherId });
        return claimed;
    },
    listForUser(userId) {
        return voucherRepository.listForUser(userId);
    },
    async apply(input) {
        const voucher = await voucherRepository.findUsable({ voucherId: input.voucherId, code: input.code, courtId: input.courtId });
        if (!voucher)
            throw new NotFoundError("Voucher khong hop le");
        const court = input.courtId ? await voucherRepository.partnerCourt(input.courtId, voucher.partnerId) : null;
        if (!court)
            throw new ValidationError("Voucher khong ap dung cho san nay");
        if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit)
            throw new ValidationError("Voucher da het luot su dung");
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
    async listPartner(userId) {
        const profile = await voucherRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        return voucherRepository.listPartner(profile.id);
    },
    async createPartner(userId, input) {
        const profile = await voucherRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        if (input.courtId && !(await voucherRepository.partnerCourt(input.courtId, profile.id))) {
            throw new ForbiddenError("Chi duoc tao voucher cho san cua ban");
        }
        return voucherRepository.createPartner(profile.id, input);
    },
    async updatePartner(userId, id, input) {
        const profile = await voucherRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        const existing = await voucherRepository.findPartnerVoucher(id, profile.id);
        if (!existing)
            throw new NotFoundError("Khong tim thay voucher cua ban");
        if (input.courtId && !(await voucherRepository.partnerCourt(input.courtId, profile.id))) {
            throw new ForbiddenError("Chi duoc cap nhat voucher cho san cua ban");
        }
        return voucherRepository.updatePartner(id, input);
    },
    async setPartnerStatus(userId, id, status) {
        return this.updatePartner(userId, id, { status });
    },
    async deletePartner(userId, id) {
        const profile = await voucherRepository.partnerProfile(userId);
        if (!profile)
            throw new ForbiddenError("Tai khoan doi tac chua co ho so");
        if (!(await voucherRepository.findPartnerVoucher(id, profile.id)))
            throw new NotFoundError("Khong tim thay voucher cua ban");
        return voucherRepository.deletePartner(id);
    },
    listAdmin() {
        return voucherRepository.listAdmin();
    },
    disableAdmin(id) {
        return voucherRepository.disableAdmin(id);
    }
};
