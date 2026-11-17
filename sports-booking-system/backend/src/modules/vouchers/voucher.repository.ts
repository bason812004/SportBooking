import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { VOUCHER_RELEASING_STATUSES } from "./voucher.terms.js";

// ============================================================
// Voucher shape returned to the API surface.
// ============================================================
export type VoucherRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minBookingAmount: number;
  usageLimit: number | null;
  usedCount: number;
  clickCount: number;
  startDate: Date;
  endDate: Date;
  status: string;
  fundedBy: "PARTNER" | "PLATFORM" | "SHARED";
  partnerFundingPercent: number;
  platformFundingPercent: number;
  applicableDays: string | null;
  startTime: string | null;
  endTime: string | null;
  holidayOnly: boolean;
  holidayDates: string[] | null;
  applicableStartDate: Date | null;
  applicableEndDate: Date | null;
  partner: { id: string; businessName: string } | null;
  court: { id: string; name: string; city: string; district: string; imageUrl: string | null } | null;
  courtId: string | null;
};

/** A partner's own voucher, with its conditions as the edit form shows them (dates as YYYY-MM-DD, times as HH:mm). */
export type PartnerVoucherRow = Omit<VoucherRow, "partner" | "applicableStartDate" | "applicableEndDate"> & {
  partnerId: string | null;
  applicableStartDate: string | null;
  applicableEndDate: string | null;
  /** An admin disabled it (their last moderation decision): only an admin may turn it back on. */
  lockedByAdmin: boolean;
  /** The reason that admin gave, while the voucher is locked. */
  lockReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserVoucherRow = VoucherRow & {
  userVoucherId: string;
  status: "CLAIMED" | "USED" | "EXPIRED";
  claimedAt: Date;
  usedAt: Date | null;
  voucherStatus: string;
};

// ============================================================
// Column-existence cache pre-populated to avoid DB schema queries
// ============================================================
const columnExistsCache = new Map<string, boolean>([
  ["vouchers.applicable_days", true],
  ["vouchers.start_time", true],
  ["vouchers.end_time", true],
  ["vouchers.holiday_only", true],
  ["vouchers.holiday_dates", true],
  ["vouchers.applicable_start_date", true],
  ["vouchers.applicable_end_date", true],
  ["vouchers.click_count", true],
  ["vouchers.funded_by", true]
]);

export async function columnExists(tableName: string, columnName: string) {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
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
  } catch (err) {
    columnExistsCache.set(cacheKey, true);
    return true;
  }
}

// ============================================================
// Common select fragment used by listing queries.
// Includes the new eligibility fields when present.
// ============================================================
async function eligibilitySelectSql() {
  const [
    applicableDays,
    startTime,
    endTime,
    holidayOnly,
    holidayDates,
    applicableStartDate,
    applicableEndDate
  ] = await Promise.all([
    columnExists("vouchers", "applicable_days"),
    columnExists("vouchers", "start_time"),
    columnExists("vouchers", "end_time"),
    columnExists("vouchers", "holiday_only"),
    columnExists("vouchers", "holiday_dates"),
    columnExists("vouchers", "applicable_start_date"),
    columnExists("vouchers", "applicable_end_date")
  ]);
  const has = {
    applicableDays,
    startTime,
    endTime,
    holidayOnly,
    holidayDates,
    applicableStartDate,
    applicableEndDate
  };

  return {
    applicableDays: has.applicableDays ? Prisma.sql`v.applicable_days` : Prisma.sql`null::varchar`,
    startTime: has.startTime ? Prisma.sql`v.start_time::text` : Prisma.sql`null::text`,
    endTime: has.endTime ? Prisma.sql`v.end_time::text` : Prisma.sql`null::text`,
    holidayOnly: has.holidayOnly ? Prisma.sql`v.holiday_only` : Prisma.sql`false`,
    holidayDates: has.holidayDates
      ? Prisma.sql`coalesce((select array_agg(to_char(d, 'YYYY-MM-DD')) from unnest(v.holiday_dates) d), '{}'::text[])`
      : Prisma.sql`null::text[]`,
    applicableStartDate: has.applicableStartDate ? Prisma.sql`v.applicable_start_date` : Prisma.sql`null::timestamptz`,
    applicableEndDate: has.applicableEndDate ? Prisma.sql`v.applicable_end_date` : Prisma.sql`null::timestamptz`
  };
}

/** One voucher with everything the eligibility check needs (conditions, owner, court); `where` picks it. */
async function voucherRowSql(where: Prisma.Sql) {
  const elig = await eligibilitySelectSql();
  return prisma.$queryRaw<VoucherRow[]>(Prisma.sql`
    select
      v.id, v.code, v.title, v.description,
      v.discount_type as "discountType",
      v.discount_value::float as "discountValue",
      v.max_discount_amount::float as "maxDiscountAmount",
      v.min_booking_amount::float as "minBookingAmount",
      v.usage_limit as "usageLimit",
      v.used_count as "usedCount",
      coalesce(v.click_count, 0)::int as "clickCount",
      v.start_date as "startDate",
      v.end_date as "endDate",
      v.status::text as "status",
      coalesce(v.funded_by, 'PARTNER'::voucher_funded_by)::text as "fundedBy",
      coalesce(v.partner_funding_percent, 100)::float as "partnerFundingPercent",
      coalesce(v.platform_funding_percent, 0)::float as "platformFundingPercent",
      ${elig.applicableDays} as "applicableDays",
      ${elig.startTime} as "startTime",
      ${elig.endTime} as "endTime",
      ${elig.holidayOnly} as "holidayOnly",
      ${elig.holidayDates} as "holidayDates",
      ${elig.applicableStartDate} as "applicableStartDate",
      ${elig.applicableEndDate} as "applicableEndDate",
      case when p.id is null then null
           else json_build_object('id', p.id, 'businessName', p.business_name)
      end as "partner",
      case when c.id is null then null
           else json_build_object('id', c.id, 'name', c.name, 'city', c.city, 'district', c.district, 'imageUrl', ci.image_url)
      end as "court",
      v.court_id as "courtId"
    from vouchers v
    left join partner_profiles p on p.id = v.partner_id
    left join courts c on c.id = v.court_id
    left join lateral (
      select image_url from court_images where court_id = c.id order by sort_order asc limit 1
    ) ci on true
    ${where}
    limit 1
  `);
}

const partnerVoucherSelect = Prisma.sql`
  select
    v.id,
    v.code,
    v.title,
    v.description,
    v.discount_type as "discountType",
    v.discount_value::float as "discountValue",
    v.max_discount_amount::float as "maxDiscountAmount",
    v.min_booking_amount::float as "minBookingAmount",
    v.usage_limit as "usageLimit",
    v.used_count as "usedCount",
    0::int as "clickCount",
    v.start_date as "startDate",
    v.end_date as "endDate",
    case
      when v.status = 'ACTIVE'::voucher_status and v.end_date < now() then 'EXPIRED'
      else v.status::text
    end as "status",
    v.partner_id as "partnerId",
    v.court_id as "courtId",
    v.applicable_days as "applicableDays",
    to_char(v.start_time, 'HH24:MI') as "startTime",
    to_char(v.end_time, 'HH24:MI') as "endTime",
    v.holiday_only as "holidayOnly",
    coalesce((select array_agg(to_char(d, 'YYYY-MM-DD') order by d) from unnest(v.holiday_dates) d), '{}'::text[]) as "holidayDates",
    to_char(v.applicable_start_date at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as "applicableStartDate",
    to_char(v.applicable_end_date at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as "applicableEndDate",
    coalesce((
      select mh.action = 'DISABLED'
      from moderation_history mh
      where mh.entity_type = 'VOUCHER' and mh.entity_id = v.id
      order by mh.created_at desc
      limit 1
    ), false) as "lockedByAdmin",
    (
      select case when mh.action = 'DISABLED' then mh.reason end
      from moderation_history mh
      where mh.entity_type = 'VOUCHER' and mh.entity_id = v.id
      order by mh.created_at desc
      limit 1
    ) as "lockReason",
    case
      when c.id is null then null
      else json_build_object(
        'id', c.id,
        'name', c.name,
        'city', c.city,
        'district', c.district,
        'imageUrl', ci.image_url
      )
    end as "court",
    v.created_at as "createdAt",
    v.updated_at as "updatedAt"
  from vouchers v
  left join courts c on c.id = v.court_id
  left join lateral (
    select image_url
    from court_images
    where court_id = c.id
    order by sort_order asc
    limit 1
  ) ci on true
`;

// ============================================================
// Repository
// ============================================================
export const voucherRepository = {
  async listActive(): Promise<VoucherRow[]> {
    const hasClickCount = await columnExists("vouchers", "click_count");
    const hasFundedBy = await columnExists("vouchers", "funded_by");
    const clickCountSelect = hasClickCount ? Prisma.sql`coalesce(v.click_count, 0)::int` : Prisma.sql`0::int`;
    const fundedBySelect = hasFundedBy
      ? Prisma.sql`coalesce(v.funded_by, 'PARTNER'::voucher_funded_by)::text`
      : Prisma.sql`'PARTNER'`;
    const partnerFundingSelect = hasFundedBy ? Prisma.sql`coalesce(v.partner_funding_percent, 100)::float` : Prisma.sql`100::float`;
    const platformFundingSelect = hasFundedBy ? Prisma.sql`coalesce(v.platform_funding_percent, 0)::float` : Prisma.sql`0::float`;
    const orderBy = hasClickCount
      ? Prisma.sql`coalesce(v.click_count, 0) desc, v.used_count desc, v.created_at desc`
      : Prisma.sql`v.used_count desc, v.created_at desc`;
    const elig = await eligibilitySelectSql();

    return prisma.$queryRaw<VoucherRow[]>(Prisma.sql`
      select
        v.id,
        v.code,
        v.title,
        v.description,
        v.discount_type as "discountType",
        v.discount_value::float as "discountValue",
        v.max_discount_amount::float as "maxDiscountAmount",
        v.min_booking_amount::float as "minBookingAmount",
        v.usage_limit as "usageLimit",
        v.used_count as "usedCount",
        ${clickCountSelect} as "clickCount",
        v.start_date as "startDate",
        v.end_date as "endDate",
        v.status::text as "status",
        ${fundedBySelect} as "fundedBy",
        ${partnerFundingSelect} as "partnerFundingPercent",
        ${platformFundingSelect} as "platformFundingPercent",
        ${elig.applicableDays} as "applicableDays",
        ${elig.startTime} as "startTime",
        ${elig.endTime} as "endTime",
        ${elig.holidayOnly} as "holidayOnly",
        ${elig.holidayDates} as "holidayDates",
        ${elig.applicableStartDate} as "applicableStartDate",
        ${elig.applicableEndDate} as "applicableEndDate",
        case
          when p.id is null then null
          else json_build_object('id', p.id, 'businessName', p.business_name)
        end as "partner",
        case
          when c.id is null then null
          else json_build_object(
            'id', c.id,
            'name', c.name,
            'city', c.city,
            'district', c.district,
            'imageUrl', ci.image_url
          )
        end as "court"
      from vouchers v
      left join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      left join lateral (
        select image_url
        from court_images
        where court_id = c.id
        order by sort_order asc
        limit 1
      ) ci on true
      where v.status = 'ACTIVE'::voucher_status
        and now() between v.start_date and v.end_date
      order by ${orderBy}
      limit 30
    `);
  },

  async listActivePlatform(): Promise<VoucherRow[]> {
    const hasFundedBy = await columnExists("vouchers", "funded_by");
    const where = hasFundedBy
      ? Prisma.sql`where v.status = 'ACTIVE'::voucher_status and now() between v.start_date and v.end_date and v.funded_by = 'PLATFORM'::voucher_funded_by`
      : Prisma.sql`where v.status = 'ACTIVE'::voucher_status and now() between v.start_date and v.end_date`;
    const elig = await eligibilitySelectSql();

    return prisma.$queryRaw<VoucherRow[]>(Prisma.sql`
      select
        v.id, v.code, v.title, v.description,
        v.discount_type as "discountType",
        v.discount_value::float as "discountValue",
        v.max_discount_amount::float as "maxDiscountAmount",
        v.min_booking_amount::float as "minBookingAmount",
        v.usage_limit as "usageLimit",
        v.used_count as "usedCount",
        0::int as "clickCount",
        v.start_date as "startDate",
        v.end_date as "endDate",
        v.status::text as "status",
        'PLATFORM' as "fundedBy",
        0::float as "partnerFundingPercent",
        100::float as "platformFundingPercent",
        ${elig.applicableDays} as "applicableDays",
        ${elig.startTime} as "startTime",
        ${elig.endTime} as "endTime",
        ${elig.holidayOnly} as "holidayOnly",
        ${elig.holidayDates} as "holidayDates",
        ${elig.applicableStartDate} as "applicableStartDate",
        ${elig.applicableEndDate} as "applicableEndDate",
        null::jsonb as "partner",
        null::jsonb as "court"
      from vouchers v
      ${where}
      order by v.created_at desc
    `);
  },

  async findActiveById(id: string): Promise<VoucherRow[]> {
    const hasClickCount = await columnExists("vouchers", "click_count");
    const hasFundedBy = await columnExists("vouchers", "funded_by");
    const clickCountSelect = hasClickCount ? Prisma.sql`coalesce(v.click_count, 0)::int` : Prisma.sql`0::int`;
    const fundedBySelect = hasFundedBy
      ? Prisma.sql`coalesce(v.funded_by, 'PARTNER'::voucher_funded_by)::text`
      : Prisma.sql`'PARTNER'`;
    const partnerFundingSelect = hasFundedBy ? Prisma.sql`coalesce(v.partner_funding_percent, 100)::float` : Prisma.sql`100::float`;
    const platformFundingSelect = hasFundedBy ? Prisma.sql`coalesce(v.platform_funding_percent, 0)::float` : Prisma.sql`0::float`;
    const elig = await eligibilitySelectSql();

    return prisma.$queryRaw<VoucherRow[]>(Prisma.sql`
      select
        v.id, v.code, v.title, v.description,
        v.discount_type as "discountType",
        v.discount_value::float as "discountValue",
        v.max_discount_amount::float as "maxDiscountAmount",
        v.min_booking_amount::float as "minBookingAmount",
        v.usage_limit as "usageLimit",
        v.used_count as "usedCount",
        ${clickCountSelect} as "clickCount",
        v.start_date as "startDate",
        v.end_date as "endDate",
        v.status::text as "status",
        ${fundedBySelect} as "fundedBy",
        ${partnerFundingSelect} as "partnerFundingPercent",
        ${platformFundingSelect} as "platformFundingPercent",
        ${elig.applicableDays} as "applicableDays",
        ${elig.startTime} as "startTime",
        ${elig.endTime} as "endTime",
        ${elig.holidayOnly} as "holidayOnly",
        ${elig.holidayDates} as "holidayDates",
        ${elig.applicableStartDate} as "applicableStartDate",
        ${elig.applicableEndDate} as "applicableEndDate",
        case when p.id is null then null
             else json_build_object('id', p.id, 'businessName', p.business_name)
        end as "partner",
        case when c.id is null then null
             else json_build_object('id', c.id, 'name', c.name, 'city', c.city, 'district', c.district, 'imageUrl', ci.image_url)
        end as "court"
      from vouchers v
      left join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      left join lateral (
        select image_url from court_images
        where court_id = c.id
        order by sort_order asc
        limit 1
      ) ci on true
      where v.id = ${id}
        and v.status = 'ACTIVE'::voucher_status
        and now() between v.start_date and v.end_date
      limit 1
    `);
  },

  async findUsableFull(input: { voucherId?: string; code?: string; courtId: string }) {
    const hasFundedBy = await columnExists("vouchers", "funded_by");
    const fundedByFilter = hasFundedBy
      ? Prisma.sql`and coalesce(v.funded_by, 'PARTNER'::voucher_funded_by) in ('PARTNER'::voucher_funded_by, 'PLATFORM'::voucher_funded_by, 'SHARED'::voucher_funded_by)`
      : Prisma.sql``;
    return voucherRowSql(Prisma.sql`
      where v.status = 'ACTIVE'::voucher_status
        and v.start_date <= now()
        and v.end_date >= now()
        and (v.court_id = ${input.courtId} or v.court_id is null)
        -- A partner voucher only applies to that partner's own courts.
        and (v.partner_id is null or v.partner_id = (select c2.partner_id from courts c2 where c2.id = ${input.courtId}))
        and (${input.voucherId ?? null}::varchar is null or v.id = ${input.voucherId ?? null})
        and (${input.code ?? null}::varchar is null or upper(v.code) = upper(${input.code ?? null}))
        ${fundedByFilter}
    `);
  },

  /** A voucher by id or code whatever its state, so the eligibility check can say exactly why it does not apply. */
  async findForEligibility(input: { voucherId?: string; code?: string }) {
    const [row] = await voucherRowSql(Prisma.sql`
      where (${input.voucherId ?? null}::varchar is null or v.id = ${input.voucherId ?? null})
        and (${input.code ?? null}::varchar is null or upper(v.code) = upper(${input.code ?? null}))
    `);
    return row ?? null;
  },

  async courtPartnerId(courtId: string) {
    const court = await prisma.court.findUnique({ where: { id: courtId }, select: { partnerId: true } });
    return court?.partnerId ?? null;
  },

  /** Vouchers the customer holds a live use of: used on a booking that was not cancelled, rejected or expired. */
  async liveVoucherIdsForUser(userId: string, tx?: Prisma.TransactionClient) {
    const rows = await (tx ?? prisma).$queryRaw<Array<{ voucherId: string }>>`
      select distinct bv.voucher_id as "voucherId"
      from booking_vouchers bv
      join bookings b on b.id = bv.booking_id
      where b.user_id = ${userId}
        and bv.released_at is null
        and b.booking_status::text not in (${Prisma.join([...VOUCHER_RELEASING_STATUSES])})
    `;
    return new Set(rows.map((row) => row.voucherId));
  },

  /** Each customer uses a voucher once; a use given back by a cancellation does not count. */
  async userHasLiveUse(userId: string, voucherId: string, tx?: Prisma.TransactionClient) {
    return (await this.liveVoucherIdsForUser(userId, tx)).has(voucherId);
  },

  /**
   * Gives voucher uses back for bookings that just ended without being played. A use is a standalone booking or a
   * whole multi-day order, so an order's use returns only once every booking of it has ended. released_at makes
   * this run once per use whichever cancellation path calls it, also when two paths race.
   * Call it after updating the bookings' status, in the same transaction.
   */
  async releaseVoucherUses(bookingIds: string[], tx?: Prisma.TransactionClient) {
    if (!bookingIds.length) return 0;
    const client = tx ?? prisma;
    const uses = await client.$queryRaw<Array<{ voucherId: string; userId: string; orderId: string | null; bookingId: string }>>`
      select bv.voucher_id as "voucherId", b.user_id as "userId", b.booking_order_id as "orderId", b.id as "bookingId"
      from booking_vouchers bv
      join bookings b on b.id = bv.booking_id
      where bv.booking_id = any(${bookingIds}::text[])
        and bv.released_at is null
    `;
    const releasing = Prisma.join([...VOUCHER_RELEASING_STATUSES]);
    const seen = new Set<string>();
    let released = 0;
    for (const use of uses) {
      const key = `${use.voucherId}|${use.orderId ?? use.bookingId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sameUse = (alias: string) =>
        use.orderId ? Prisma.sql`${Prisma.raw(alias)}.booking_order_id = ${use.orderId}` : Prisma.sql`${Prisma.raw(alias)}.id = ${use.bookingId}`;
      const marked = await client.$executeRaw`
        update booking_vouchers bv
        set released_at = now()
        from bookings b
        where b.id = bv.booking_id
          and bv.voucher_id = ${use.voucherId}
          and bv.released_at is null
          and ${sameUse("b")}
          and not exists (
            select 1
            from booking_vouchers bv2
            join bookings b2 on b2.id = bv2.booking_id
            where bv2.voucher_id = ${use.voucherId}
              and ${sameUse("b2")}
              and b2.booking_status::text not in (${releasing})
          )
      `;
      // 0 rows: another booking of the order still holds the use, or someone else just released it.
      if (marked === 0) continue;
      await client.$executeRaw`
        update vouchers set used_count = greatest(used_count - 1, 0), updated_at = now() where id = ${use.voucherId}
      `;
      await client.$executeRaw`
        update user_vouchers
        set status = 'CLAIMED'::user_voucher_status, used_at = null
        where user_id = ${use.userId} and voucher_id = ${use.voucherId} and status = 'USED'::user_voucher_status
      `;
      released += 1;
    }
    return released;
  },

  incrementClickCount(id: string) {
    return prisma.$queryRaw<Array<{ id: string; clickCount: number }>>`
      update vouchers
      set click_count = coalesce(click_count, 0) + 1,
          updated_at = now()
      where id = ${id}
        and status = 'ACTIVE'::voucher_status
        and now() between start_date and end_date
      returning id, click_count::int as "clickCount"
    `;
  },

  findUsable(input: { voucherId?: string; code?: string; courtId: string }) {
    return prisma.voucher.findFirst({
      where: {
        id: input.voucherId,
        code: input.code,
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        OR: [{ courtId: input.courtId }, { courtId: null }],
        fundedBy: { in: ["PARTNER", "PLATFORM", "SHARED"] }
      }
    });
  },

  findActiveVoucher(id: string) {
    return prisma.voucher.findFirst({
      where: { id, status: "ACTIVE", startDate: { lte: new Date() }, endDate: { gte: new Date() } }
    });
  },

  /**
   * Atomic: increment used_count by 1 (guarded by usage_limit) and
   * mark the user's user_vouchers row as USED. Returns true if the
   * increment actually took place.
   */
  async markVoucherUsed(userId: string, voucherId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    const updated = await client.$executeRaw`
      update vouchers
      set used_count = used_count + 1,
          updated_at = now()
      where id = ${voucherId}
        and status = 'ACTIVE'::voucher_status
        and (usage_limit is null or used_count < usage_limit)
    `;
    if (updated === 0) return false;
    await client.$executeRaw`
      update user_vouchers
      set status = 'USED'::user_voucher_status,
          used_at = coalesce(used_at, now())
      where user_id = ${userId}
        and voucher_id = ${voucherId}
        and status = 'CLAIMED'::user_voucher_status
    `;
    return true;
  },

  async userVoucher(userId: string, voucherId: string) {
    const rows = await prisma.$queryRaw<Array<{
      id: string; userId: string; voucherId: string; status: string; claimedAt: Date; usedAt: Date | null;
    }>>`
      select id, user_id as "userId", voucher_id as "voucherId",
             status::text, claimed_at as "claimedAt", used_at as "usedAt"
      from user_vouchers
      where user_id = ${userId}
        and voucher_id = ${voucherId}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async getUserClaimedVoucherIds(userId: string): Promise<Set<string>> {
    const rows = await prisma.$queryRaw<Array<{ voucher_id: string }>>`
      select voucher_id
      from user_vouchers
      where user_id = ${userId}
    `;
    return new Set(rows.map((r) => r.voucher_id));
  },

  async claimBatch(userId: string, voucherIds: string[]) {
    if (!voucherIds.length) return [];
    const values = voucherIds.map(
      (vId) => Prisma.sql`(${userId}, ${vId}, 'CLAIMED'::user_voucher_status, NOW())`
    );
    const rows = await prisma.$queryRaw<Array<{ id: string; voucher_id: string }>>(Prisma.sql`
      INSERT INTO user_vouchers (user_id, voucher_id, status, claimed_at)
      VALUES ${Prisma.join(values, ", ")}
      ON CONFLICT (user_id, voucher_id) DO NOTHING
      RETURNING id, voucher_id
    `);
    return rows;
  },

  async claim(userId: string, voucherId: string) {
    const rows = await prisma.$queryRaw<Array<{ id: string; user_id: string; voucher_id: string; status: string; claimed_at: Date }>>`
      INSERT INTO user_vouchers (user_id, voucher_id, status, claimed_at)
      VALUES (${userId}, ${voucherId}, 'CLAIMED'::user_voucher_status, NOW())
      ON CONFLICT (user_id, voucher_id) DO NOTHING
      RETURNING id, user_id, voucher_id, status, claimed_at
    `;
    const row = rows[0];
    if (!row) return { id: "", userId, voucherId, status: "CLAIMED", claimedAt: new Date() };
    return {
      id: row.id,
      userId: row.user_id,
      voucherId: row.voucher_id,
      status: row.status,
      claimedAt: row.claimed_at,
    };
  },

  /**
   * Returns holiday names for `date` (YYYY-MM-DD).
   * Gracefully returns [] if the system_holidays table does not exist.
   */
  async isHoliday(date: string): Promise<Array<{ name: string; recurring: boolean }>> {
    try {
      return await prisma.$queryRaw<Array<{ name: string; recurring: boolean }>>`
        select name, recurring from system_holidays
        where holiday_date = ${date}::date
           or (recurring = true and to_char(holiday_date, 'MM-DD') = to_char(${date}::date, 'MM-DD'))
      `;
    } catch (e) {
      // Table may not exist yet — treat as no holidays rather than crashing
      if ((e as { code?: string }).code === "42P01") return [];
      throw e;
    }
  },

  async listForUser(userId: string): Promise<UserVoucherRow[]> {
    const hasClickCount = await columnExists("vouchers", "click_count");
    const clickCountSelect = hasClickCount ? Prisma.sql`coalesce(v.click_count, 0)::int` : Prisma.sql`0::int`;
    const elig = await eligibilitySelectSql();

    return prisma.$queryRaw<UserVoucherRow[]>(Prisma.sql`
      select
        v.id, v.code, v.title, v.description,
        v.discount_type as "discountType",
        v.discount_value::float as "discountValue",
        v.max_discount_amount::float as "maxDiscountAmount",
        v.min_booking_amount::float as "minBookingAmount",
        v.usage_limit as "usageLimit",
        v.used_count as "usedCount",
        ${clickCountSelect} as "clickCount",
        v.start_date as "startDate",
        v.end_date as "endDate",
        uv.id as "userVoucherId",
        uv.status::text as "status",
        uv.claimed_at as "claimedAt",
        uv.used_at as "usedAt",
        v.status::text as "voucherStatus",
        ${elig.applicableDays} as "applicableDays",
        ${elig.startTime} as "startTime",
        ${elig.endTime} as "endTime",
        ${elig.holidayOnly} as "holidayOnly",
        ${elig.holidayDates} as "holidayDates",
        ${elig.applicableStartDate} as "applicableStartDate",
        ${elig.applicableEndDate} as "applicableEndDate",
        case when p.id is null then null
             else json_build_object('id', p.id, 'businessName', p.business_name)
        end as "partner",
        case when c.id is null then null
             else json_build_object('id', c.id, 'name', c.name, 'city', c.city, 'district', c.district, 'imageUrl', ci.image_url)
        end as "court"
      from user_vouchers uv
      join vouchers v on v.id = uv.voucher_id
      left join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      left join lateral (
        select image_url from court_images where court_id = c.id order by sort_order asc limit 1
      ) ci on true
      where uv.user_id = ${userId}
      order by uv.claimed_at desc
    `);
  },

  partnerProfile(userId: string) {
    return prisma.partnerProfile.findUnique({ where: { userId } });
  },

  partnerCourt(courtId: string, partnerId: string | null) {
    if (partnerId == null) {
      return prisma.court.findFirst({ where: { id: courtId } });
    }
    return prisma.court.findFirst({ where: { id: courtId, partnerId } });
  },

  listForPartner(partnerId: string) {
    return prisma.$queryRaw<PartnerVoucherRow[]>`${partnerVoucherSelect} where v.partner_id = ${partnerId} order by v.created_at desc`;
  },

  findForPartner(id: string, partnerId: string) {
    return prisma.$queryRaw<PartnerVoucherRow[]>`${partnerVoucherSelect} where v.id = ${id} and v.partner_id = ${partnerId} limit 1`;
  },

  codeExists(code: string, excludeId?: string) {
    return prisma.$queryRaw<Array<{ exists: boolean }>>`
      select exists(
        select 1
        from vouchers
        where upper(code) = upper(${code})
          and (${excludeId ?? null}::varchar(20) is null or id <> ${excludeId ?? null}::varchar(20))
      ) as "exists"
    `;
  },

  courtBelongsToPartner(courtId: string, partnerId: string) {
    return prisma.court.findFirst({ where: { id: courtId, partnerId }, select: { id: true } });
  },

  async createForPartner(
    partnerId: string,
    input: {
      courtId?: string | null;
      code: string;
      title: string;
      description?: string | null;
      discountType: "PERCENTAGE" | "FIXED_AMOUNT";
      discountValue: number;
      maxDiscountAmount?: number | null;
      minBookingAmount: number;
      usageLimit?: number | null;
      startDate: Date;
      endDate: Date;
      applicableDays?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      holidayOnly?: boolean;
      holidayDates?: string[] | null;
      applicableStartDate?: Date | null;
      applicableEndDate?: Date | null;
    }
  ) {
    const hasEligibility = (await columnExists("vouchers", "applicable_days"));
    const rows = hasEligibility
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          insert into vouchers (
            partner_id, court_id, code, title, description, discount_type,
            discount_value, max_discount_amount, min_booking_amount,
            usage_limit, start_date, end_date, status,
            applicable_days, start_time, end_time, holiday_only, holiday_dates,
            applicable_start_date, applicable_end_date
          ) values (
            ${partnerId},
            ${input.courtId ?? null}::varchar(20),
            ${input.code},
            ${input.title},
            ${input.description ?? null}::text,
            ${input.discountType}::voucher_discount_type,
            ${input.discountValue},
            ${input.maxDiscountAmount ?? null}::numeric(12,2),
            ${input.minBookingAmount},
            ${input.usageLimit ?? null}::integer,
            ${input.startDate},
            ${input.endDate},
            'DRAFT'::voucher_status,
            ${input.applicableDays ?? null}::varchar(120),
            ${input.startTime ?? null}::time,
            ${input.endTime ?? null}::time,
            ${input.holidayOnly ?? false},
            ${input.holidayDates && input.holidayDates.length ? input.holidayDates.map(d => `${d}`) : Prisma.sql`null`}::date[],
            ${input.applicableStartDate ?? null}::timestamptz,
            ${input.applicableEndDate ?? null}::timestamptz
          )
          returning id
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          insert into vouchers (
            partner_id, court_id, code, title, description, discount_type,
            discount_value, max_discount_amount, min_booking_amount,
            usage_limit, start_date, end_date, status
          ) values (
            ${partnerId},
            ${input.courtId ?? null}::varchar(20),
            ${input.code},
            ${input.title},
            ${input.description ?? null}::text,
            ${input.discountType}::voucher_discount_type,
            ${input.discountValue},
            ${input.maxDiscountAmount ?? null}::numeric(12,2),
            ${input.minBookingAmount},
            ${input.usageLimit ?? null}::integer,
            ${input.startDate},
            ${input.endDate},
            'DRAFT'::voucher_status
          )
          returning id
        `;
    return rows[0];
  },

  async updateForPartner(
    id: string,
    partnerId: string,
    input: {
      courtId?: string | null;
      code: string;
      title: string;
      description?: string | null;
      discountType: "PERCENTAGE" | "FIXED_AMOUNT";
      discountValue: number;
      maxDiscountAmount?: number | null;
      minBookingAmount: number;
      usageLimit?: number | null;
      startDate: Date;
      endDate: Date;
      applicableDays?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      holidayOnly?: boolean;
      holidayDates?: string[] | null;
      applicableStartDate?: Date | null;
      applicableEndDate?: Date | null;
    }
  ) {
    const hasEligibility = await columnExists("vouchers", "applicable_days");
    if (!hasEligibility) {
      return prisma.$executeRaw`
        update vouchers
        set court_id = ${input.courtId ?? null}::varchar(20),
            code = ${input.code},
            title = ${input.title},
            description = ${input.description ?? null}::text,
            discount_type = ${input.discountType}::voucher_discount_type,
            discount_value = ${input.discountValue},
            max_discount_amount = ${input.maxDiscountAmount ?? null}::numeric(12,2),
            min_booking_amount = ${input.minBookingAmount},
            usage_limit = ${input.usageLimit ?? null}::integer,
            start_date = ${input.startDate},
            end_date = ${input.endDate},
            updated_at = now()
        where id = ${id}
          and partner_id = ${partnerId}
          and status = 'DRAFT'::voucher_status
      `;
    }
    return prisma.$executeRaw`
      update vouchers
      set court_id = ${input.courtId ?? null}::varchar(20),
          code = ${input.code},
          title = ${input.title},
          description = ${input.description ?? null}::text,
          discount_type = ${input.discountType}::voucher_discount_type,
          discount_value = ${input.discountValue},
          max_discount_amount = ${input.maxDiscountAmount ?? null}::numeric(12,2),
          min_booking_amount = ${input.minBookingAmount},
          usage_limit = ${input.usageLimit ?? null}::integer,
          start_date = ${input.startDate},
          end_date = ${input.endDate},
          applicable_days = ${input.applicableDays ?? null}::varchar(120),
          start_time = ${input.startTime ?? null}::time,
          end_time = ${input.endTime ?? null}::time,
          holiday_only = ${input.holidayOnly ?? false},
          holiday_dates = ${input.holidayDates && input.holidayDates.length ? input.holidayDates.map(d => `${d}`) : Prisma.sql`null`}::date[],
          applicable_start_date = ${input.applicableStartDate ?? null}::timestamptz,
          applicable_end_date = ${input.applicableEndDate ?? null}::timestamptz,
          updated_at = now()
      where id = ${id}
        and partner_id = ${partnerId}
        and status = 'DRAFT'::voucher_status
    `;
  },

  /**
   * The edits an activated voucher still allows (see runningVoucherChanges). partnerId scopes it to that partner's
   * vouchers; null scopes it to admin vouchers.
   */
  async updateRunning(
    id: string,
    changes: { title?: string; description?: string | null; endDate?: Date; usageLimit?: number | null },
    partnerId: string | null,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const { count } = await db.voucher.updateMany({
      where: { id, partnerId, status: { in: ["ACTIVE", "DISABLED"] } },
      data: changes
    });
    return count > 0;
  },

  setStatus(id: string, partnerId: string, from: string[], status: "ACTIVE" | "DISABLED") {
    return prisma.$executeRaw`
      update vouchers
      set status = ${status}::voucher_status,
          updated_at = now()
      where id = ${id}
        and partner_id = ${partnerId}
        and status::text in (${Prisma.join(from)})
    `;
  },

  deleteDraft(id: string, partnerId: string) {
    return prisma.$executeRaw`
      delete from vouchers
      where id = ${id}
        and partner_id = ${partnerId}
        and status = 'DRAFT'::voucher_status
        and used_count = 0
    `;
  }
};