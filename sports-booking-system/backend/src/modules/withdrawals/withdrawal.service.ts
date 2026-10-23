import type { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { notificationService } from "../notifications/notification.service.js";
import { activePayoutProvider } from "../payouts/providers/index.js";
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

function money(amount: unknown) {
  return `${asNumber(amount).toLocaleString("vi-VN")} VND`;
}

/** Tells the partner where their withdrawal stands; the change is already saved, so a failed notice only logs. */
async function notifyPartner(
  withdrawal: { id: string; partner?: { user?: { id: string } | null } | null } | null,
  notice: { title: string; content: string; type: string }
) {
  const userId = withdrawal?.partner?.user?.id;
  if (!userId) return;
  try {
    await notificationService.create({ userId, ...notice, metadata: { withdrawalId: withdrawal.id } });
  } catch (error) {
    console.error("[Withdrawal] Partner notification failed:", error);
  }
}

// Calls the payout provider for a withdrawal already sitting at APPROVED, then moves
// it to PROCESSING. Best-effort: if the provider call throws, the request just stays
// APPROVED so an admin can still fall back to manual markPaid()/reject(). Shared by
// both the admin "Duyệt" action and the auto-approve path in create().
// Manual payouts (no provider, the default): nothing to call, the withdrawal waits at
// APPROVED until an admin has transferred the money and confirms it with markPaid().
async function triggerPayout(
  id: string,
  withdrawal: { amount: unknown; bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null },
  forceResult?: "SUCCESS" | "FAILED" | "TIMEOUT" | "RANDOM"
) {
  const payoutProvider = activePayoutProvider();
  if (!payoutProvider) return;
  try {
    const result = await payoutProvider.createPayout({
      withdrawalId: id,
      amount: asNumber(withdrawal.amount),
      bankName: withdrawal.bankName ?? "",
      bankAccountNumber: withdrawal.bankAccountNumber ?? "",
      bankAccountName: withdrawal.bankAccountName ?? "",
      forceResult
    });
    const count = await withdrawalRepository.transition(
      id,
      ["APPROVED"],
      {
        status: "PROCESSING",
        providerName: result.provider,
        providerTransactionId: result.externalTransactionId
      },
      prisma
    );
    if (count === 0) {
      console.warn(`[Payout] transition APPROVED->PROCESSING matched 0 rows for withdrawalId=${id} — status may have changed concurrently.`);
    }
  } catch (error) {
    console.error("[Payout] createPayout failed, leaving withdrawal APPROVED for manual handling:", error);
  }
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
      const wallet = await walletRepository.ensure(profile.id, tx);
      // Debt is normally already netted against the balance; this also covers money released meanwhile.
      if (asNumber(wallet.commissionDebt) > 0) {
        throw new ValidationError(`Bạn còn nợ hoa hồng ${money(wallet.commissionDebt)}. Hãy thanh toán công nợ trước khi rút tiền.`);
      }
      const held = await walletRepository.holdAvailable(profile.id, amount, tx);
      if (held === 0) throw new ValidationError("So du kha dung khong du de tao yeu cau rut tien");
      return withdrawalRepository.create(
        { partnerId: profile.id, amount, bankName, bankAccountNumber, bankAccountName },
        tx
      );
    });

    let result: typeof withdrawal = withdrawal;
    // Off by default (limit 0): every withdrawal waits for an admin. When enabled, nobody is recorded
    // as having processed it; the partner whose request triggered it is the audit actor.
    if (env.WITHDRAWAL_AUTO_APPROVE_LIMIT > 0 && amount <= env.WITHDRAWAL_AUTO_APPROVE_LIMIT) {
      await withdrawalRepository.transition(
        withdrawal.id,
        ["PENDING"],
        { status: "APPROVED", processedAt: new Date() },
        prisma
      );
      await recordAdminAction(userId, "WITHDRAWAL_AUTO_APPROVED", "WITHDRAWAL", withdrawal.id, {
        partnerId: profile.id,
        amount
      });
      await triggerPayout(withdrawal.id, withdrawal);
      result = (await withdrawalRepository.byId(withdrawal.id))!;
    }

    emitWithdrawalUpdated(result, true);
    return toDto(result);
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
      {
        partnerId: query.partnerId?.trim() || undefined,
        status: query.status,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        fromDate: query.fromDate,
        toDate: query.toDate
      },
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

  async approve(actorId: string, id: string, forceResult?: "SUCCESS" | "FAILED" | "TIMEOUT" | "RANDOM") {
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

    await triggerPayout(id, withdrawal, forceResult);

    const updated = await withdrawalRepository.byId(id);
    emitWithdrawalUpdated(updated!);
    await notifyPartner(updated, {
      title: "Yêu cầu rút tiền đã được duyệt",
      content: activePayoutProvider()
        ? `Yêu cầu rút ${money(withdrawal.amount)} đã được duyệt và đang được chuyển khoản.`
        : `Yêu cầu rút ${money(withdrawal.amount)} đã được duyệt. Bạn sẽ nhận thông báo khi admin chuyển khoản xong.`,
      type: "WITHDRAWAL_APPROVED"
    });
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
      await walletRepository.offsetDebt(withdrawal.partnerId, tx);
    });

    await recordAdminAction(actorId, "WITHDRAWAL_REJECTED", "WITHDRAWAL", id, {
      partnerId: withdrawal.partnerId,
      amount: asNumber(withdrawal.amount),
      note: note ?? null
    });
    const updated = await withdrawalRepository.byId(id);
    emitWithdrawalUpdated(updated!);
    await notifyPartner(updated, {
      title: "Yêu cầu rút tiền bị từ chối",
      content: `Yêu cầu rút ${money(withdrawal.amount)} bị từ chối${note ? `: ${note}` : ""}. Số tiền đã được hoàn lại vào số dư khả dụng.`,
      type: "WITHDRAWAL_REJECTED"
    });
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
    const account = [withdrawal.bankName, withdrawal.bankAccountNumber].filter(Boolean).join(" ");
    await notifyPartner(updated, {
      title: "Rút tiền thành công",
      content: `Admin đã chuyển khoản ${money(withdrawal.amount)}${account ? ` vào tài khoản ${account}` : ""}.`,
      type: "WITHDRAWAL_PAID"
    });
    return toDto(updated!);
  },

  async handleProviderWebhook(providerParam: string, payload: unknown, headers: Record<string, string | string[] | undefined>) {
    // With manual payouts nothing can confirm a transfer except an admin: refuse every webhook.
    const payoutProvider = activePayoutProvider();
    if (!payoutProvider) throw new ForbiddenError("Chua bat nha cung cap chuyen khoan tu dong");
    const verified = await payoutProvider.verifyWebhook(payload, headers);

    const nextStatus = verified.status === "SUCCESS" ? "PAID" : "FAILED";
    const withdrawal = await withdrawalRepository.byId(verified.withdrawalId);
    if (!withdrawal) {
      console.warn(`[Payout] Webhook for unknown withdrawal ${verified.withdrawalId}, ignoring.`);
      return { ignored: true };
    }

    const applied = await prisma.$transaction(async (tx) => {
      // Accept from APPROVED too: the fake provider's simulated webhook is scheduled the
      // instant createPayout() is called, racing against triggerPayout()'s own
      // APPROVED->PROCESSING write. Both statuses mean "payout started, no final result
      // yet", so either is a valid source for the final PAID/FAILED transition.
      const count = await withdrawalRepository.transition(
        verified.withdrawalId,
        ["APPROVED", "PROCESSING"],
        {
          status: nextStatus,
          processedAt: new Date(),
          providerResponse: verified.rawPayload as Prisma.InputJsonValue
        },
        tx
      );
      if (count === 0) return false;

      if (nextStatus === "PAID") {
        await walletRepository.markWithdrawn(withdrawal.partnerId, asNumber(withdrawal.amount), tx);
      } else {
        await walletRepository.releaseHold(withdrawal.partnerId, asNumber(withdrawal.amount), tx);
        await walletRepository.offsetDebt(withdrawal.partnerId, tx);
      }
      return true;
    });

    if (!applied) {
      // Already processed (idempotent replay) or status moved on manually in the meantime.
      console.warn(`[Payout] Webhook for ${verified.withdrawalId} ignored — not in PROCESSING anymore.`);
      return { ignored: true };
    }

    await recordAdminAction(withdrawal.processedBy ?? "system", `WITHDRAWAL_${nextStatus}`, "WITHDRAWAL", verified.withdrawalId, {
      partnerId: withdrawal.partnerId,
      amount: asNumber(withdrawal.amount),
      provider: verified.provider
    });

    const updated = await withdrawalRepository.byId(verified.withdrawalId);
    emitWithdrawalUpdated(updated!);

    const partnerUserId = updated!.partner.user.id;
    await notificationService.create({
      userId: partnerUserId,
      title: nextStatus === "PAID" ? "Rút tiền thành công" : "Rút tiền thất bại",
      content:
        nextStatus === "PAID"
          ? `Yêu cầu rút ${asNumber(withdrawal.amount).toLocaleString("vi-VN")} VND đã được chuyển khoản thành công.`
          : `Yêu cầu rút ${asNumber(withdrawal.amount).toLocaleString("vi-VN")} VND không thành công, số dư khả dụng đã được hoàn lại.`,
      type: nextStatus === "PAID" ? "WITHDRAWAL_PAID" : "WITHDRAWAL_FAILED",
      metadata: { withdrawalId: verified.withdrawalId }
    });

    return toDto(updated!);
  }
};
