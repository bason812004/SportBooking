import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
const columnExistsCache = new Map();
async function columnExists(tableName, columnName) {
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
export const voucherRepository = {
    async listActive() {
        const hasClickCount = await columnExists("vouchers", "click_count");
        const clickCountSelect = hasClickCount ? Prisma.sql `coalesce(v.click_count, 0)::int` : Prisma.sql `0::int`;
        const orderBy = hasClickCount
            ? Prisma.sql `coalesce(v.click_count, 0) desc, v.used_count desc, v.created_at desc`
            : Prisma.sql `v.used_count desc, v.created_at desc`;
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
        json_build_object('id', p.id, 'businessName', p.business_name) as "partner",
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
      join partner_profiles p on p.id = v.partner_id
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
    async findActiveById(id) {
        const hasClickCount = await columnExists("vouchers", "click_count");
        const clickCountSelect = hasClickCount ? Prisma.sql `coalesce(v.click_count, 0)::int` : Prisma.sql `0::int`;
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
        json_build_object('id', p.id, 'businessName', p.business_name) as "partner",
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
      join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      left join lateral (
        select image_url
        from court_images
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
    async incrementClickCount(id) {
        if (!(await columnExists("vouchers", "click_count"))) {
            const [voucher] = await this.findActiveById(id);
            return voucher ? { id: voucher.id, clickCount: 0 } : null;
        }
        const rows = await prisma.$queryRaw `
      update vouchers
      set click_count = coalesce(click_count, 0) + 1,
          updated_at = now()
      where id = ${id}
        and status = 'ACTIVE'::voucher_status
        and now() between start_date and end_date
      returning id, click_count::int as "clickCount"
    `;
        return rows[0] ?? null;
    },
    findUsable(input) {
        return prisma.voucher.findFirst({
            where: {
                id: input.voucherId,
                code: input.code,
                status: "ACTIVE",
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
                OR: [{ courtId: input.courtId }, { courtId: null }]
            }
        });
    },
    findActiveVoucher(id) {
        return prisma.voucher.findFirst({
            where: {
                id,
                status: "ACTIVE",
                startDate: { lte: new Date() },
                endDate: { gte: new Date() }
            }
        });
    },
    async userVoucher(userId, voucherId) {
        const rows = await prisma.$queryRaw `
      select id, user_id as "userId", voucher_id as "voucherId", status::text
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
    async listForUser(userId) {
        const hasClickCount = await columnExists("vouchers", "click_count");
        const clickCountSelect = hasClickCount ? Prisma.sql `coalesce(v.click_count, 0)::int` : Prisma.sql `0::int`;
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
        uv.id as "userVoucherId",
        uv.status::text as "status",
        uv.claimed_at as "claimedAt",
        uv.used_at as "usedAt",
        v.status::text as "voucherStatus",
        json_build_object('id', p.id, 'businessName', p.business_name) as "partner",
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
      from user_vouchers uv
      join vouchers v on v.id = uv.voucher_id
      join partner_profiles p on p.id = v.partner_id
      left join courts c on c.id = v.court_id
      left join lateral (
        select image_url
        from court_images
        where court_id = c.id
        order by sort_order asc
        limit 1
      ) ci on true
      where uv.user_id = ${userId}
      order by uv.claimed_at desc
    `);
    },
    partnerProfile(userId) {
        return prisma.partnerProfile.findUnique({ where: { userId } });
    },
    partnerCourt(courtId, partnerId) {
        return prisma.court.findFirst({ where: { id: courtId, partnerId } });
    },
    listForPartner(partnerId) {
        return prisma.$queryRaw `
      ${partnerVoucherSelect}
      where v.partner_id = ${partnerId}
      order by v.created_at desc
    `;
    },
    findForPartner(id, partnerId) {
        return prisma.$queryRaw `
      ${partnerVoucherSelect}
      where v.id = ${id}
        and v.partner_id = ${partnerId}
      limit 1
    `;
    },
    codeExists(code, excludeId) {
        return prisma.$queryRaw `
      select exists(
        select 1
        from vouchers
        where upper(code) = upper(${code})
          and (${excludeId ?? null} is null or id <> ${excludeId ?? null})
      ) as "exists"
    `;
    },
    courtBelongsToPartner(courtId, partnerId) {
        return prisma.court.findFirst({
            where: { id: courtId, partnerId },
            select: { id: true }
        });
    },
    async createForPartner(partnerId, input) {
        const rows = await prisma.$queryRaw `
      insert into vouchers (
        partner_id, court_id, code, title, description, discount_type,
        discount_value, max_discount_amount, min_booking_amount,
        usage_limit, start_date, end_date, status
      ) values (
        ${partnerId},
        ${input.courtId ?? null},
        ${input.code},
        ${input.title},
        ${input.description ?? null},
        ${input.discountType}::voucher_discount_type,
        ${input.discountValue},
        ${input.maxDiscountAmount ?? null},
        ${input.minBookingAmount},
        ${input.usageLimit ?? null},
        ${input.startDate},
        ${input.endDate},
        'DRAFT'::voucher_status
      )
      returning id
    `;
        return rows[0];
    },
    async updateForPartner(id, partnerId, input) {
        return prisma.$executeRaw `
      update vouchers
      set court_id = ${input.courtId ?? null},
          code = ${input.code},
          title = ${input.title},
          description = ${input.description ?? null},
          discount_type = ${input.discountType}::voucher_discount_type,
          discount_value = ${input.discountValue},
          max_discount_amount = ${input.maxDiscountAmount ?? null},
          min_booking_amount = ${input.minBookingAmount},
          usage_limit = ${input.usageLimit ?? null},
          start_date = ${input.startDate},
          end_date = ${input.endDate},
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
    },
    listAdmin() {
        return prisma.voucher.findMany({
            include: { court: true, partner: true },
            orderBy: { createdAt: "desc" }
        });
    },
    disableAdmin(id) {
        return prisma.voucher.update({ where: { id }, data: { status: "DISABLED" } });
    }
};
