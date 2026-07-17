import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { walletRepository } from "../wallets/wallet.repository.js";
import { getPartnerProfileByUser } from "../wallets/wallet.service.js";
import { withdrawalRepository } from "./withdrawal.repository.js";
import type { CreateWithdrawalInput, WithdrawalListQuery } from "./withdrawal.types.js";

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toDto<T extends { amount: unknown }>(withdrawal: T) {
  return { ...withdrawal, amount: asNumber(withdrawal.amount) };
}

function emitWithdrawalUpdated(withdrawal: { partnerId: string } & Record<string, unknown>, created = false) {
  const event = created ? realtimeEvents.withdrawalCreated : realtimeEvents.withdrawalUpdated;
  realtimeService.toPartner(withdrawal.partnerId, event, withdrawal);
  realtimeService.toAdmin(event, withdrawal);
  realtimeService.toPartner(withdrawal.partnerId, realtimeEvents.walletUpdated, { partnerId: withdrawal.partnerId });
  realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: withdrawal.partnerId });
}

export const withdrawalService = {
  async create(userId: string, input: CreateWithdrawalInput) {
    const profile = await getPartnerProfileByUser(userId);
    const amount = round2(input.amount);
    if (amount <= 0) throw new ValidationError("So tien rut phai lon hon 0");

    const bankName = input.bankName?.trim() || profile.bankName;
    const bankAccountNumber = input.bankAccountNumber?.trim() || profile.bankAccountNumber;
    const bankAccountName = input.bankAccountName?.trim() || profile.bankAccountHolder;
    if (!bankName || !bankAccountNumber || !bankAccountName) {
      throw new ValidationError("Vui long cung cap day du thong tin ngan hang de rut tien");
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      await walletRepository.ensure(profile.id, tx);
      const held = await walletRepository.holdAvailable(profile.id, amount, tx);
      if (held === 0) throw new ValidationError("So du kha dung khong du de tao yeu cau rut tien");
      return withdrawalRepository.create(
        { partnerId: profile.id, amount, bankName, bankAccountNumber, bankAccountName },
        tx
      );
    });

    emitWithdrawalUpdated(withdrawal, true);
    return toDto(withdrawal);
  },

  async listMine(userId: string, query: WithdrawalListQuery) {
    const profile = await getPartnerProfileByUser(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await withdrawalRepository.list(
      { partnerId: profile.id, status: query.status },
      page,
      limit
    );
    return { items: items.map(toDto), meta: paginationMeta(page, limit, total) };
  },

  async adminList(query: WithdrawalListQuery) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const { items, total } = await withdrawalRepository.list(
      { partnerId: query.partnerId?.trim() || undefined, status: query.status },
      page,
      limit
    );
    return { items: items.map(toDto), meta: paginationMeta(page, limit, total) };
  },

  async adminSummary() {
    const groups = await withdrawalRepository.summary();
    const byStatus: Record<string, { count: number; amount: number }> = {};
    const total = { count: 0, amount: 0 };
    for (const group of groups) {
      const row = { count: group._count._all, amount: asNumber(group._sum.amount) };
      byStatus[group.status] = row;
      total.count += row.count;
      total.amount += row.amount;
    }
    return { total, byStatus };
  },

  async approve(actorId: string, id: string) {
    const withdrawal = await withdrawalRepository.byId(id);
    if (!withdrawal) throw new NotFoundError("Khong tim thay yeu cau rut tien");

    const count = await withdrawalRepository.transition(
      id,
      ["PENDING"],
      { status: "APPROVED", processedBy: actorId, processedAt: new Date() },
      prisma
    );
    if (count === 0) throw new ValidationError("Chi co the duyet yeu cau dang cho xu ly");

    await recordAdminAction(actorId, "WITHDRAWAL_APPROVED", "WITHDRAWAL", id, {
      partnerId: withdrawal.partnerId,
      amount: asNumber(withdrawal.amount)
    });
    const updated = await withdrawalRepository.byId(id);
    emitWithdrawalUpdated(updated!);
    return toDto(updated!);
  },

  async reject(actorId: string, id: string, note?: string) {
    const withdrawal = await withdrawalRepository.byId(id);
    if (!withdrawal) throw new NotFoundError("Khong tim thay yeu cau rut tien");

    await prisma.$transaction(async (tx) => {
      const count = await withdrawalRepository.transition(
        id,
        ["PENDING", "APPROVED"],
        { status: "REJECTED", processedBy: actorId, processedAt: new Date(), note: note ?? null },
        tx
      );
      if (count === 0) throw new ValidationError("Chi co the tu choi yeu cau dang cho xu ly hoac da duyet");
      await walletRepository.releaseHold(withdrawal.partnerId, asNumber(withdrawal.amount), tx);
    });

    await recordAdminAction(actorId, "WITHDRAWAL_REJECTED", "WITHDRAWAL", id, {
      partnerId: withdrawal.partnerId,
      amount: asNumber(withdrawal.amount),
      note: note ?? null
    });
    const updated = await withdrawalRepository.byId(id);
    emitWithdrawalUpdated(updated!);
    return toDto(updated!);
  },

  async markPaid(actorId: string, id: string, note?: string) {
    const withdrawal = await withdrawalRepository.byId(id);
    if (!withdrawal) throw new NotFoundError("Khong tim thay yeu cau rut tien");

    await prisma.$transaction(async (tx) => {
      const count = await withdrawalRepository.transition(
        id,
        ["APPROVED"],
        { status: "PAID", processedBy: actorId, processedAt: new Date(), note: note ?? withdrawal.note },
        tx
      );
      if (count === 0) throw new ValidationError("Chi co the xac nhan chuyen khoan cho yeu cau da duyet");
      await walletRepository.markWithdrawn(withdrawal.partnerId, asNumber(withdrawal.amount), tx);
    });

    await recordAdminAction(actorId, "WITHDRAWAL_PAID", "WITHDRAWAL", id, {
      partnerId: withdrawal.partnerId,
      amount: asNumber(withdrawal.amount)
    });
    const updated = await withdrawalRepository.byId(id);
    emitWithdrawalUpdated(updated!);
    return toDto(updated!);
  }
};
