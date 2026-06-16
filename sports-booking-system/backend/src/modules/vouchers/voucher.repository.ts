import { prisma } from "../../config/db.js";

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
  startDate: Date;
  endDate: Date;
  status: string;
  partner: { id: string; businessName: string };
  court: { id: string; name: string; city: string; district: string; imageUrl: string | null } | null;
};

export const voucherRepository = {
  listActive() {
    return prisma.$queryRaw<VoucherRow[]>`
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

  findActiveById(id: string) {
    return prisma.$queryRaw<VoucherRow[]>`
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

  findUsable(input: { voucherId?: string; code?: string; courtId: string }) {
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

  findActiveVoucher(id: string) {
    return prisma.voucher.findFirst({
      where: {
        id,
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    });
  },

  userVoucher(userId: string, voucherId: string) {
    return prisma.userVoucher.findUnique({ where: { userId_voucherId: { userId, voucherId } } });
  },

  claim(userId: string, voucherId: string) {
    return prisma.userVoucher.create({ data: { userId, voucherId } });
  },

  listForUser(userId: string) {
    return prisma.userVoucher.findMany({
      where: { userId },
      include: { voucher: { include: { court: true, partner: true } } },
      orderBy: { claimedAt: "desc" }
    });
  },

  partnerProfile(userId: string) {
    return prisma.partnerProfile.findUnique({ where: { userId } });
  },

  partnerCourt(courtId: string, partnerId: string) {
    return prisma.court.findFirst({ where: { id: courtId, partnerId } });
  },

  listPartner(partnerId: string) {
    return prisma.voucher.findMany({ where: { partnerId }, include: { court: true }, orderBy: { createdAt: "desc" } });
  },

  createPartner(partnerId: string, input: any) {
    return prisma.voucher.create({
      data: {
        partnerId,
        courtId: input.courtId,
        code: input.code,
        title: input.title,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxDiscountAmount: input.maxDiscountAmount,
        minBookingAmount: input.minBookingAmount,
        usageLimit: input.usageLimit,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: input.status
      }
    });
  },

  findPartnerVoucher(id: string, partnerId: string) {
    return prisma.voucher.findFirst({ where: { id, partnerId } });
  },

  updatePartner(id: string, input: any) {
    return prisma.voucher.update({
      where: { id },
      data: {
        courtId: input.courtId,
        code: input.code,
        title: input.title,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxDiscountAmount: input.maxDiscountAmount,
        minBookingAmount: input.minBookingAmount,
        usageLimit: input.usageLimit,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        status: input.status
      }
    });
  },

  deletePartner(id: string) {
    return prisma.voucher.update({ where: { id }, data: { status: "DISABLED" } });
  },

  listAdmin() {
    return prisma.voucher.findMany({ include: { court: true, partner: true }, orderBy: { createdAt: "desc" } });
  },

  disableAdmin(id: string) {
    return prisma.voucher.update({ where: { id }, data: { status: "DISABLED" } });
  }
};
