import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { walletRepository } from "./wallet.repository.js";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

export const walletService = {
  async getForPartner(partnerId: string) {
    const wallet = await walletRepository.findOrCreate(partnerId);
    return {
      id: wallet.id,
      partnerId: wallet.partnerId,
      availableBalance: toNum(wallet.availableBalance),
      pendingBalance: toNum(wallet.pendingBalance),
      totalEarned: toNum(wallet.totalEarned),
      totalWithdrawn: toNum(wallet.totalWithdrawn),
      currency: wallet.currency,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString()
    };
  },

  async getForAdmin(partnerId: string) {
    const wallet = await walletRepository.findByPartner(partnerId);
    if (!wallet) throw new NotFoundError("Wallet not found");
    return {
      id: wallet.id,
      partnerId: wallet.partnerId,
      availableBalance: toNum(wallet.availableBalance),
      pendingBalance: toNum(wallet.pendingBalance),
      totalEarned: toNum(wallet.totalEarned),
      totalWithdrawn: toNum(wallet.totalWithdrawn),
      currency: wallet.currency,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString()
    };
  },

  async listForAdmin(page: number, limit: number) {
    const { items, total } = await walletRepository.listAll(page, limit);
    return {
      items: items.map((w) => ({
        id: w.id,
        partnerId: w.partnerId,
        businessName: w.partner.businessName,
        ownerName: w.partner.user.fullName,
        availableBalance: toNum(w.availableBalance),
        pendingBalance: toNum(w.pendingBalance),
        totalEarned: toNum(w.totalEarned),
        totalWithdrawn: toNum(w.totalWithdrawn),
        currency: w.currency,
        updatedAt: w.updatedAt.toISOString()
      })),
      total
    };
  },

  async summaryForAdmin() {
    return walletRepository.summary();
  }
};
