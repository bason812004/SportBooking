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
  }
};
