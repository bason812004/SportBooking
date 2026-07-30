import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
// ============================================================
// Column-existence cache so SQL queries work on legacy/migrated
// databases without the new fields.
// ============================================================
const columnExistsCache = new Map();
export async function columnExists(tableName, columnName) {
    const cacheKey = `${tableName}.${columnName}`;
    const cached = columnExistsCache.get(cacheKey);
    if (cached !== undefined)
        return cached;
    const [row] = await prisma.$queryRaw `
    select exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `;
    const exists = Boolean(row?.exists);
    if (exists)
        columnExistsCache.set(cacheKey, true);
    return exists;
}
// ============================================================
// Common select fragment used by listing queries.
// Includes the new eligibility fields when present.
// ============================================================
async function eligibilitySelectSql() {
    const has = {
        applicableDays: await columnExists("vouchers", "applicable_days"),
        startTime: await columnExists("vouchers", "start_time"),
        endTime: await columnExists("vouchers", "end_time"),
        holidayOnly: await columnExists("vouchers", "holiday_only"),
        holidayDates: await columnExists("vouchers", "holiday_dates"),
        applicableStartDate: await columnExists("vouchers", "applicable_start_date"),
        applicableEndDate: await columnExists("vouchers", "applicable_end_date"),
    };
    return {
        applicableDays: has.applicableDays ? Prisma.sql `v.applicable_days` : Prisma.sql `null::varchar`,
        startTime: has.startTime ? Prisma.sql `v.start_time::text` : Prisma.sql `null::text`,
        endTime: has.endTime ? Prisma.sql `v.end_time::text` : Prisma.sql `null::text`,
        holidayOnly: has.holidayOnly ? Prisma.sql `v.holiday_only` : Prisma.sql `false`,
        holidayDates: has.holidayDates
            ? Prisma.sql `coalesce((select array_agg(to_char(d, 'YYYY-MM-DD')) from unnest(v.holiday_dates) d), '{}'::text[])`
            : Prisma.sql `null::text[]`,
        applicableStartDate: has.applicableStartDate ? Prisma.sql `v.applicable_start_date` : Prisma.sql `null::timestamptz`,
        applicableEndDate: has.applicableEndDate ? Prisma.sql `v.applicable_end_date` : Prisma.sql `null::timestamptz`
    };
}
const partnerVoucherSelect = Prisma.sql `
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
    async listActive() {
        const hasClickCount = await columnExists("vouchers", "click_count");
        const hasFundedBy = await columnExists("vouchers", "funded_by");
        const clickCountSelect = hasClickCount ? Prisma.sql `coalesce(v.click_count, 0)::int` : Prisma.sql `0::int`;
        const fundedBySelect = hasFundedBy
            ? Prisma.sql `coalesce(v.funded_by, 'PARTNER'::voucher_funded_by)::text`
            : Prisma.sql `'PARTNER'`;
        const partnerFundingSelect = hasFundedBy ? Prisma.sql `coalesce(v.partner_funding_percent, 100)::float` : Prisma.sql `100::float`;
        const platformFundingSelect = hasFundedBy ? Prisma.sql `coalesce(v.platform_funding_percent, 0)::float` : Prisma.sql `0::float`;
        const orderBy = hasClickCount
            ? Prisma.sql `coalesce(v.click_count, 0) desc, v.used_count desc, v.created_at desc`
            : Prisma.sql `v.used_count desc, v.created_at desc`;
        const elig = await eligibilitySelectSql();
        return prisma.$queryRaw(Prisma.sql `
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
    async listActivePlatform() {
        const hasFundedBy = await columnExists("vouchers", "funded_by");
        const where = hasFundedBy
            ? Prisma.sql `where v.status = 'ACTIVE'::voucher_status and now() between v.start_date and v.end_date and v.funded_by = 'PLATFORM'::voucher_funded_by`
            : Prisma.sql `where v.status = 'ACTIVE'::voucher_status and now() between v.start_date and v.end_date`;
        const elig = await eligibilitySelectSql();
        return prisma.$queryRaw(Prisma.sql `
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
    async findActiveById(id) {
        const hasClickCount = await columnExists("vouchers", "click_count");
        const hasFundedBy = await columnExists("vouchers", "funded_by");
        const clickCountSelect = hasClickCount ? Prisma.sql `coalesce(v.click_count, 0)::int` : Prisma.sql `0::int`;
        const fundedBySelect = hasFundedBy
            ? Prisma.sql `coalesce(v.funded_by, 'PARTNER'::voucher_funded_by)::text`
            : Prisma.sql `'PARTNER'`;
        const partnerFundingSelect = hasFundedBy ? Prisma.sql `coalesce(v.partner_funding_percent, 100)::float` : Prisma.sql `100::float`;
        const platformFundingSelect = hasFundedBy ? Prisma.sql `coalesce(v.platform_funding_percent, 0)::float` : Prisma.sql `0::float`;
        const elig = await eligibilitySelectSql();
        return prisma.$queryRaw(Prisma.sql `
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
    async findUsableFull(input) {
        const hasFundedBy = await columnExists("vouchers", "funded_by");
        const fundedByFilter = hasFundedBy
            ? Prisma.sql `and coalesce(v.funded_by, 'PARTNER'::voucher_funded_by) in ('PARTNER'::voucher_funded_by, 'PLATFORM'::voucher_funded_by, 'SHARED'::voucher_funded_by)`
            : Prisma.sql ``;
        const elig = await eligibilitySelectSql();
        return prisma.$queryRaw(Prisma.sql `
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
        end as "court"
      from vouchers v
      left join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      left join lateral (
        select image_url from court_images where court_id = c.id order by sort_order asc limit 1
      ) ci on true
      where v.status = 'ACTIVE'::voucher_status
        and v.start_date <= now()
        and v.end_date >= now()
        and (v.court_id = ${input.courtId} or v.court_id is null)
        and (${input.voucherId ?? null}::varchar is null or v.id = ${input.voucherId ?? null})
        and (${input.code ?? null}::varchar is null or upper(v.code) = upper(${input.code ?? null}))
        ${fundedByFilter}
      limit 1
    `);
    },
    incrementClickCount(id) {
        return prisma.$queryRaw `
      update vouchers
      set click_count = coalesce(click_count, 0) + 1,
          updated_at = now()
      where id = ${id}
        and status = 'ACTIVE'::voucher_status
        and now() between start_date and end_date
      returning id, click_count::int as "clickCount"
    `;
    },
    findUsable(input) {
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
    findActiveVoucher(id) {
        return prisma.voucher.findFirst({
            where: { id, status: "ACTIVE", startDate: { lte: new Date() }, endDate: { gte: new Date() } }
        });
    },
    /**
     * Atomic: increment used_count by 1 (guarded by usage_limit) and
     * mark the user's user_vouchers row as USED. Returns true if the
     * increment actually took place.
     */
    async markVoucherUsed(userId, voucherId, tx) {
        const client = tx ?? prisma;
        const updated = await client.$executeRaw `
      update vouchers
      set used_count = used_count + 1,
          updated_at = now()
      where id = ${voucherId}
        and status = 'ACTIVE'::voucher_status
        and (usage_limit is null or used_count < usage_limit)
    `;
        if (updated === 0)
            return false;
        await client.$executeRaw `
      update user_vouchers
      set status = 'USED'::user_voucher_status,
          used_at = coalesce(used_at, now())
      where user_id = ${userId}
        and voucher_id = ${voucherId}
        and status = 'CLAIMED'::user_voucher_status
    `;
        return true;
    },
    async userVoucher(userId, voucherId) {
        const rows = await prisma.$queryRaw `
      select id, user_id as "userId", voucher_id as "voucherId",
             status::text, claimed_at as "claimedAt", used_at as "usedAt"
      from user_vouchers
      where user_id = ${userId}
        and voucher_id = ${voucherId}
      limit 1
    `;
        return rows[0] ?? null;
    },
    async claim(userId, voucherId) {
        const rows = await prisma.$queryRaw `
      INSERT INTO user_vouchers (user_id, voucher_id, status, claimed_at)
      VALUES (${userId}, ${voucherId}, 'CLAIMED'::user_voucher_status, NOW())
      RETURNING id, user_id, voucher_id, status, claimed_at
    `;
        const row = rows[0];
        if (!row)
            throw new Error("Claim voucher that bai");
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
    async isHoliday(date) {
        try {
            return await prisma.$queryRaw `
        select name, recurring from system_holidays
        where holiday_date = ${date}::date
           or (recurring = true and to_char(holiday_date, 'MM-DD') = to_char(${date}::date, 'MM-DD'))
      `;
        }
        catch (e) {
            // Table may not exist yet — treat as no holidays rather than crashing
            if (e.code === "42P01")
                return [];
            throw e;
        }
    },
    async listForUser(userId) {
        const hasClickCount = await columnExists("vouchers", "click_count");
        const clickCountSelect = hasClickCount ? Prisma.sql `coalesce(v.click_count, 0)::int` : Prisma.sql `0::int`;
        const elig = await eligibilitySelectSql();
        return prisma.$queryRaw(Prisma.sql `
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
    partnerProfile(userId) {
        return prisma.partnerProfile.findUnique({ where: { userId } });
    },
    partnerCourt(courtId, partnerId) {
        if (partnerId == null) {
            return prisma.court.findFirst({ where: { id: courtId } });
        }
        return prisma.court.findFirst({ where: { id: courtId, partnerId } });
    },
    listForPartner(partnerId) {
        return prisma.$queryRaw `${partnerVoucherSelect} where v.partner_id = ${partnerId} order by v.created_at desc`;
    },
    findForPartner(id, partnerId) {
        return prisma.$queryRaw `${partnerVoucherSelect} where v.id = ${id} and v.partner_id = ${partnerId} limit 1`;
    },
    codeExists(code, excludeId) {
        return prisma.$queryRaw `
      select exists(
        select 1
        from vouchers
        where upper(code) = upper(${code})
          and (${excludeId ?? null}::varchar(20) is null or id <> ${excludeId ?? null}::varchar(20))
      ) as "exists"
    `;
    },
    courtBelongsToPartner(courtId, partnerId) {
        return prisma.court.findFirst({ where: { id: courtId, partnerId }, select: { id: true } });
    },
    async createForPartner(partnerId, input) {
        const hasEligibility = (await columnExists("vouchers", "applicable_days"));
        const rows = hasEligibility
            ? await prisma.$queryRaw `
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
            ${input.holidayDates && input.holidayDates.length ? input.holidayDates.map(d => `${d}`) : Prisma.sql `null`}::date[],
            ${input.applicableStartDate ?? null}::timestamptz,
            ${input.applicableEndDate ?? null}::timestamptz
          )
          returning id
        `
            : await prisma.$queryRaw `
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
    async updateForPartner(id, partnerId, input) {
        const hasEligibility = await columnExists("vouchers", "applicable_days");
        if (!hasEligibility) {
            return prisma.$executeRaw `
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
        return prisma.$executeRaw `
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
          holiday_dates = ${input.holidayDates && input.holidayDates.length ? input.holidayDates.map(d => `${d}`) : Prisma.sql `null`}::date[],
          applicable_start_date = ${input.applicableStartDate ?? null}::timestamptz,
          applicable_end_date = ${input.applicableEndDate ?? null}::timestamptz,
          updated_at = now()
      where id = ${id}
        and partner_id = ${partnerId}
        and status = 'DRAFT'::voucher_status
    `;
    },
    setStatus(id, partnerId, from, status) {
        return prisma.$executeRaw `
      update vouchers
      set status = ${status}::voucher_status,
          updated_at = now()
      where id = ${id}
        and partner_id = ${partnerId}
        and status::text in (${Prisma.join(from)})
    `;
    },
    deleteDraft(id, partnerId) {
        return prisma.$executeRaw `
      delete from vouchers
      where id = ${id}
        and partner_id = ${partnerId}
        and status = 'DRAFT'::voucher_status
        and used_count = 0
    `;
    }
};
