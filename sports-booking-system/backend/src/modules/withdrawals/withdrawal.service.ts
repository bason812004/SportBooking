import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { walletService } from "../wallets/wallet.service.js";
import { withdrawalRepository } from "./withdrawal.repository.js";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

export const withdrawalService = {
  async create(partnerId: string, data: {
    amount: number;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  }) {
    const wallet = await walletService.getForPartner(partnerId);
    if (wallet.availableBalance < data.amount) {
      throw new ValidationError(
        `So du khong du. Ban co ${wallet.availableBalance.toLocaleString("vi-VN")} VND, muon rut ${data.amount.toLocaleString("vi-VN")} VND`
      );
    }

    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        partnerId,
        amount: data.amount,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountName: data.bankAccountName,
        status: "PENDING"
      }
    });

    realtimeService.toPartner(partnerId, realtimeEvents.withdrawalCreated, withdrawal);
    return withdrawal;
  },

  async approve(withdrawalId: string, actorId: string) {
    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) throw new NotFoundError("Withdrawal request not found");
    if (withdrawal.status !== "PENDING") {
      throw new ValidationError(`Yeu cau da ${withdrawal.status === "APPROVED" ? "duoc duyet" : withdrawal.status === "REJECTED" ? "bi tu choi" : "duoc xu ly"}`);
    }

    const updated = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "APPROVED", processedBy: actorId }
    });

    await recordAdminAction(actorId, "WITHDRAWAL_APPROVED", "WITHDRAWAL_REQUEST", withdrawalId, {
      partnerId: withdrawal.partnerId,
      amount: withdrawal.amount
    });

    realtimeService.toPartner(withdrawal.partnerId, realtimeEvents.withdrawalUpdated, updated);
    return updated;
  },

  async reject(withdrawalId: string, actorId: string, note?: string) {
    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) throw new NotFoundError("Withdrawal request not found");
    if (withdrawal.status !== "PENDING") {
      throw new ValidationError("Chi co the tu choi yeu cau dang cho");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: "REJECTED", processedBy: actorId, note }
      });

      await tx.partnerWallet.update({
        where: { partnerId: withdrawal.partnerId },
        data: { availableBalance: { increment: withdrawal.amount } }
      });

      await recordAdminAction(actorId, "WITHDRAWAL_REJECTED", "WITHDRAWAL_REQUEST", withdrawalId, {
        partnerId: withdrawal.partnerId,
        amount: withdrawal.amount,
        note
      });

      return r;
    });

    realtimeService.toPartner(withdrawal.partnerId, realtimeEvents.withdrawalUpdated, updated);
    return updated;
  },

  async markPaid(withdrawalId: string, actorId: string) {
    const withdrawal = await withdrawalRepository.findById(withdrawalId);
    if (!withdrawal) throw new NotFoundError("Withdrawal request not found");
    if (withdrawal.status !== "APPROVED") {
      throw new ValidationError("Chi co the xac nhan thanh toan yeu cau da duyet");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: "PAID", processedBy: actorId }
      });

      await tx.partnerWallet.update({
        where: { partnerId: withdrawal.partnerId },
        data: {
          availableBalance: { decrement: withdrawal.amount },
          totalWithdrawn: { increment: withdrawal.amount }
        }
      });

      await recordAdminAction(actorId, "WITHDRAWAL_PAID", "WITHDRAWAL_REQUEST", withdrawalId, {
        partnerId: withdrawal.partnerId,
        amount: withdrawal.amount
      });

      return r;
    });

    realtimeService.toPartner(withdrawal.partnerId, realtimeEvents.withdrawalUpdated, updated);
    return updated;
  },

  async getById(id: string) {
    const w = await withdrawalRepository.findById(id);
    if (!w) throw new NotFoundError("Withdrawal not found");
    return {
      ...w,
      amount: toNum(w.amount),
      partnerName: w.partner?.businessName,
      processorName: w.processor?.fullName
    };
  },

  async listForPartner(partnerId: string, page: number, limit: number) {
    const { items, total } = await withdrawalRepository.listByPartner(partnerId, page, limit);
    return {
      items: items.map((w) => ({
        ...w,
        amount: toNum(w.amount)
      })),
      total
    };
  },

  async listAll(filters: {
    page: number;
    limit: number;
    partnerId?: string;
    status?: string;
  }) {
    const { items, total } = await withdrawalRepository.listAll(filters);
    return {
      items: items.map((w: any) => ({
        ...w,
        amount: toNum(w.amount),
        partnerName: w.partner?.businessName,
        ownerName: w.partner?.user?.fullName,
        processorName: w.processor?.fullName
      })),
      total
    };
  },

  async summaryForAdmin(filters: { partnerId?: string }) {
    return withdrawalRepository.summary(filters);
  }
};
