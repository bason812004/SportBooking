import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { bookingBillInclude, bookingBillSelect } from "../../shared/utils/bookingServices.js";
import { settlementService } from "../settlements/settlement.service.js";
import { voucherRepository } from "../vouchers/voucher.repository.js";
import type { normalizeVoucherTerms } from "../vouchers/voucher.terms.js";

/** Where a write runs: the transaction a service opened (so it commits with its audit entry), or the pool. */
type Db = Prisma.TransactionClient | typeof prisma;

/** Terms as stored (see normalizeVoucherTerms) plus the one court a platform voucher may be limited to. */
export type AdminVoucherTerms = ReturnType<typeof normalizeVoucherTerms> & { courtId: string | null };

/** Who an admin notification campaign goes to (see campaignRecipientIds). */
export type CampaignAudience = {
  targetType: string;
  targetRole?: string;
  targetUserId?: string;
  targetPartnerId?: string;
};

export type AdminVoucherRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minBookingAmount: number;
  usedCount: number;
  usageLimit: number | null;
  startDate: Date;
  endDate: Date;
  status: string;
  partnerId: string | null;
  partnerUserId: string | null;
  businessName: string | null;
  lockedByAdmin: boolean;
  lockReason: string | null;
  fundedBy: "PARTNER" | "PLATFORM" | "SHARED";
  courtId: string | null;
  courtName: string | null;
  applicableDays: string | null;
  startTime: string | null;
  endTime: string | null;
  holidayOnly: boolean;
  holidayDates: string[];
  applicableStartDate: string | null;
  applicableEndDate: string | null;
};

/** An ACTIVE voucher past its end date reads as EXPIRED, as on the partner page; customers already cannot use it. */
const shownVoucherStatus = Prisma.sql`case when v.status = 'ACTIVE'::voucher_status and v.end_date < now() then 'EXPIRED' else v.status::text end`;
/** The last admin decision on the voucher was to disable it (partners' own on/off is not moderation history). */
const voucherLockedByAdmin = Prisma.sql`coalesce((
  select mh.action = 'DISABLED' from moderation_history mh
  where mh.entity_type = 'VOUCHER' and mh.entity_id = v.id
  order by mh.created_at desc limit 1
), false)`;
/** The reason the admin gave for disabling it, while that is still their last decision. */
const voucherLockReason = Prisma.sql`(
  select case when mh.action = 'DISABLED' then mh.reason end from moderation_history mh
  where mh.entity_type = 'VOUCHER' and mh.entity_id = v.id
  order by mh.created_at desc limit 1
)`;
/** A voucher's conditions as the forms and cards read them (dates as YYYY-MM-DD, times as HH:mm). */
const voucherConditionColumns = Prisma.sql`
  v.applicable_days as "applicableDays",
  to_char(v.start_time, 'HH24:MI') as "startTime",
  to_char(v.end_time, 'HH24:MI') as "endTime",
  coalesce(v.holiday_only, false) as "holidayOnly",
  coalesce((select array_agg(to_char(d, 'YYYY-MM-DD') order by d) from unnest(v.holiday_dates) d), '{}'::text[]) as "holidayDates",
  to_char(v.applicable_start_date at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as "applicableStartDate",
  to_char(v.applicable_end_date at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as "applicableEndDate"`;

/**
 * When a booking's refund counts for the finance month: its cancellation, else the day it was to be played. Not
 * updated_at, which any later edit of the booking moves and would shift the refund into another month.
 */
const REFUND_MOMENT = "coalesce(b.cancelled_at, b.booking_date::timestamptz, b.created_at)";

const columnExistsCache = new Map<string, boolean>();

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

async function columnExists(tableName: string, columnName: string) {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const [row] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    select exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `;
  const exists = Boolean(row?.exists);
  columnExistsCache.set(cacheKey, exists);
  return exists;
}

function bookingWhere(filters: {
  search?: string;
  fromDate?: string;
  toDate?: string;
  courtId?: string;
  partnerId?: string;
  userId?: string;
  bookingStatus?: string;
  paymentStatus?: string;
}) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    clauses.push(clause.replace("?", `$${values.length}`));
  };

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const index = values.length;
    clauses.push(`(
      b.booking_code ilike $${index}
      or u.full_name ilike $${index}
      or u.email ilike $${index}
      or u.phone ilike $${index}
      or c.name ilike $${index}
      or p.business_name ilike $${index}
    )`);
  }
  if (filters.fromDate) add("b.booking_date >= ?::date", filters.fromDate);
  if (filters.toDate) add("b.booking_date <= ?::date", filters.toDate);
  if (filters.courtId) add("b.court_id = ?", filters.courtId);
  if (filters.partnerId) add("c.partner_id = ?", filters.partnerId);
  if (filters.userId) add("b.user_id = ?", filters.userId);
  if (filters.bookingStatus) add("b.booking_status::text = ?", filters.bookingStatus);
  if (filters.paymentStatus) add("b.payment_status::text = ?", filters.paymentStatus);

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    values
  };
}

const BOOKING_SORT_COLUMNS: Record<string, string> = {
  bookingCode: "b.booking_code",
  customerName: "u.full_name",
  bookingDate: "b.booking_date",
  totalPrice: "b.total_price",
  bookingStatus: "b.booking_status::text",
  paymentStatus: "b.payment_status::text"
};

function bookingOrderBy(sortBy?: string, sortOrder?: string) {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  const column = sortBy && BOOKING_SORT_COLUMNS[sortBy] ? BOOKING_SORT_COLUMNS[sortBy] : BOOKING_SORT_COLUMNS.bookingDate;
  if (column === BOOKING_SORT_COLUMNS.bookingDate) {
    return `b.booking_date ${direction}, b.start_time ${direction}, b.created_at desc`;
  }
  return `${column} ${direction}, b.created_at desc`;
}

type BookingListFilters = Parameters<typeof bookingWhere>[0] & { sortBy?: string; sortOrder?: string };

const BOOKING_LIST_COLUMNS = `
  select
    b.id,
    b.booking_code as "bookingCode",
    b.booking_date as "bookingDate",
    b.start_time as "startTime",
    b.end_time as "endTime",
    b.total_price::float as "totalPrice",
    b.deposit_amount::float as "depositAmount",
    b.refund_amount::float as "refundAmount",
    b.platform_retained_amount::float as "platformRetainedAmount",
    b.payment_method::text as "paymentMethod",
    b.payment_status::text as "paymentStatus",
    b.booking_status::text as "bookingStatus",
    b.cancel_reason as "cancelReason",
    b.admin_note as "adminNote",
    b.created_at as "createdAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'phone', u.phone) as "user",
    json_build_object(
      'id', c.id,
      'name', c.name,
      'address', c.address,
      'city', c.city,
      'district', c.district,
      'partner', json_build_object('id', p.id, 'businessName', p.business_name)
    ) as "court"`;

const BOOKING_LIST_FROM = `
  from bookings b
  join users u on u.id = b.user_id
  join courts c on c.id = b.court_id
  join partner_profiles p on p.id = c.partner_id`;

function adminCourtWhere(filters: {
  search?: string;
  partnerId?: string;
  city?: string;
  district?: string;
  approvalStatus?: string;
  activeStatus?: string;
  verified?: string;
  featured?: string;
}) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    values.push(value);
    clauses.push(clause.replace("?", `$${values.length}`));
  };

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const index = values.length;
    clauses.push(`(c.name ilike $${index} or c.address ilike $${index} or p.business_name ilike $${index})`);
  }
  if (filters.partnerId) add("c.partner_id = ?", filters.partnerId);
  if (filters.city) add("c.city ilike ?", `%${filters.city}%`);
  if (filters.district) {
    // Area filter: courts registered after the 2025 reform only have a ward, older ones a district.
    values.push(`%${filters.district}%`);
    const index = values.length;
    clauses.push(`(c.district ilike $${index} or c.ward ilike $${index})`);
  }
  if (filters.approvalStatus) add("c.approval_status::text = ?", filters.approvalStatus);
  if (filters.activeStatus) add("c.active_status::text = ?", filters.activeStatus);
  if (filters.verified) add("c.verified = ?::boolean", filters.verified);
  if (filters.featured) add("c.featured = ?::boolean", filters.featured);

  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", values };
}

const COURT_SORT_COLUMNS: Record<string, string> = {
  name: "c.name",
  businessName: "p.business_name",
  city: "c.city",
  minPrice: "price.min_price",
  approvalStatus: "c.approval_status::text",
  activeStatus: "c.active_status::text",
  updateRequestedAt: "c.update_requested_at"
};

function adminCourtOrderBy(sortBy?: string, sortOrder?: string) {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  const column = sortBy ? COURT_SORT_COLUMNS[sortBy] : undefined;
  if (!column) return "c.created_at desc";
  if (column === COURT_SORT_COLUMNS.city) {
    return `c.city ${direction}, c.district ${direction}, c.created_at desc`;
  }
  return `${column} ${direction}, c.created_at desc`;
}

const USER_SORT_FIELDS = new Set(["fullName", "email", "role", "status", "createdAt"]);

function userOrderBy(sortBy?: string, sortOrder?: string): Prisma.UserOrderByWithRelationInput {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  if (sortBy && USER_SORT_FIELDS.has(sortBy)) {
    return { [sortBy]: direction };
  }
  return { createdAt: "desc" };
}

const FINANCE_TX_SORT_COLUMNS: Record<string, string> = {
  bookingCode: "b.booking_code",
  transactionType: "ct.transaction_type",
  eventType: "ct.event_type",
  grossAmount: "ct.gross_amount",
  commissionAmount: "ct.commission_amount",
  netAmount: "ct.net_amount"
};

function financeTransactionOrderBy(sortBy?: string, sortOrder?: string) {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  const column = sortBy ? FINANCE_TX_SORT_COLUMNS[sortBy] : undefined;
  if (!column) return "ct.created_at desc";
  return `${column} ${direction}, ct.created_at desc`;
}

const FINANCE_REFUND_SORT_COLUMNS: Record<string, string> = {
  bookingCode: "b.booking_code",
  customerName: "u.full_name",
  totalPrice: "b.total_price",
  refundAmount: "b.refund_amount",
  platformRetainedAmount: "b.platform_retained_amount",
  paymentStatus: "b.payment_status::text"
};

function financeRefundOrderBy(sortBy?: string, sortOrder?: string) {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  const column = sortBy ? FINANCE_REFUND_SORT_COLUMNS[sortBy] : undefined;
  if (!column) return `${REFUND_MOMENT} desc`;
  return `${column} ${direction}, ${REFUND_MOMENT} desc`;
}

const AUDIT_LOG_SORT_FIELDS = new Set(["action", "entityType", "createdAt"]);

function auditLogOrderBy(sortBy?: string, sortOrder?: string): Prisma.AuditLogOrderByWithRelationInput {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  if (sortBy === "actorName") return { actor: { fullName: direction } };
  if (sortBy && AUDIT_LOG_SORT_FIELDS.has(sortBy)) return { [sortBy]: direction };
  return { createdAt: "desc" };
}

const BLOCKCHAIN_LOG_SORT_FIELDS = new Set(["entityType", "network", "status", "attempts", "createdAt"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuditLogFilters = {
  search?: string;
  action?: string;
  entityType?: string;
  /** SYSTEM: entries without an actor. */
  actorRole?: UserRoleFilter;
  from?: Date;
  to?: Date;
  sortBy?: string;
  sortOrder?: string;
};
type UserRoleFilter = "ADMIN" | "PARTNER" | "RECIPIENT" | "USER" | "SYSTEM";

const reportInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  court: {
    select: { id: true, name: true, approvalStatus: true, activeStatus: true, partner: { select: { id: true, businessName: true } } }
  },
  resolver: { select: { id: true, fullName: true } }
} as const;

function blockchainLogOrderBy(sortBy?: string, sortOrder?: string): Prisma.BlockchainLogOrderByWithRelationInput {
  const direction = sortOrder === "asc" ? "asc" : "desc";
  if (sortBy && BLOCKCHAIN_LOG_SORT_FIELDS.has(sortBy)) return { [sortBy]: direction };
  return { createdAt: "desc" };
}

export const adminRepository = {
  /** One transaction for an admin action: the service passes `tx` to each write and to recordAdminAction. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(work, { timeout: 15_000 });
  },

  dashboard() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return Promise.all([
      prisma.user.count(),
      prisma.partnerProfile.count(),
      prisma.court.count(),
      prisma.booking.count(),
      prisma.booking.aggregate({ where: { paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { totalPrice: true, refundAmount: true } }),
      prisma.commissionTransaction.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { commissionAmount: true, netAmount: true } }),
      prisma.court.count({ where: { approvalStatus: "PENDING" } }),
      prisma.partnerProfile.count({ where: { approvalStatus: "PENDING" } }),
      prisma.booking.groupBy({
        by: ["bookingDate"],
        where: { bookingDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)) } },
        _count: true,
        _sum: { totalPrice: true },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.court.findMany({
        where: { approvalStatus: "PENDING" },
        include: { category: true, partner: { select: { businessName: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);
  },

  users(page: number, limit: number, filters: { search?: string; role?: any; status?: any; sortBy?: string; sortOrder?: string }) {
    const where: Prisma.UserWhereInput = {
      role: filters.role,
      status: filters.status,
      OR: filters.search
        ? [
            { fullName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } }
          ]
        : undefined
    };
    return Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
          partnerProfile: { select: { businessName: true } },
          managedCourt: { select: { name: true } }
        },
        orderBy: userOrderBy(filters.sortBy, filters.sortOrder),
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);
  },

  async bookings(page: number, limit: number, filters: BookingListFilters) {
    const { where, values } = bookingWhere(filters);
    const orderBy = bookingOrderBy(filters.sortBy, filters.sortOrder);
    const listValues = [...values, limit, (page - 1) * limit];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const [items, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
      ${BOOKING_LIST_COLUMNS}
      ${BOOKING_LIST_FROM}
      ${where}
      order by ${orderBy}
      limit $${limitIndex} offset $${offsetIndex}
    `, ...listValues),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      ${BOOKING_LIST_FROM}
      ${where}
    `, ...values)
    ]);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  /** Ids of every booking matching the list filters, in the list's SQL order. */
  async bookingIds(filters: BookingListFilters) {
    const { where, values } = bookingWhere(filters);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      select b.id
      ${BOOKING_LIST_FROM}
      ${where}
      order by ${bookingOrderBy(filters.sortBy, filters.sortOrder)}
    `, ...values);
    return rows.map((row) => row.id);
  },

  /** List rows for the given ids, in no particular order. */
  async bookingsByIds(ids: string[]) {
    if (!ids.length) return [];
    return prisma.$queryRawUnsafe<any[]>(`
      ${BOOKING_LIST_COLUMNS}
      ${BOOKING_LIST_FROM}
      where b.id = any($1::text[])
    `, ids);
  },

  /** Bill columns of the given bookings, for bill totals and sorting by them. */
  async bookingBillRows(ids: string[]) {
    if (!ids.length) return [];
    return prisma.booking.findMany({ where: { id: { in: ids } }, select: bookingBillSelect });
  },

  /** One booking with what withBookingBill needs (service names, PAID checkout payments). */
  bookingBillRow(id: string) {
    return prisma.booking.findUnique({ where: { id }, include: bookingBillInclude });
  },

  async bookingFilterOptions() {
    const [partners, courts] = await Promise.all([
      prisma.partnerProfile.findMany({ select: { id: true, businessName: true }, orderBy: { businessName: "asc" } }),
      prisma.court.findMany({ select: { id: true, name: true, partnerId: true }, orderBy: { name: "asc" } })
    ]);
    return { partners, courts };
  },

  async bookingDetail(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      select
        b.id,
        b.booking_code as "bookingCode",
        b.booking_date as "bookingDate",
        b.start_time as "startTime",
        b.end_time as "endTime",
        b.total_price::float as "totalPrice",
        b.deposit_amount::float as "depositAmount",
        b.refund_amount::float as "refundAmount",
        b.platform_retained_amount::float as "platformRetainedAmount",
        b.payment_method::text as "paymentMethod",
        b.payment_status::text as "paymentStatus",
        b.booking_status::text as "bookingStatus",
        b.cancel_reason as "cancelReason",
        b.admin_note as "adminNote",
        b.created_at as "createdAt",
        b.updated_at as "updatedAt",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'phone', u.phone, 'status', u.status::text) as "user",
        json_build_object(
          'id', c.id,
          'name', c.name,
          'address', c.address,
          'city', c.city,
          'district', c.district,
          'partner', json_build_object(
            'id', p.id,
            'businessName', p.business_name,
            'address', p.address,
            'user', json_build_object('id', pu.id, 'fullName', pu.full_name, 'email', pu.email, 'phone', pu.phone)
          )
        ) as "court",
        coalesce(actions.items, '[]'::json) as "adminActions"
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      join users pu on pu.id = p.user_id
      left join lateral (
        select json_agg(json_build_object(
          'id', baa.id,
          'action', baa.action,
          'note', baa.note,
          'previousStatus', baa.previous_status,
          'newStatus', baa.new_status,
          'createdAt', baa.created_at,
          'actor', json_build_object('id', au.id, 'fullName', au.full_name, 'email', au.email)
        ) order by baa.created_at desc) as items
        from booking_admin_actions baa
        join users au on au.id = baa.actor_id
        where baa.booking_id = b.id
      ) actions on true
      where b.id = $1
    `, id);
    return rows[0] ?? null;
  },

  async updateBookingAdmin(actorId: string, id: string, input: any, action: string, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const beforeRows = await tx.$queryRawUnsafe<any[]>(`
        select booking_status::text as "bookingStatus", payment_status::text as "paymentStatus",
          refund_amount::float as "refundAmount",
          platform_retained_amount::float as "platformRetainedAmount", admin_note as "adminNote",
          total_price::float as "totalPrice", cancel_reason as "cancelReason"
        from bookings where id = $1 for update
      `, id);
      const before = beforeRows[0];
      if (!before) return null;

      const sets: string[] = [];
      const values: unknown[] = [];
      const add = (column: string, value: unknown, cast = "") => {
        values.push(value);
        sets.push(`${column} = $${values.length}${cast}`);
      };
      if (input.bookingStatus !== undefined) add("booking_status", input.bookingStatus, "::booking_status");
      if (input.paymentStatus !== undefined) add("payment_status", input.paymentStatus, "::payment_status");
      if (input.adminNote !== undefined) add("admin_note", input.adminNote);
      if (input.cancelReason !== undefined) add("cancel_reason", input.cancelReason);
      if (input.refundAmount !== undefined) add("refund_amount", input.refundAmount);
      if (input.platformRetainedAmount !== undefined) add("platform_retained_amount", input.platformRetainedAmount);
      if (input.bookingStatus === "CANCELLED" && !before.cancelReason) sets.push("cancelled_at = coalesce(cancelled_at, now())");

      values.push(id);
      const idIndex = values.length;
      const updatedRows = await tx.$queryRawUnsafe<any[]>(`
        update bookings
        set ${sets.join(", ")}, updated_at = now()
        where id = $${idIndex}
        returning id, booking_code as "bookingCode", booking_status::text as "bookingStatus",
          payment_status::text as "paymentStatus", admin_note as "adminNote", refund_amount::float as "refundAmount",
          platform_retained_amount::float as "platformRetainedAmount"
      `, ...values);
      const updated = updatedRows[0];

      await tx.$executeRawUnsafe(`
        insert into booking_admin_actions (booking_id, actor_id, action, note, previous_status, new_status)
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `, id, actorId, action, input.actionNote ?? input.adminNote ?? input.cancelReason ?? null, JSON.stringify(before), JSON.stringify(updated));

      // Settlement only moves on a real status change, and only through settlementService, like the partner and
      // staff flows: it checks the wallet, offsets commission debt and returns the settlement the service layer
      // pushes over realtime.
      const statusChanged = input.bookingStatus !== undefined && input.bookingStatus !== before.bookingStatus;
      let settlement = null;
      if (statusChanged && (input.bookingStatus === "COMPLETED" || input.bookingStatus === "NO_SHOW")) {
        settlement = await settlementService.settleForBooking(id, tx);
        if (input.bookingStatus === "COMPLETED") await settlementService.chargePartnerCollected(id, tx);
      } else if (statusChanged && input.bookingStatus === "CANCELLED") {
        await voucherRepository.releaseVoucherUses([id], tx);
        settlement = await settlementService.cancelForBooking(id, tx);
      }

      return { ...updated, settlement };
    };
    return db ? run(db) : prisma.$transaction(run);
  },

  async adminCourts(page: number, limit: number, filters: {
    search?: string;
    partnerId?: string;
    city?: string;
    district?: string;
    approvalStatus?: string;
    activeStatus?: string;
    verified?: string;
    featured?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { where, values } = adminCourtWhere(filters);
    const orderBy = adminCourtOrderBy(filters.sortBy, filters.sortOrder);
    const listValues = [...values, limit, (page - 1) * limit];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const [items, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
      select
        c.id, c.name, c.slug, c.address, c.city, c.district, c.ward,
        c.approval_status::text as "approvalStatus",
        c.active_status::text as "activeStatus",
        c.verified, c.featured,
        c.admin_note as "adminNote",
        c.update_request_note as "updateRequestNote", c.admin_locked_at as "adminLockedAt", c.admin_lock_reason as "adminLockReason",
        c.update_requested_at as "updateRequestedAt",
        c.created_at as "createdAt",
        json_build_object('id', p.id, 'businessName', p.business_name, 'user', json_build_object('fullName', u.full_name, 'email', u.email, 'phone', u.phone)) as partner,
        img.image_url as "imageUrl",
        coalesce(price.min_price, 0)::float as "minPrice"
      from courts c
      join partner_profiles p on p.id = c.partner_id
      join users u on u.id = p.user_id
      left join lateral (
        select image_url from court_images where court_id = c.id order by sort_order asc limit 1
      ) img on true
      left join lateral (
        select min(price) as min_price from court_prices where court_id = c.id
      ) price on true
      ${where}
      order by ${orderBy}
      limit $${limitIndex} offset $${offsetIndex}
    `, ...listValues),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from courts c
      join partner_profiles p on p.id = c.partner_id
      join users u on u.id = p.user_id
      ${where}
    `, ...values)
    ]);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  async adminCourtDetail(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      select
        c.*,
        c.contact_phone as "contactPhone",
        c.contact_email as "contactEmail",
        c.map_url as "mapUrl",
        c.opening_time as "openingTime",
        c.closing_time as "closingTime",
        c.court_count as "courtCount",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        c.approval_status::text as "approvalStatus",
        c.active_status::text as "activeStatus",
        c.admin_note as "adminNote",
        c.update_request_note as "updateRequestNote", c.admin_locked_at as "adminLockedAt", c.admin_lock_reason as "adminLockReason",
        c.update_requested_at as "updateRequestedAt",
        json_build_object('id', p.id, 'businessName', p.business_name, 'address', p.address, 'user', json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'phone', u.phone)) as partner,
        json_build_object('id', cc.id, 'name', cc.name, 'slug', cc.slug) as category,
        coalesce(images.items, '[]'::json) as images,
        coalesce(prices.items, '[]'::json) as prices,
        coalesce(services.items, '[]'::json) as services
      from courts c
      join partner_profiles p on p.id = c.partner_id
      join users u on u.id = p.user_id
      join court_categories cc on cc.id = c.category_id
      left join lateral (
        select json_agg(json_build_object('id', id, 'imageUrl', image_url, 'sortOrder', sort_order) order by sort_order asc) as items
        from court_images where court_id = c.id
      ) images on true
      left join lateral (
        select json_agg(json_build_object('id', id, 'dayType', day_type::text, 'startTime', start_time, 'endTime', end_time, 'price', price::float, 'note', note) order by day_type, start_time) as items
        from court_prices where court_id = c.id
      ) prices on true
      left join lateral (
        select json_agg(json_build_object('id', id, 'name', name, 'description', description, 'price', price::float, 'status', status::text) order by created_at desc) as items
        from court_services where court_id = c.id
      ) services on true
      where c.id = $1
    `, id);
    return rows[0] ?? null;
  },

  async updateAdminCourt(id: string, input: any, db: Db = prisma) {
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown, cast = "") => {
      values.push(value);
      sets.push(`${column} = $${values.length}${cast}`);
    };
    if (input.activeStatus !== undefined) {
      add("active_status", input.activeStatus, "::court_active_status");
      // An admin lock outlasts the partner's own pause/resume; opening the court lifts it.
      if (input.activeStatus === "INACTIVE") {
        sets.push("admin_locked_at = now()");
        add("admin_lock_reason", input.lockReason ?? null);
      } else {
        sets.push("admin_locked_at = null", "admin_lock_reason = null");
      }
    }
    if (input.verified !== undefined) add("verified", input.verified);
    if (input.featured !== undefined) add("featured", input.featured);
    if (input.adminNote !== undefined) add("admin_note", input.adminNote);
    values.push(id);
    const idIndex = values.length;
    const rows = await db.$queryRawUnsafe<any[]>(`
      update courts set ${sets.join(", ")}, updated_at = now()
      where id = $${idIndex}
      returning id, name, partner_id as "partnerId", active_status::text as "activeStatus", verified, featured, admin_note as "adminNote",
        admin_locked_at as "adminLockedAt", admin_lock_reason as "adminLockReason"
    `, ...values);
    return rows[0] ?? null;
  },

  async requestCourtUpdate(id: string, actorId: string, note: string, db: Db = prisma) {
    const rows = await db.$queryRawUnsafe<any[]>(`
      update courts set update_request_note = $1, update_requested_at = now(), updated_at = now()
      where id = $2
      returning id, name, partner_id as "partnerId", update_request_note as "updateRequestNote", update_requested_at as "updateRequestedAt"
    `, note, id);
    const court = rows[0];
    if (!court) return null;

    await db.$executeRawUnsafe(`
      insert into notifications (user_id, title, content, type, metadata_json)
      select p.user_id, 'Yêu cầu cập nhật sân', $1, 'COURT_UPDATE_REQUESTED', json_build_object('courtId', $2, 'actorId', $3)
      from partner_profiles p where p.id = $4
    `, `Admin yêu cầu cập nhật thông tin sân ${court.name}: ${note}`, id, actorId, court.partnerId);
    return court;
  },

  async financeTransactions(page: number, limit: number, filters: {
    month: string;
    from: Date;
    to: Date;
    search?: string;
    partnerId?: string;
    transactionType?: string;
    eventType?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const orderBy = financeTransactionOrderBy(filters.sortBy, filters.sortOrder);
    const clauses = ["ct.created_at >= $1", "ct.created_at < $2"];
    const values: unknown[] = [filters.from, filters.to];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      clauses.push(clause.replace("?", `$${values.length}`));
    };
    if (filters.search) {
      values.push(`%${filters.search}%`);
      const index = values.length;
      clauses.push(`(b.booking_code ilike $${index} or c.name ilike $${index} or p.business_name ilike $${index})`);
    }
    if (filters.partnerId) add("ct.partner_id = ?", filters.partnerId);
    if (filters.transactionType) add("ct.transaction_type = ?", filters.transactionType);
    if (filters.eventType) add("ct.event_type = ?", filters.eventType);
    const where = `where ${clauses.join(" and ")}`;
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const [items, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
      select ct.id, ct.booking_id as "bookingId", b.booking_code as "bookingCode",
        b.booking_date as "bookingDate", c.id as "courtId", c.name as "courtName",
        p.id as "partnerId", p.business_name as "businessName",
        ct.transaction_type as "transactionType", ct.event_type as "eventType",
        ct.gross_amount::float as "grossAmount", ct.commission_rate::float as "commissionRate",
        ct.commission_amount::float as "commissionAmount", ct.net_amount::float as "netAmount",
        ct.created_at as "createdAt"
      from commission_transactions ct
      join bookings b on b.id = ct.booking_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = ct.partner_id
      ${where}
      order by ${orderBy}
      limit $${limitIndex} offset $${offsetIndex}
    `, ...values, limit, (page - 1) * limit),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from commission_transactions ct
      join bookings b on b.id = ct.booking_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = ct.partner_id
      ${where}
    `, ...values)
    ]);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  async financeRefunds(page: number, limit: number, filters: {
    from: Date;
    to: Date;
    search?: string;
    partnerId?: string;
    paymentStatus?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const orderBy = financeRefundOrderBy(filters.sortBy, filters.sortOrder);
    const clauses = [
      `${REFUND_MOMENT} >= $1`,
      `${REFUND_MOMENT} < $2`,
      "(b.refund_amount > 0 or b.payment_status::text in ('PARTIALLY_REFUNDED', 'REFUNDED'))"
    ];
    const values: unknown[] = [filters.from, filters.to];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      clauses.push(clause.replace("?", `$${values.length}`));
    };
    if (filters.search) {
      values.push(`%${filters.search}%`);
      const index = values.length;
      clauses.push(`(b.booking_code ilike $${index} or u.full_name ilike $${index} or c.name ilike $${index} or p.business_name ilike $${index})`);
    }
    if (filters.partnerId) add("p.id = ?", filters.partnerId);
    if (filters.paymentStatus) add("b.payment_status::text = ?", filters.paymentStatus);
    const where = `where ${clauses.join(" and ")}`;
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const [items, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
      select b.id, b.booking_code as "bookingCode", b.booking_date as "bookingDate",
        b.total_price::float as "totalPrice", b.deposit_amount::float as "depositAmount",
        b.refund_amount::float as "refundAmount",
        b.platform_retained_amount::float as "platformRetainedAmount",
        b.payment_status::text as "paymentStatus", b.cancel_reason as "cancelReason",
        ${REFUND_MOMENT} as "refundedAt",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "user",
        json_build_object('id', c.id, 'name', c.name, 'partner', json_build_object('id', p.id, 'businessName', p.business_name)) as "court"
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      ${where}
      order by ${orderBy}
      limit $${limitIndex} offset $${offsetIndex}
    `, ...values, limit, (page - 1) * limit),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      ${where}
    `, ...values)
    ]);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  /**
   * One month per partner: the commission ledger (court earnings and commission), refunds, and what the partner was
   * paid out through withdrawals that month, next to the wallet as it stands now. Read-only: partners are paid only
   * through their wallet (Quyết toán, Rút tiền), never from here.
   */
  async financeReconciliation(from: Date, to: Date) {
    return prisma.$queryRawUnsafe<any[]>(`
      with tx as (
        select partner_id, sum(gross_amount)::float as gross_amount,
          sum(commission_amount)::float as commission_amount,
          sum(net_amount)::float as net_amount,
          count(*) filter (where transaction_type = 'EARNING')::int as transaction_count
        from commission_transactions
        where created_at >= $1 and created_at < $2
        group by partner_id
      ),
      refunds as (
        select c.partner_id, sum(b.refund_amount)::float as refund_amount,
          sum(b.platform_retained_amount)::float as platform_retained_amount,
          count(*)::int as refund_count
        from bookings b
        join courts c on c.id = b.court_id
        where ${REFUND_MOMENT} >= $1
          and ${REFUND_MOMENT} < $2
          and b.refund_amount > 0
        group by c.partner_id
      ),
      paid_out as (
        select partner_id, sum(amount)::float as amount, count(*)::int as count
        from withdrawal_requests
        where status = 'PAID' and coalesce(processed_at, updated_at) >= $1 and coalesce(processed_at, updated_at) < $2
        group by partner_id
      )
      select p.id as "partnerId", p.business_name as "businessName",
        coalesce(tx.gross_amount, 0)::float as "grossAmount",
        coalesce(tx.commission_amount, 0)::float as "commissionAmount",
        coalesce(tx.net_amount, 0)::float as "netAmount",
        coalesce(tx.transaction_count, 0)::int as "transactionCount",
        coalesce(refunds.refund_amount, 0)::float as "refundAmount",
        coalesce(refunds.platform_retained_amount, 0)::float as "platformRetainedAmount",
        coalesce(refunds.refund_count, 0)::int as "refundCount",
        coalesce(paid_out.amount, 0)::float as "paidOutAmount",
        coalesce(paid_out.count, 0)::int as "paidOutCount",
        coalesce(w.pending_balance, 0)::float as "walletPending",
        coalesce(w.available_balance, 0)::float as "walletAvailable",
        coalesce(w.commission_debt, 0)::float as "commissionDebt"
      from partner_profiles p
      left join tx on tx.partner_id = p.id
      left join refunds on refunds.partner_id = p.id
      left join paid_out on paid_out.partner_id = p.id
      left join partner_wallets w on w.partner_id = p.id
      where tx.partner_id is not null or refunds.partner_id is not null or paid_out.partner_id is not null
        or coalesce(w.pending_balance, 0) > 0 or coalesce(w.available_balance, 0) > 0 or coalesce(w.commission_debt, 0) > 0
      order by coalesce(tx.net_amount, 0) desc, p.business_name asc
    `, from, to);
  },

  /**
   * The active accounts a campaign goes to. Every account or a whole role leaves out the admin sending it; picking
   * one account or one partner sends to exactly that one.
   */
  campaignRecipientIds(input: CampaignAudience, actorId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
    if (input.targetType === "ALL") {
      return db.$queryRaw<Array<{ id: string }>>`select id from users where status::text = 'ACTIVE' and id <> ${actorId}`;
    }
    if (input.targetType === "ROLE") {
      return db.$queryRaw<Array<{ id: string }>>`
        select id from users where role::text = ${input.targetRole ?? null} and status::text = 'ACTIVE' and id <> ${actorId}
      `;
    }
    if (input.targetType === "USER") {
      return db.$queryRaw<Array<{ id: string }>>`select id from users where id = ${input.targetUserId ?? null} and status::text = 'ACTIVE'`;
    }
    return db.$queryRaw<Array<{ id: string }>>`
      select u.id from partner_profiles pp join users u on u.id = pp.user_id
      where pp.id = ${input.targetPartnerId ?? null} and u.status::text = 'ACTIVE'
    `;
  },

  async notificationCampaigns(page: number, limit: number, filters: { search?: string; type?: string; targetType?: string; targetRole?: string }) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      clauses.push(clause.replace("?", `$${values.length}`));
    };
    if (filters.search) {
      values.push(`%${filters.search}%`);
      const index = values.length;
      clauses.push(`(nc.title ilike $${index} or nc.content ilike $${index} or u.full_name ilike $${index} or u.email ilike $${index})`);
    }
    if (filters.type) add("nc.type = ?", filters.type);
    if (filters.targetType) add("nc.target_type = ?", filters.targetType);
    if (filters.targetRole) add("nc.target_role = ?", filters.targetRole);
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const [items, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
      select
        nc.id,
        nc.title,
        nc.content,
        nc.type,
        nc.target_type as "targetType",
        nc.target_role as "targetRole",
        nc.target_user_id as "targetUserId",
        nc.target_partner_id as "targetPartnerId",
        nc.recipient_count as "recipientCount",
        (select count(*) from notifications n where n.campaign_id = nc.id and n.is_read)::int as "readCount",
        nc.metadata_json as "metadata",
        nc.created_at as "createdAt",
        nc.recalled_at as "recalledAt",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "sender",
        tu.email as "targetUserEmail",
        tu.full_name as "targetUserName",
        pp.business_name as "targetPartnerName"
      from notification_campaigns nc
      left join users u on u.id = nc.sent_by
      left join users tu on tu.id = nc.target_user_id
      left join partner_profiles pp on pp.id = nc.target_partner_id
      ${where}
      order by nc.created_at desc
      limit $${limitIndex} offset $${offsetIndex}
    `, ...values, limit, (page - 1) * limit),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from notification_campaigns nc
      left join users u on u.id = nc.sent_by
      left join users tu on tu.id = nc.target_user_id
      left join partner_profiles pp on pp.id = nc.target_partner_id
      ${where}
    `, ...values)
    ]);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  async notificationCampaignDetail(id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      select
        nc.id,
        nc.title,
        nc.content,
        nc.type,
        nc.target_type as "targetType",
        nc.target_role as "targetRole",
        nc.target_user_id as "targetUserId",
        nc.target_partner_id as "targetPartnerId",
        nc.recipient_count as "recipientCount",
        nc.metadata_json as "metadata",
        nc.created_at as "createdAt",
        nc.recalled_at as "recalledAt",
        nc.recall_reason as "recallReason",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "sender",
        rb.full_name as "recalledByName",
        tu.email as "targetUserEmail",
        tu.full_name as "targetUserName",
        pp.business_name as "targetPartnerName",
        -- Counted over every recipient, not the page of them the dialog lists.
        (select count(*) from notifications n where n.campaign_id = nc.id and n.is_read)::int as "readCount",
        (select count(*) from notifications n where n.campaign_id = nc.id and not n.is_read)::int as "unreadCount"
      from notification_campaigns nc
      left join users u on u.id = nc.sent_by
      left join users rb on rb.id = nc.recalled_by
      left join users tu on tu.id = nc.target_user_id
      left join partner_profiles pp on pp.id = nc.target_partner_id
      where nc.id = $1
    `, id);
    return rows[0] ?? null;
  },

  /** One page of a campaign's recipients with whether and when they read it. */
  async notificationCampaignRecipients(id: string, page: number, limit: number, filters: { search?: string; read?: boolean }) {
    const search = filters.search ? `%${filters.search}%` : null;
    const read = filters.read ?? null;
    const where = Prisma.sql`
      where n.campaign_id = ${id}
        and (${search}::text is null or u.full_name ilike ${search} or u.email ilike ${search})
        and (${read}::boolean is null or n.is_read = ${read})
    `;
    const [items, countRows] = await Promise.all([
      prisma.$queryRaw<any[]>`
        select n.id, n.is_read as "isRead", n.read_at as "readAt", n.created_at as "createdAt",
          json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'role', u.role::text) as "user"
        from notifications n join users u on u.id = n.user_id
        ${where}
        order by n.is_read, u.full_name
        offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`select count(*)::bigint as count from notifications n join users u on u.id = n.user_id ${where}`
    ]);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  /**
   * Marks the campaign recalled and deletes its notifications from every inbox; null when it does not exist or was
   * already recalled. Returns who had it, so their inboxes can refresh.
   */
  recallNotificationCampaign(id: string, actorId: string, reason: string, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const marked = await tx.$executeRaw`
        update notification_campaigns
        set recalled_at = now(), recalled_by = ${actorId}, recall_reason = ${reason}
        where id = ${id} and recalled_at is null
      `;
      if (!marked) return null;
      const removed = await tx.$queryRaw<Array<{ userId: string }>>`
        delete from notifications where campaign_id = ${id} returning user_id as "userId"
      `;
      return removed.map((row) => row.userId);
    };
    return db ? run(db) : prisma.$transaction(run);
  },

  async createNotificationCampaign(actorId: string, input: {
    title: string;
    content: string;
    type: string;
    targetType: string;
    targetRole?: string;
    targetUserId?: string;
    targetPartnerId?: string;
    metadata?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const recipientRows = await this.campaignRecipientIds(input, actorId, tx);
      if (!recipientRows.length) return null;

      const campaignRows = await tx.$queryRawUnsafe<any[]>(`
        insert into notification_campaigns (
          title, content, type, target_type, target_role, target_user_id,
          target_partner_id, sent_by, recipient_count, metadata_json
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        returning id, title, content, type, target_type as "targetType",
          target_role as "targetRole", target_user_id as "targetUserId",
          target_partner_id as "targetPartnerId", recipient_count as "recipientCount",
          metadata_json as "metadata", created_at as "createdAt"
      `, input.title, input.content, input.type, input.targetType, input.targetRole ?? null,
        input.targetUserId ?? null, input.targetPartnerId ?? null, actorId,
        recipientRows.length, JSON.stringify(input.metadata ?? {}));
      const campaign = campaignRows[0];

      await tx.$executeRawUnsafe(`
        insert into notifications (user_id, campaign_id, title, content, type, metadata_json)
        select unnest($1::varchar[]), $2, $3, $4, $5, $6::jsonb
      `, recipientRows.map((item) => item.id), campaign.id, input.title, input.content, input.type, JSON.stringify({
        ...(input.metadata ?? {}),
        campaignId: campaign.id,
        targetType: input.targetType
      }));

      return { campaign, recipientIds: recipientRows.map((item) => item.id) };
    };
    return db ? run(db) : prisma.$transaction(run);
  },

  setUserStatus(id: string, status: "ACTIVE" | "LOCKED", db: Db = prisma) {
    return db.user.update({
      where: { id },
      data: { status },
      select: { id: true, fullName: true, email: true, role: true, status: true }
    });
  },

  userById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true, fullName: true, email: true } });
  },

  activeAdminCount() {
    return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  },

  partners(page: number, limit: number, filters: { search?: string; status?: any }) {
    const where: Prisma.PartnerProfileWhereInput = {
      approvalStatus: filters.status,
      OR: filters.search
        ? [
            { businessName: { contains: filters.search, mode: "insensitive" } },
            { taxCode: { contains: filters.search, mode: "insensitive" } },
            { user: { fullName: { contains: filters.search, mode: "insensitive" } } },
            { user: { email: { contains: filters.search, mode: "insensitive" } } },
            { user: { phone: { contains: filters.search, mode: "insensitive" } } }
          ]
        : undefined
    };
    return Promise.all([
      prisma.partnerProfile.findMany({
        where,
        // No bank account numbers in the list: the service only uses the review fields to count gaps.
        select: {
          id: true,
          businessName: true,
          approvalStatus: true,
          verificationDocumentUrl: true,
          taxCode: true,
          bankAccountHolder: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true, phone: true, status: true, emailVerified: true } },
          _count: { select: { courts: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.partnerProfile.count({ where })
    ]);
  },

  partnerDetail(id: string) {
    return prisma.partnerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true, emailVerified: true, createdAt: true } },
        courts: { select: { id: true, name: true, approvalStatus: true, activeStatus: true }, orderBy: { createdAt: "asc" } }
      }
    });
  },

  partnerApprovalState(id: string) {
    return prisma.partnerProfile.findUnique({ where: { id }, select: { id: true, userId: true, approvalStatus: true } });
  },

  /** Decides a partner only while it is still pending, so a double click or a second admin cannot decide it twice. */
  async decidePendingPartner(id: string, approvalStatus: "APPROVED" | "REJECTED", db: Db = prisma) {
    const { count } = await db.partnerProfile.updateMany({ where: { id, approvalStatus: "PENDING" }, data: { approvalStatus } });
    return count > 0;
  },

  pendingCourts(page: number, limit: number) {
    const where: Prisma.CourtWhereInput = { approvalStatus: "PENDING" };
    return Promise.all([
      prisma.court.findMany({
        where,
        include: {
          category: true,
          partner: { include: { user: { select: { fullName: true, email: true } } } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          // A newly registered court only has image requests until an admin reviews them.
          imageRequests: { where: { status: "PENDING" }, orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
          _count: { select: { images: true, imageRequests: { where: { status: "PENDING" } } } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.court.count({ where })
    ]);
  },

  async courtReview(id: string) {
    const court = await prisma.court.findUnique({
      where: { id },
      select: {
        id: true, partnerId: true, name: true, slug: true, description: true, address: true, ward: true, district: true, city: true,
        latitude: true, longitude: true, mapUrl: true, contactPhone: true, contactEmail: true, openingTime: true, closingTime: true,
        courtCount: true, approvalStatus: true, activeStatus: true, rejectionReason: true, updateRequestNote: true,
        updateRequestedAt: true, createdAt: true, updatedAt: true, deposit_percent: true,
        category: { select: { id: true, name: true } },
        surfaces: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, surface: true, size: true, status: true } },
        images: { orderBy: { sortOrder: "asc" }, select: { id: true, imageUrl: true, sortOrder: true } },
        imageRequests: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, imageUrl: true, previousImageUrl: true, replaceImageId: true, status: true, reason: true, createdAt: true }
        },
        prices: { orderBy: [{ dayType: "asc" }, { startTime: "asc" }], select: { id: true, dayType: true, startTime: true, endTime: true, price: true, note: true } },
        partner: {
          select: {
            id: true, businessName: true, address: true, approvalStatus: true, taxCode: true, verificationDocumentUrl: true,
            bankName: true, bankAccountNumber: true, bankAccountHolder: true, createdAt: true,
            user: { select: { id: true, fullName: true, email: true, phone: true, emailVerified: true, status: true, createdAt: true } }
          }
        }
      }
    });
    if (!court) return null;
    const [courtStats, duplicateAddressCourts] = await Promise.all([
      prisma.court.groupBy({ by: ["approvalStatus"], where: { partnerId: court.partnerId }, _count: { _all: true } }),
      // The same street address listed by another partner is a classic sign of a copied or fake venue.
      prisma.court.findMany({
        where: {
          id: { not: id },
          partnerId: { not: court.partnerId },
          city: court.city,
          address: { equals: court.address.trim(), mode: "insensitive" },
          ward: court.ward ? { equals: court.ward.trim(), mode: "insensitive" } : null
        },
        select: { id: true, name: true, approvalStatus: true, partner: { select: { businessName: true } } },
        take: 5
      })
    ]);
    return { court, courtStats, duplicateAddressCourts };
  },

  // Checked and written in one statement so a partner rejected meanwhile, or a second admin tab, cannot slip through.
  async approvePendingCourt(id: string, db: Db = prisma) {
    const { count } = await db.court.updateMany({
      where: { id, approvalStatus: "PENDING", partner: { approvalStatus: "APPROVED" } },
      data: { approvalStatus: "APPROVED", rejectionReason: null }
    });
    return count > 0;
  },

  async rejectPendingCourt(id: string, rejectionReason: string, db: Db = prisma) {
    const { count } = await db.court.updateMany({
      where: { id, approvalStatus: "PENDING" },
      data: { approvalStatus: "REJECTED", rejectionReason }
    });
    return count > 0;
  },

  courtApprovalState(id: string) {
    return prisma.court.findUnique({
      where: { id },
      select: { id: true, approvalStatus: true, partner: { select: { approvalStatus: true } } }
    });
  },

  categories() {
    return prisma.courtCategory.findMany({ include: { _count: { select: { courts: true } } }, orderBy: { createdAt: "desc" } });
  },
  categoryById(id: string) {
    return prisma.courtCategory.findUnique({ where: { id } });
  },
  /** Another category already using this name (in any letter case) or this slug. */
  categoryConflict(name: string, slug: string, excludeId?: string) {
    return prisma.courtCategory.findFirst({
      where: {
        OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }],
        NOT: excludeId ? { id: excludeId } : undefined
      },
      select: { id: true }
    });
  },
  createCategory(data: Prisma.CourtCategoryCreateInput, db: Db = prisma) {
    return db.courtCategory.create({ data });
  },
  updateCategory(id: string, data: Prisma.CourtCategoryUpdateInput, db: Db = prisma) {
    return db.courtCategory.update({ where: { id }, data });
  },
  deleteCategory(id: string, db: Db = prisma) {
    return db.courtCategory.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  /** What moderating a review needs: its author to notify, its court, and the content kept in the audit log. */
  reviewForModeration(id: string) {
    return prisma.review.findUnique({
      where: { id },
      select: {
        id: true, userId: true, courtId: true, rating: true, comment: true, displayStatus: true,
        reply: { select: { content: true, authorId: true } },
        court: { select: { name: true, partner: { select: { userId: true } } } }
      }
    });
  },
  /** Moves the display status only from the expected one, so a change made meanwhile is not overridden. */
  async setReviewDisplay(id: string, displayStatus: "VISIBLE" | "HIDDEN", from: "VISIBLE" | "HIDDEN", db: Db = prisma) {
    const { count } = await db.review.updateMany({ where: { id, displayStatus: from }, data: { displayStatus } });
    return count > 0;
  },
  async deleteReview(id: string, db: Db = prisma) {
    const { count } = await db.review.deleteMany({ where: { id } });
    return count > 0;
  },

  /** A page of reports with the count per status (under the same search) and each court's open reports. */
  async reports(page: number, limit: number, filters: { status?: "PENDING" | "RESOLVED" | "REJECTED"; search?: string }) {
    const contains = filters.search ? { contains: filters.search, mode: "insensitive" as const } : undefined;
    const searchWhere: Prisma.ReportWhereInput = contains
      ? {
          OR: [
            { id: contains },
            { reason: contains },
            { description: contains },
            { court: { name: contains } },
            { user: { fullName: contains } },
            { user: { email: contains } }
          ]
        }
      : {};
    const where: Prisma.ReportWhereInput = { ...searchWhere, status: filters.status };
    const [items, total, counts] = await Promise.all([
      prisma.report.findMany({ where, include: reportInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.report.count({ where }),
      prisma.report.groupBy({ by: ["status"], where: searchWhere, _count: { _all: true } })
    ]);
    const courtIds = [...new Set(items.map((item) => item.courtId))];
    const pendingByCourt = courtIds.length
      ? await prisma.report.groupBy({ by: ["courtId"], where: { courtId: { in: courtIds }, status: "PENDING" }, _count: { _all: true } })
      : [];
    return {
      items,
      total,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Record<string, number>,
      pendingByCourt: new Map(pendingByCourt.map((row) => [row.courtId, row._count._all]))
    };
  },
  reportById(id: string) {
    return prisma.report.findUnique({ where: { id }, include: { court: { select: { id: true, name: true } } } });
  },
  /** Decides a report still waiting; false when someone decided it meanwhile. */
  async decideReport(id: string, data: { status: "RESOLVED" | "REJECTED"; resolvedBy: string; adminNote: string | null }, db: Db = prisma) {
    const { count } = await db.report.updateMany({ where: { id, status: "PENDING" }, data: { ...data, resolvedAt: new Date() } });
    return count > 0;
  },

  statistics() {
    return Promise.all([
      prisma.booking.groupBy({ by: ["bookingStatus"], orderBy: { bookingStatus: "asc" }, _count: true, _sum: { totalPrice: true } }),
      prisma.court.groupBy({ by: ["city"], orderBy: { city: "asc" }, _count: true }),
      // Like the court pages, hidden reviews do not count.
      prisma.review.aggregate({ where: { displayStatus: "VISIBLE" }, _avg: { rating: true }, _count: true })
    ]);
  },

  moderationHistory(entityType: string, entityId: string) {
    return prisma.$queryRawUnsafe<any[]>(`
      select
        mh.id,
        mh.entity_type as "entityType",
        mh.entity_id as "entityId",
        mh.action,
        mh.reason,
        mh.actor_id as "actorId",
        mh.created_at as "createdAt",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "actor"
      from moderation_history mh
      left join users u on u.id = mh.actor_id
      where mh.entity_type = $1 and mh.entity_id = $2
      order by mh.created_at desc
    `, entityType, entityId);
  },

  addModerationHistory(data: { entityType: string; entityId: string; action: string; reason?: string; actorId: string }, db: Db = prisma) {
    return db.$queryRawUnsafe<any[]>(`
      insert into moderation_history (entity_type, entity_id, action, reason, actor_id)
      values ($1, $2, $3, $4, $5)
      returning id, entity_type as "entityType", entity_id as "entityId",
        action, reason, actor_id as "actorId", created_at as "createdAt"
    `, data.entityType, data.entityId, data.action, data.reason ?? null, data.actorId);
  },

  vouchers(page: number, limit: number, filters: { search?: string; status?: string }) {
    const search = filters.search ? `%${filters.search}%` : null;
    const where = Prisma.sql`
      where (${filters.status ?? null}::text is null or ${shownVoucherStatus} = ${filters.status ?? null})
        and (${search}::text is null or v.code ilike ${search} or v.title ilike ${search} or p.business_name ilike ${search})
    `;
    return Promise.all([
      prisma.$queryRaw<any[]>`
        select v.id, v.code, v.title, v.discount_type::text as "discountType",
          v.discount_value::float as "discountValue", v.max_discount_amount::float as "maxDiscountAmount",
          v.min_booking_amount::float as "minBookingAmount", v.used_count as "usedCount",
          v.usage_limit as "usageLimit", v.start_date as "startDate", v.end_date as "endDate",
          ${shownVoucherStatus} as status, v.partner_id as "partnerId", p.business_name as "businessName",
          ${voucherLockedByAdmin} as "lockedByAdmin", ${voucherLockReason} as "lockReason",
          v.funded_by::text as "fundedBy", c.name as "courtName", v.created_at as "createdAt",
          ${voucherConditionColumns}
        from vouchers v left join partner_profiles p on p.id = v.partner_id
        left join courts c on c.id = v.court_id
        ${where}
        order by v.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from vouchers v left join partner_profiles p on p.id = v.partner_id
        ${where}
      `
    ]);
  },

  /** Moves the status only from the expected ones, so a change made meanwhile (by the partner, another admin) wins. */
  async setVoucherStatus(id: string, status: "ACTIVE" | "DISABLED", from: string[], db: Db = prisma) {
    const changed = await db.$executeRaw`
      update vouchers set status = ${status}::voucher_status, updated_at = now()
      where id = ${id} and status::text in (${Prisma.join(from)})
    `;
    return changed > 0;
  },

  async voucherDetail(id: string) {
    const [row] = await prisma.$queryRaw<AdminVoucherRow[]>`
      select v.id, v.code, v.title, v.description, v.discount_type::text as "discountType",
        v.discount_value::float as "discountValue", v.max_discount_amount::float as "maxDiscountAmount",
        v.min_booking_amount::float as "minBookingAmount", v.used_count as "usedCount",
        v.usage_limit as "usageLimit", v.start_date as "startDate", v.end_date as "endDate",
        ${shownVoucherStatus} as status, v.partner_id as "partnerId", p.user_id as "partnerUserId",
        p.business_name as "businessName", ${voucherLockedByAdmin} as "lockedByAdmin",
        ${voucherLockReason} as "lockReason", v.funded_by::text as "fundedBy",
        v.court_id as "courtId", c.name as "courtName",
        ${voucherConditionColumns}
      from vouchers v
      left join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      where v.id = ${id}
    `;
    return row ?? null;
  },

  courtExists(id: string) {
    return prisma.court.findUnique({ where: { id }, select: { id: true } });
  },

  /** A platform voucher (no partner), created as a draft. The platform funds its whole discount. */
  async createVoucher(terms: AdminVoucherTerms, db: Db = prisma) {
    const [row] = await db.$queryRaw<Array<{ id: string }>>`
      insert into vouchers (
        court_id, code, title, description, discount_type,
        discount_value, max_discount_amount, min_booking_amount,
        usage_limit, start_date, end_date, status,
        funded_by, partner_funding_percent, platform_funding_percent,
        applicable_days, start_time, end_time, holiday_only, holiday_dates,
        applicable_start_date, applicable_end_date
      ) values (
        ${terms.courtId}::varchar(20), ${terms.code}, ${terms.title}, ${terms.description}::text,
        ${terms.discountType}::voucher_discount_type, ${terms.discountValue},
        ${terms.maxDiscountAmount}::numeric(12,2), ${terms.minBookingAmount},
        ${terms.usageLimit}::integer, ${terms.startDate}, ${terms.endDate}, 'DRAFT'::voucher_status,
        'PLATFORM'::voucher_funded_by, 0, 100,
        ${terms.applicableDays}::varchar(120), ${terms.startTime}::time, ${terms.endTime}::time,
        ${terms.holidayOnly}, ${terms.holidayDates ?? Prisma.sql`null`}::date[],
        ${terms.applicableStartDate}::timestamptz, ${terms.applicableEndDate}::timestamptz
      )
      returning id
    `;
    return row;
  },

  /** Replaces every term of a platform draft; false when it is no longer a platform draft. */
  async updateVoucherDraft(id: string, terms: AdminVoucherTerms, db: Db = prisma) {
    const changed = await db.$executeRaw`
      update vouchers set
        court_id = ${terms.courtId}::varchar(20),
        code = ${terms.code},
        title = ${terms.title},
        description = ${terms.description}::text,
        discount_type = ${terms.discountType}::voucher_discount_type,
        discount_value = ${terms.discountValue},
        max_discount_amount = ${terms.maxDiscountAmount}::numeric(12,2),
        min_booking_amount = ${terms.minBookingAmount},
        usage_limit = ${terms.usageLimit}::integer,
        start_date = ${terms.startDate},
        end_date = ${terms.endDate},
        applicable_days = ${terms.applicableDays}::varchar(120),
        start_time = ${terms.startTime}::time,
        end_time = ${terms.endTime}::time,
        holiday_only = ${terms.holidayOnly},
        holiday_dates = ${terms.holidayDates ?? Prisma.sql`null`}::date[],
        applicable_start_date = ${terms.applicableStartDate}::timestamptz,
        applicable_end_date = ${terms.applicableEndDate}::timestamptz,
        updated_at = now()
      where id = ${id} and partner_id is null and status = 'DRAFT'::voucher_status
    `;
    return changed > 0;
  },

  /**
   * The moderation queue. Private posts are left out: only their author sees them, so they skip review. Waiting
   * posts come oldest first (updated_at is when the author last sent them); the other lists newest first.
   */
  async pendingBlogs(page: number, limit: number, filters: { search?: string; status?: string; authorRole?: string }) {
    const pattern = filters.search ? `%${filters.search}%` : null;
    const status = filters.status && filters.status !== "ALL" ? filters.status : null;
    const where = Prisma.sql`
      where b.visibility = 'PUBLIC'::blog_visibility
        and b.status != 'DRAFT'::blog_post_status
        and (${status}::text is null or b.status::text = ${status})
        and (${filters.authorRole ?? null}::text is null or u.role::text = ${filters.authorRole ?? null})
        and (${pattern}::text is null or b.title ilike ${pattern} or u.full_name ilike ${pattern}
          or u.email ilike ${pattern} or b.content ilike ${pattern})
    `;
    const order = status === "PENDING" ? Prisma.sql`b.updated_at asc` : Prisma.sql`b.updated_at desc`;

    return Promise.all([
      prisma.$queryRaw<any[]>(Prisma.sql`
        select b.id, b.title, b.slug, b.excerpt, b.content, b.cover_image_url as "coverImageUrl",
          b.status::text, b.visibility::text, coalesce(b.allow_comments, true) as "allowComments",
          b.created_at as "createdAt", b.updated_at as "updatedAt", b.published_at as "publishedAt",
          u.full_name as "authorName", u.email as "authorEmail", u.role::text as "authorRole",
          bc.name as "categoryName",
          (select count(*) from blog_comments c where c.post_id = b.id)::int as "commentCount",
          last_decision.action as "lastDecisionAction",
          last_decision.reason as "lastDecisionReason",
          last_decision.created_at as "lastDecisionAt"
        from blog_posts b
        join users u on u.id = b.author_id
        left join blog_categories bc on bc.id = b.category_id
        left join lateral (
          select mh.action, mh.reason, mh.created_at from moderation_history mh
          where mh.entity_type = 'BLOG' and mh.entity_id = b.id
          order by mh.created_at desc limit 1
        ) last_decision on true
        ${where}
        order by ${order} offset ${(page - 1) * limit} limit ${limit}
      `),
      prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        select count(*)::bigint as count from blog_posts b join users u on u.id = b.author_id ${where}
      `),
      // The tabs' counts: every public post by status, whatever the search.
      prisma.$queryRaw<Array<{ status: string; count: number }>>`
        select status::text as status, count(*)::int as count from blog_posts
        where visibility = 'PUBLIC'::blog_visibility and status != 'DRAFT'::blog_post_status
        group by status
      `
    ]);
  },

  blogForModeration(id: string) {
    return prisma.$queryRaw<Array<{ id: string; authorId: string; title: string; slug: string; status: string; visibility: string }>>`
      select id, author_id as "authorId", title, slug, status::text as status, visibility::text as visibility
      from blog_posts where id = ${id} limit 1
    `.then((rows) => rows[0] ?? null);
  },

  /** Every comment of a post, newest first, with the commenter's email for the admin. */
  blogComments(postId: string) {
    return prisma.$queryRaw<any[]>`
      select c.id, c.content, c.is_edited as "isEdited", c.created_at as "createdAt",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'role', u.role::text) as "user"
      from blog_comments c join users u on u.id = c.user_id
      where c.post_id = ${postId}
      order by c.created_at desc
    `;
  },

  /** Deletes one comment of the post; what it said comes back for the audit log, null when it is not there. */
  async deleteBlogComment(postId: string, commentId: string, db: Db = prisma) {
    const [row] = await db.$queryRaw<Array<{ userId: string; content: string }>>`
      delete from blog_comments where id = ${commentId} and post_id = ${postId}
      returning user_id as "userId", content
    `;
    return row ?? null;
  },

  /** Publishing also restores a hidden post; published_at keeps the first publication date. */
  moderateBlog(id: string, status: "PUBLISHED" | "REJECTED", db: Db = prisma) {
    return db.$executeRaw`
      update blog_posts set status = ${status}::blog_post_status,
        published_at = case when ${status} = 'PUBLISHED' then coalesce(published_at, now()) else published_at end, updated_at = now()
      where id = ${id}
        and (
          (${status} = 'PUBLISHED' and status in ('PENDING'::blog_post_status, 'REJECTED'::blog_post_status, 'HIDDEN'::blog_post_status))
          or (${status} = 'REJECTED' and status = 'PENDING'::blog_post_status)
        )
    `;
  },

  hideBlog(id: string, db: Db = prisma) {
    return db.$executeRaw`
      update blog_posts set status = 'HIDDEN'::blog_post_status, updated_at = now()
      where id = ${id} and status = 'PUBLISHED'::blog_post_status
    `;
  },

  pendingTournaments(page: number, limit: number, search?: string) {
    const pattern = search ? `%${search}%` : null;
    return Promise.all([
      prisma.$queryRaw<any[]>`
        select t.id, t.title, t.description, t.sport_type as "sportType",
          t.start_date as "startDate", t.end_date as "endDate", t.status::text,
          p.business_name as "businessName", c.name as "courtName"
        from tournaments t join partner_profiles p on p.id = t.partner_id join courts c on c.id = t.court_id
        where t.status = 'PENDING'::tournament_status
          and (${pattern}::text is null or t.title ilike ${pattern} or p.business_name ilike ${pattern})
        order by t.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from tournaments t join partner_profiles p on p.id = t.partner_id
        where t.status = 'PENDING'::tournament_status
          and (${pattern}::text is null or t.title ilike ${pattern} or p.business_name ilike ${pattern})
      `
    ]);
  },

  moderateTournament(id: string, status: "APPROVED" | "REJECTED", db: Db = prisma) {
    return db.$executeRaw`
      update tournaments set status = ${status}::tournament_status, updated_at = now()
      where id = ${id} and status = 'PENDING'::tournament_status
    `;
  },

  tournamentPartnerUser(id: string) {
    return prisma.$queryRaw<Array<{ title: string; userId: string }>>`
      select t.title, p.user_id as "userId"
      from tournaments t join partner_profiles p on p.id = t.partner_id
      where t.id = ${id}
      limit 1
    `;
  },

  auditLogs(page: number, limit: number, filters: AuditLogFilters) {
    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (filters.search) {
      const contains = { contains: filters.search, mode: "insensitive" as const };
      const anyOf: Prisma.AuditLogWhereInput[] = [
        { action: contains },
        { entityType: contains },
        { entityId: contains },
        { actor: { fullName: contains } },
        { actor: { email: contains } }
      ];
      // An entry's own id, as the chain check reports it.
      if (UUID_PATTERN.test(filters.search)) anyOf.push({ id: filters.search });
      conditions.push({ OR: anyOf });
    }
    if (filters.action) conditions.push({ action: filters.action });
    if (filters.entityType) conditions.push({ entityType: filters.entityType });
    if (filters.actorRole === "SYSTEM") conditions.push({ actorId: null });
    else if (filters.actorRole) conditions.push({ actor: { role: filters.actorRole } });
    if (filters.from || filters.to) conditions.push({ createdAt: { gte: filters.from, lt: filters.to } });
    const where: Prisma.AuditLogWhereInput = conditions.length ? { AND: conditions } : {};
    return Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
        orderBy: auditLogOrderBy(filters.sortBy, filters.sortOrder),
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);
  },

  auditLogFilterOptions() {
    return Promise.all([
      prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } })
    ]);
  },

  /** The anchoring queue, each row with the audit entry it stands for. Nothing anchors it while no provider is set. */
  blockchainLogs(page: number, limit: number, filters: { search?: string; status?: string; sortBy?: string; sortOrder?: string }) {
    const contains = filters.search ? { contains: filters.search, mode: "insensitive" as const } : undefined;
    const anyOf: Prisma.BlockchainLogWhereInput[] = contains
      ? [{ entityType: contains }, { entityId: contains }, { payloadHash: contains }, { txHash: contains }, { audit_logs: { action: contains } }]
      : [];
    if (filters.search && UUID_PATTERN.test(filters.search)) anyOf.push({ auditLogId: filters.search }, { id: filters.search });
    const where: Prisma.BlockchainLogWhereInput = { status: filters.status, OR: anyOf.length ? anyOf : undefined };
    return Promise.all([
      prisma.blockchainLog.findMany({
        where,
        include: { audit_logs: { select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } } } } },
        orderBy: blockchainLogOrderBy(filters.sortBy, filters.sortOrder),
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.blockchainLog.count({ where })
    ]);
  }
};
