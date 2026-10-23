import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { commissionService } from "../commission/commission.service.js";
import { notificationService } from "../notifications/notification.service.js";
import { partnerRepository } from "../partner/partner.repository.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { walletRepository } from "./wallet.repository.js";
import type { WalletDto } from "./wallet.types.js";

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

export function toWalletDto(wallet: {
  id: string;
  partnerId: string;
  availableBalance: unknown;
  pendingBalance: unknown;
  totalEarned: unknown;
  totalWithdrawn: unknown;
  commissionDebt: unknown;
  currency: string;
  updatedAt: Date;
}): WalletDto {
  return {
    id: wallet.id,
    partnerId: wallet.partnerId,
    availableBalance: asNumber(wallet.availableBalance),
    pendingBalance: asNumber(wallet.pendingBalance),
    totalEarned: asNumber(wallet.totalEarned),
    totalWithdrawn: asNumber(wallet.totalWithdrawn),
    commissionDebt: asNumber(wallet.commissionDebt),
    currency: wallet.currency,
    updatedAt: wallet.updatedAt
  };
}

const toDebtPaymentDto = (payment: { id: string; amount: unknown; note: string | null; createdAt: Date }) => ({
  id: payment.id,
  amount: asNumber(payment.amount),
  note: payment.note,
  createdAt: payment.createdAt
});

/** Where a partner transfers money to pay commission debt: the platform's own account. */
export function debtTransferInfo(partnerId: string, debt: number) {
  const transferContent = `HH ${partnerId}`;
  return {
    bankName: env.PAYMENT_BANK_ID,
    accountNumber: env.PAYMENT_BANK_ACCOUNT,
    accountHolder: env.PAYMENT_BANK_OWNER,
    transferContent,
    qrCodeUrl: `https://img.vietqr.io/image/${env.PAYMENT_BANK_ID.toLowerCase()}-${env.PAYMENT_BANK_ACCOUNT}-compact.jpg?amount=${Math.ceil(debt)}&addInfo=${encodeURIComponent(transferContent)}`
  };
}

export async function getPartnerProfileByUser(userId: string) {
  const profile = await partnerRepository.profileByUser(userId);
  if (!profile) throw new ForbiddenError("Tai khoan doi tac chua co ho so");
  return profile;
}

export const walletService = {
  async myWallet(userId: string) {
    const profile = await getPartnerProfileByUser(userId);
    const [wallet, commissionRate, debtPayments] = await Promise.all([
      walletRepository.ensure(profile.id),
      commissionService.effectiveRate(profile, prisma),
      walletRepository.debtPayments(profile.id)
    ]);
    const dto = toWalletDto(wallet);
    return {
      ...dto,
      bankName: profile.bankName,
      bankAccountNumber: profile.bankAccountNumber,
      bankAccountHolder: profile.bankAccountHolder,
      commissionRate,
      debtTransfer: dto.commissionDebt > 0 ? debtTransferInfo(profile.id, dto.commissionDebt) : null,
      debtPayments: debtPayments.map(toDebtPaymentDto)
    };
  },

  async adminList(query: { page?: string; limit?: string; search?: string; hasDebt?: string }) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await walletRepository.adminList({
      page,
      limit,
      search: query.search?.trim() || undefined,
      hasDebt: query.hasDebt === "true"
    });
    return {
      items: items.map((wallet) => ({ ...toWalletDto(wallet), partner: wallet.partner })),
      meta: paginationMeta(page, limit, total)
    };
  },

  async adminDetail(partnerId: string) {
    const wallet = await walletRepository.adminDetail(partnerId);
    if (!wallet) throw new NotFoundError("Khong tim thay vi cua doi tac");
    const debtPayments = await walletRepository.debtPayments(partnerId);
    return { ...toWalletDto(wallet), partner: wallet.partner, debtPayments: debtPayments.map(toDebtPaymentDto) };
  },

  async adminSummary() {
    const { aggregate, count, debtorCount } = await walletRepository.adminSummary();
    return {
      walletCount: count,
      totalAvailable: asNumber(aggregate._sum.availableBalance),
      totalPending: asNumber(aggregate._sum.pendingBalance),
      totalEarned: asNumber(aggregate._sum.totalEarned),
      totalWithdrawn: asNumber(aggregate._sum.totalWithdrawn),
      totalCommissionDebt: asNumber(aggregate._sum.commissionDebt),
      debtorCount
    };
  },

  /** An admin confirms the partner transferred commission debt to the platform account. */
  async recordDebtPayment(actorId: string, partnerId: string, input: { amount: number; note?: string }) {
    const amount = Math.round(input.amount * 100) / 100;
    const wallet = await walletRepository.adminDetail(partnerId);
    if (!wallet) throw new NotFoundError("Khong tim thay vi cua doi tac");

    const payment = await prisma.$transaction(async (tx) => {
      const paid = await walletRepository.payDebt(partnerId, amount, tx);
      if (!paid) throw new ConflictError("Số tiền vượt quá công nợ hiện tại của đối tác");
      return walletRepository.recordDebtPayment({ partnerId, amount, note: input.note?.trim(), recordedBy: actorId }, tx);
    });

    await recordAdminAction(actorId, "COMMISSION_DEBT_PAID", "PARTNER", partnerId, { amount, paymentId: payment.id });
    const userId = wallet.partner.user?.id;
    if (userId) {
      try {
        await notificationService.create({
          userId,
          title: "Đã ghi nhận thanh toán công nợ",
          content: `Quản trị viên đã ghi nhận ${amount.toLocaleString("vi-VN")} VND bạn thanh toán công nợ hoa hồng.`,
          type: "COMMISSION_DEBT_PAID",
          metadata: { paymentId: payment.id }
        });
      } catch (error) {
        // The payment is already saved; a failed notice only logs.
        console.error("[Wallet] Partner notification failed:", error);
      }
    }
    realtimeService.toPartner(partnerId, realtimeEvents.walletUpdated, { partnerId });
    realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId });
    return walletService.adminDetail(partnerId);
  }
};
