import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
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
    listActive() {
        return prisma.$queryRaw `
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
      order by v.created_at desc
      limit 30
    `;
    },
    findActiveById(id) {
        return prisma.$queryRaw `
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
      where v.id = ${id}::uuid
        and v.status = 'ACTIVE'::voucher_status
        and now() between v.start_date and v.end_date
      limit 1
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
    userVoucher(userId, voucherId) {
        return prisma.userVoucher.findUnique({ where: { userId_voucherId: { userId, voucherId } } });
    },
    claim(userId, voucherId) {
        return prisma.userVoucher.create({ data: { userId, voucherId } });
    },
    listForUser(userId) {
        return prisma.userVoucher.findMany({
            where: { userId },
            include: { voucher: { include: { court: true, partner: true } } },
            orderBy: { claimedAt: "desc" }
        });
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
      where v.partner_id = ${partnerId}::uuid
      order by v.created_at desc
    `;
    },
    findForPartner(id, partnerId) {
        return prisma.$queryRaw `
      ${partnerVoucherSelect}
      where v.id = ${id}::uuid
        and v.partner_id = ${partnerId}::uuid
      limit 1
    `;
    },
    codeExists(code, excludeId) {
        return prisma.$queryRaw `
      select exists(
        select 1
        from vouchers
        where upper(code) = upper(${code})
          and (${excludeId ?? null}::uuid is null or id <> ${excludeId ?? null}::uuid)
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
        ${partnerId}::uuid,
        ${input.courtId ?? null}::uuid,
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
      set court_id = ${input.courtId ?? null}::uuid,
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
      where id = ${id}::uuid
        and partner_id = ${partnerId}::uuid
        and status = 'DRAFT'::voucher_status
    `;
    },
    setStatus(id, partnerId, from, status) {
        return prisma.$executeRaw `
      update vouchers
      set status = ${status}::voucher_status,
          updated_at = now()
      where id = ${id}::uuid
        and partner_id = ${partnerId}::uuid
        and status::text in (${Prisma.join(from)})
    `;
    },
    deleteDraft(id, partnerId) {
        return prisma.$executeRaw `
      delete from vouchers
      where id = ${id}::uuid
        and partner_id = ${partnerId}::uuid
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
