import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { partnerRepository } from "../partner/partner.repository.js";
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
    currency: wallet.currency,
    updatedAt: wallet.updatedAt
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
    const wallet = await walletRepository.ensure(profile.id);
    return {
      ...toWalletDto(wallet),
      bankName: profile.bankName,
      bankAccountNumber: profile.bankAccountNumber,
      bankAccountHolder: profile.bankAccountHolder
    };
  },

  async adminList(query: { page?: string; limit?: string; search?: string }) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await walletRepository.adminList({
      page,
      limit,
      search: query.search?.trim() || undefined
    });
    return {
      items: items.map((wallet) => ({ ...toWalletDto(wallet), partner: wallet.partner })),
      meta: paginationMeta(page, limit, total)
    };
  },

  async adminDetail(partnerId: string) {
    const wallet = await walletRepository.adminDetail(partnerId);
    if (!wallet) throw new NotFoundError("Khong tim thay vi cua doi tac");
    return { ...toWalletDto(wallet), partner: wallet.partner };
  },

  async adminSummary() {
    const { aggregate, count } = await walletRepository.adminSummary();
    return {
      walletCount: count,
      totalAvailable: asNumber(aggregate._sum.availableBalance),
      totalPending: asNumber(aggregate._sum.pendingBalance),
      totalEarned: asNumber(aggregate._sum.totalEarned),
      totalWithdrawn: asNumber(aggregate._sum.totalWithdrawn)
    };
  }
};
