import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { slugify } from "../../shared/utils/slug.js";
import { commissionService, monthRange } from "../commission/commission.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import { recordAdminAction, verifyAuditChain } from "./admin.audit.js";
import { adminRepository } from "./admin.repository.js";

const paginatedRaw = (items: any[], countRows: Array<{ count: bigint }>, page: number, limit: number) => ({
  items,
  meta: paginationMeta(page, limit, Number(countRows[0]?.count ?? 0))
});

const financeSummary = (items: any[]) =>
  items.reduce(
    (total, item) => ({
      grossAmount: total.grossAmount + Number(item.grossAmount ?? 0),
      commissionAmount: total.commissionAmount + Number(item.commissionAmount ?? 0),
      netAmount: total.netAmount + Number(item.netAmount ?? 0),
      refundAmount: total.refundAmount + Number(item.refundAmount ?? 0),
      platformRetainedAmount: total.platformRetainedAmount + Number(item.platformRetainedAmount ?? 0),
      transactionCount: total.transactionCount + Number(item.transactionCount ?? 0),
      refundCount: total.refundCount + Number(item.refundCount ?? 0)
    }),
    {
      grossAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      refundAmount: 0,
      platformRetainedAmount: 0,
      transactionCount: 0,
      refundCount: 0
    }
  );

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const adminService = {
  async dashboard() {
    const [users, partners, courts, bookings, money, commission, pendingCourts, pendingPartners, trend, pendingItems] =
      await adminRepository.dashboard();
    const gmv = Number(money._sum.totalPrice ?? 0);
    const refunds = Number(money._sum.refundAmount ?? 0);
    return {
      users,
      partners,
      courts,
      bookings,
      pendingCourts,
      pendingPartners,
      financials: {
        gmv,
        refunds,
        platformCommission: Number(commission._sum.commissionAmount ?? 0),
        partnerPayout: Number(commission._sum.netAmount ?? 0)
      },
      trend: trend.map((item) => ({
        date: item.bookingDate.toISOString().slice(0, 10),
        bookings: item._count,
        gmv: Number(item._sum?.totalPrice ?? 0)
      })),
      pendingItems
    };
  },

  async users(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.users(page, limit, {
      search: query.search || undefined,
      role: query.role || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async bookings(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.bookings(page, limit, {
      search: query.search || undefined,
      fromDate: query.fromDate || undefined,
      toDate: query.toDate || undefined,
      courtId: query.courtId || undefined,
      partnerId: query.partnerId || undefined,
      userId: query.userId || undefined,
      bookingStatus: query.bookingStatus || undefined,
      paymentStatus: query.paymentStatus || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async bookingDetail(id: string) {
    const booking = await adminRepository.bookingDetail(id);
    if (!booking) throw new NotFoundError("Khong tim thay don dat san");
    return booking;
  },

  async updateBookingAdmin(actorId: string, id: string, input: any) {
    const current = await adminRepository.bookingDetail(id);
    if (!current) throw new NotFoundError("Khong tim thay don dat san");
    if (input.bookingStatus === "CANCELLED" && !input.cancelReason && !current.cancelReason) {
      throw new ValidationError("Can nhap ly do khi huy don");
    }
    if (input.refundAmount !== undefined && input.refundAmount > Number(current.totalPrice)) {
      throw new ValidationError("So tien hoan khong duoc lon hon tong tien don");
    }
    if (input.platformRetainedAmount !== undefined && input.platformRetainedAmount > Number(current.totalPrice)) {
      throw new ValidationError("So tien giu lai khong duoc lon hon tong tien don");
    }

    const action =
      input.refundAmount !== undefined || input.paymentStatus ? "REFUND_OR_PAYMENT_UPDATED" :
      "BOOKING_ADMIN_UPDATED";

    const result = await adminRepository.updateBookingAdmin(actorId, id, input, action);
    if (!result) throw new NotFoundError("Khong tim thay don dat san");
    await recordAdminAction(actorId, action, "BOOKING", id, {
      bookingStatus: input.bookingStatus,
      paymentStatus: input.paymentStatus,
      refundAmount: input.refundAmount,
      platformRetainedAmount: input.platformRetainedAmount
    });
    if (result.settlement) {
      const settlement = result.settlement;
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.settlementUpdated, settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, settlement);
      realtimeService.toPartner(settlement.partnerId, realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId: settlement.partnerId });
    }
    return result;
  },

  async lockUser(actorId: string, id: string) {
    if (actorId === id) throw new ValidationError("Admin khong the tu khoa tai khoan cua minh");
    const target = await adminRepository.userById(id);
    if (!target) throw new NotFoundError("Khong tim thay tai khoan");
    if (target.role === "ADMIN" && target.status === "ACTIVE" && await adminRepository.activeAdminCount() <= 1) {
      throw new ValidationError("Khong the khoa Admin hoat dong cuoi cung");
    }
    const result = await adminRepository.setUserStatus(id, "LOCKED");
    await recordAdminAction(actorId, "USER_LOCKED", "USER", id, { email: target.email });
    return result;
  },

  async unlockUser(actorId: string, id: string) {
    const result = await adminRepository.setUserStatus(id, "ACTIVE");
    await recordAdminAction(actorId, "USER_UNLOCKED", "USER", id);
    return result;
  },

  async partners(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.partners(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async partnerDetail(id: string) {
    const partner = await adminRepository.partnerDetail(id);
    if (!partner) throw new NotFoundError("Khong tim thay doi tac");
    return { ...partner, history: await adminRepository.moderationHistory("PARTNER", id) };
  },

  async approvePartner(actorId: string, id: string, reason?: string) {
    const result = await adminRepository.setPartnerApproval(id, "APPROVED");
    await adminRepository.addModerationHistory({ entityType: "PARTNER", entityId: id, action: "APPROVED", reason, actorId });
    await recordAdminAction(actorId, "PARTNER_APPROVED", "PARTNER", id, { reason });
    return result;
  },

  async rejectPartner(actorId: string, id: string, reason: string) {
    const result = await adminRepository.setPartnerApproval(id, "REJECTED");
    await adminRepository.addModerationHistory({ entityType: "PARTNER", entityId: id, action: "REJECTED", reason, actorId });
    await recordAdminAction(actorId, "PARTNER_REJECTED", "PARTNER", id, { reason });
    return result;
  },

  commissionDefault() { return commissionService.defaultRate(); },
  async updateCommissionDefault(actorId: string, rate: number) {
    const result = await commissionService.updateDefaultRate(rate);
    await recordAdminAction(actorId, "COMMISSION_DEFAULT_UPDATED", "SYSTEM_SETTING", "commission.default_rate", { rate });
    return result;
  },
  partnerCommission(id: string) { return commissionService.partnerRate(id); },
  async updatePartnerCommission(actorId: string, id: string, rate: number | null) {
    const result = await commissionService.updatePartnerRate(id, rate);
    await recordAdminAction(actorId, "PARTNER_COMMISSION_UPDATED", "PARTNER", id, { rate });
    return result;
  },
  commissionReport(month?: string) { return commissionService.adminReport(month); },

  async financeTransactions(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const range = monthRange(query.month);
    const [items, total] = await adminRepository.financeTransactions(page, limit, {
      month: range.month,
      from: range.from,
      to: range.to,
      search: query.search || undefined,
      partnerId: query.partnerId || undefined,
      transactionType: query.transactionType || undefined,
      eventType: query.eventType || undefined,
      payoutStatus: query.payoutStatus || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async financeRefunds(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const range = monthRange(query.month);
    const [items, total] = await adminRepository.financeRefunds(page, limit, {
      from: range.from,
      to: range.to,
      search: query.search || undefined,
      partnerId: query.partnerId || undefined,
      paymentStatus: query.paymentStatus || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async financeReconciliation(month?: string) {
    const range = monthRange(month);
    const partners = await adminRepository.financeReconciliation(range.month, range.from, range.to);
    return {
      month: range.month,
      summary: financeSummary(partners),
      partners
    };
  },

  async updatePayout(actorId: string, partnerId: string, month: string | undefined, input: any) {
    const range = monthRange(month);
    const result = await adminRepository.upsertPartnerPayout(actorId, partnerId, range.month, range.from, range.to, input);
    if (!result) throw new NotFoundError("Khong tim thay doi tac");
    await recordAdminAction(actorId, "PAYOUT_STATUS_UPDATED", "PAYOUT", result.id, {
      partnerId,
      month: range.month,
      status: input.status,
      note: input.note
    });
    return result;
  },

  async financeExport(month?: string) {
    const report = await this.financeReconciliation(month);
    const header = [
      "month",
      "partner_id",
      "business_name",
      "gross_amount",
      "commission_amount",
      "net_amount",
      "transaction_count",
      "refund_amount",
      "platform_retained_amount",
      "refund_count",
      "payout_status",
      "paid_at",
      "payout_note"
    ];
    const lines = [
      header.join(","),
      ...report.partners.map((item: any) => [
        report.month,
        item.partnerId,
        item.businessName,
        item.grossAmount,
        item.commissionAmount,
        item.netAmount,
        item.transactionCount,
        item.refundAmount,
        item.platformRetainedAmount,
        item.refundCount,
        item.payoutStatus,
        item.paidAt ? new Date(item.paidAt).toISOString() : "",
        item.payoutNote ?? ""
      ].map(csvCell).join(","))
    ];
    return {
      filename: `finance-report-${report.month}.csv`,
      content: `\ufeff${lines.join("\n")}`
    };
  },

  async notificationCampaigns(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.notificationCampaigns(page, limit, {
      search: query.search || undefined,
      type: query.type || undefined,
      targetType: query.targetType || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async notificationCampaignDetail(id: string) {
    const campaign = await adminRepository.notificationCampaignDetail(id);
    if (!campaign) throw new NotFoundError("Khong tim thay lich su thong bao");
    return campaign;
  },

  async createNotificationCampaign(actorId: string, input: any) {
    if (input.targetType === "ALL") {
      input.targetRole = undefined;
      input.targetUserId = undefined;
      input.targetPartnerId = undefined;
    }
    if (input.targetType === "ROLE") {
      input.targetUserId = undefined;
      input.targetPartnerId = undefined;
    }
    if (input.targetType === "USER") {
      input.targetRole = undefined;
      input.targetPartnerId = undefined;
    }
    if (input.targetType === "PARTNER") {
      input.targetRole = undefined;
      input.targetUserId = undefined;
    }
    const campaign = await adminRepository.createNotificationCampaign(actorId, input);
    if (!campaign) throw new ValidationError("Khong tim thay nguoi nhan phu hop");
    await recordAdminAction(actorId, "NOTIFICATION_CAMPAIGN_SENT", "NOTIFICATION_CAMPAIGN", campaign.id, {
      targetType: input.targetType,
      targetRole: input.targetRole,
      targetUserId: input.targetUserId,
      targetPartnerId: input.targetPartnerId,
      recipientCount: campaign.recipientCount
    });
    return campaign;
  },

  async courts(query: any) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.adminCourts(page, limit, {
      search: query.search || undefined,
      partnerId: query.partnerId || undefined,
      city: query.city || undefined,
      district: query.district || undefined,
      approvalStatus: query.approvalStatus || undefined,
      activeStatus: query.activeStatus || undefined,
      verified: query.verified || undefined,
      featured: query.featured || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async courtDetail(id: string) {
    const court = await adminRepository.adminCourtDetail(id);
    if (!court) throw new NotFoundError("Khong tim thay san");
    return court;
  },

  async updateCourtAdmin(actorId: string, id: string, input: any) {
    const current = await adminRepository.adminCourtDetail(id);
    if (!current) throw new NotFoundError("Khong tim thay san");
    const result = await adminRepository.updateAdminCourt(id, input);
    if (!result) throw new NotFoundError("Khong tim thay san");
    await recordAdminAction(actorId, "COURT_ADMIN_UPDATED", "COURT", id, {
      activeStatus: input.activeStatus,
      verified: input.verified,
      featured: input.featured,
      adminNote: input.adminNote
    });
    return result;
  },

  async requestCourtUpdate(actorId: string, id: string, note: string) {
    const result = await adminRepository.requestCourtUpdate(id, actorId, note);
    if (!result) throw new NotFoundError("Khong tim thay san");
    await recordAdminAction(actorId, "COURT_UPDATE_REQUESTED", "COURT", id, { note });
    return result;
  },

  pendingCourts() { return adminRepository.pendingCourts(); },
  async approveCourt(actorId: string, id: string) {
    const result = await adminRepository.setCourtApproval(id, "APPROVED", undefined);
    await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "APPROVED", actorId });
    await recordAdminAction(actorId, "COURT_APPROVED", "COURT", id);
    return result;
  },
  async rejectCourt(actorId: string, id: string, reason: string) {
    const result = await adminRepository.setCourtApproval(id, "REJECTED", reason);
    await adminRepository.addModerationHistory({ entityType: "COURT", entityId: id, action: "REJECTED", reason, actorId });
    await recordAdminAction(actorId, "COURT_REJECTED", "COURT", id, { reason });
    return result;
  },

  categories() { return adminRepository.categories(); },
  async createCategory(actorId: string, input: any) {
    const result = await adminRepository.createCategory({ ...input, slug: input.slug ?? slugify(input.name) });
    await recordAdminAction(actorId, "CATEGORY_CREATED", "CATEGORY", result.id, { name: result.name });
    return result;
  },
  async updateCategory(actorId: string, id: string, input: any) {
    const result = await adminRepository.updateCategory(id, { ...input, slug: input.slug ?? (input.name ? slugify(input.name) : undefined) });
    await recordAdminAction(actorId, "CATEGORY_UPDATED", "CATEGORY", id, input);
    return result;
  },
  async deleteCategory(actorId: string, id: string) {
    const result = await adminRepository.deleteCategory(id);
    await recordAdminAction(actorId, "CATEGORY_DISABLED", "CATEGORY", id);
    return result;
  },

  reviews() { return adminRepository.reviews(); },
  async hideReview(actorId: string, id: string) { const result = await adminRepository.setReviewDisplay(id, "HIDDEN"); await recordAdminAction(actorId, "REVIEW_HIDDEN", "REVIEW", id); return result; },
  async showReview(actorId: string, id: string) { const result = await adminRepository.setReviewDisplay(id, "VISIBLE"); await recordAdminAction(actorId, "REVIEW_SHOWN", "REVIEW", id); return result; },
  async deleteReview(actorId: string, id: string) { const result = await adminRepository.deleteReview(id); await recordAdminAction(actorId, "REVIEW_DELETED", "REVIEW", id); return result; },

  reports() { return adminRepository.reports(); },
  async resolveReport(actorId: string, id: string) { const result = await adminRepository.setReportStatus(id, "RESOLVED"); await recordAdminAction(actorId, "REPORT_RESOLVED", "REPORT", id); return result; },
  async rejectReport(actorId: string, id: string) { const result = await adminRepository.setReportStatus(id, "REJECTED"); await recordAdminAction(actorId, "REPORT_REJECTED", "REPORT", id); return result; },

  async statistics() {
    const [bookings, courtsByCity, reviews] = await adminRepository.statistics();
    return { bookings: bookings.map(x => ({ ...x, _sum: { totalPrice: Number(x._sum?.totalPrice ?? 0) } })), courtsByCity, reviews };
  },

  async vouchers(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.vouchers(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined
    });
    return paginatedRaw(items, count, page, limit);
  },
  async setVoucherStatus(actorId: string, id: string, status: "ACTIVE" | "DISABLED", reason?: string) {
    if (!(await adminRepository.setVoucherStatus(id, status))) throw new NotFoundError("Khong tim thay voucher");
    await adminRepository.addModerationHistory({ entityType: "VOUCHER", entityId: id, action: status, reason, actorId });
    await recordAdminAction(actorId, `VOUCHER_${status}`, "VOUCHER", id, { reason });
    if (status === "ACTIVE") {
      const [publicVoucher] = await voucherRepository.findActiveById(id);
      if (publicVoucher) realtimeService.toPublic(realtimeEvents.voucherNew, publicVoucher);
    }
    return { id, status };
  },

  async voucherDetail(id: string) {
    const voucher = await adminRepository.voucherDetail(id);
    if (!voucher) throw new NotFoundError("Voucher not found");
    return voucher;
  },
  async createVoucher(actorId: string, input: any) {
    const result = await adminRepository.createVoucher(input);
    await recordAdminAction(actorId, "VOUCHER_CREATED", "VOUCHER", result.id, { code: input.code });
    return result;
  },
  async updateVoucher(actorId: string, id: string, input: any) {
    await adminRepository.updateVoucher(id, input);
    await recordAdminAction(actorId, "VOUCHER_UPDATED", "VOUCHER", id, { code: input.code });
    return { id };
  },

  async pendingBlogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.pendingBlogs(page, limit, {
      search: query.search || undefined,
      status: query.status || "PENDING",
      authorRole: query.authorRole || undefined
    });
    return paginatedRaw(items, count, page, limit);
  },
  async moderateBlog(actorId: string, id: string, status: "PUBLISHED" | "REJECTED", reason?: string) {
    if (!(await adminRepository.moderateBlog(id, status))) throw new ValidationError("Bai viet khong con cho duyet");
    await adminRepository.addModerationHistory({ entityType: "BLOG", entityId: id, action: status, reason, actorId });
    await recordAdminAction(actorId, `BLOG_${status}`, "BLOG", id, { reason });
    return { id, status };
  },
  async hideBlog(actorId: string, id: string, reason?: string) {
    if (!(await adminRepository.hideBlog(id))) throw new ValidationError("Bai viet khong the an (chi an bai da xuat ban)");
    await adminRepository.addModerationHistory({ entityType: "BLOG", entityId: id, action: "HIDDEN", reason, actorId });
    await recordAdminAction(actorId, "BLOG_HIDDEN", "BLOG", id, { reason });
    return { id, status: "HIDDEN" };
  },

  async pendingTournaments(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, count] = await adminRepository.pendingTournaments(page, limit, query.search || undefined);
    return paginatedRaw(items, count, page, limit);
  },
  async moderateTournament(actorId: string, id: string, status: "APPROVED" | "REJECTED", reason?: string) {
    if (!(await adminRepository.moderateTournament(id, status))) throw new ValidationError("Giai dau khong con cho duyet");
    await adminRepository.addModerationHistory({ entityType: "TOURNAMENT", entityId: id, action: status, reason, actorId });
    await recordAdminAction(actorId, `TOURNAMENT_${status}`, "TOURNAMENT", id, { reason });
    return { id, status };
  },

  async auditLogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.auditLogs(page, limit, {
      search: query.search || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },
  verifyAuditLogs() { return verifyAuditChain(); },
  async blockchainLogs(query: any) {
    const page = parsePage(query.page), limit = parseLimit(query.limit);
    const [items, total] = await adminRepository.blockchainLogs(page, limit, {
      search: query.search || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    return { items, meta: paginationMeta(page, limit, total) };
  },
  async retryBlockchainLog(actorId: string, id: string) {
    const result = await adminRepository.retryBlockchainLog(id);
    await recordAdminAction(actorId, "BLOCKCHAIN_LOG_RETRIED", "BLOCKCHAIN_LOG", id);
    return result;
  }
};
