import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

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
  if (filters.district) add("c.district ilike ?", `%${filters.district}%`);
  if (filters.approvalStatus) add("c.approval_status::text = ?", filters.approvalStatus);
  if (filters.activeStatus) add("c.active_status::text = ?", filters.activeStatus);
  if (filters.verified) add("c.verified = ?::boolean", filters.verified);
  if (filters.featured) add("c.featured = ?::boolean", filters.featured);

  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", values };
}

export const adminRepository = {
  async courtLocations() {
    const rows = await prisma.$queryRaw<Array<{ city: string; district: string }>>`
      select distinct city, district from courts
      where city is not null and district is not null
      order by city, district
    `;
    const cities: string[] = [];
    const districts: Record<string, string[]> = {};
    for (const row of rows) {
      if (!districts[row.city]) {
        cities.push(row.city);
        districts[row.city] = [];
      }
      districts[row.city].push(row.district);
    }
    return { cities, districts };
  },

  dashboard() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return prisma.$transaction([
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

  users(page: number, limit: number, filters: { search?: string; role?: any; status?: any }) {
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
    return prisma.$transaction([
      prisma.user.findMany({
        where,
        select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.user.count({ where })
    ]);
  },

  async bookings(page: number, limit: number, filters: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    courtId?: string;
    partnerId?: string;
    userId?: string;
    bookingStatus?: string;
    paymentStatus?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { where, values } = bookingWhere(filters);

    const sortColumnMap: Record<string, string> = {
      bookingCode: "b.booking_code",
      customerName: "u.full_name",
      bookingDate: "b.booking_date",
      totalPrice: "b.total_price",
      bookingStatus: "b.booking_status",
      paymentStatus: "b.payment_status"
    };
    const sortCol = filters.sortBy && sortColumnMap[filters.sortBy];
    const sortDir = filters.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = sortCol
      ? `${sortCol} ${sortDir} nulls last${sortCol === "b.booking_date" ? `, b.start_time ${sortDir}` : ""}`
      : "b.booking_date desc, b.start_time desc";

    const listValues = [...values, limit, (page - 1) * limit];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const items = await prisma.$queryRawUnsafe<any[]>(`
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
        ) as "court"
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      ${where}
      order by ${orderBy}
      limit $${limitIndex} offset $${offsetIndex}
    `, ...listValues);
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      ${where}
    `, ...values);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
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
        coalesce(services.items, '[]'::json) as "bookingServices",
        coalesce(actions.items, '[]'::json) as "adminActions"
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      join users pu on pu.id = p.user_id
      left join lateral (
        select json_agg(json_build_object(
          'id', bs.id,
          'quantity', bs.quantity,
          'price', bs.price::float,
          'service', json_build_object('id', cs.id, 'name', cs.name, 'price', cs.price::float)
        ) order by bs.created_at) as items
        from booking_services bs
        join court_services cs on cs.id = bs.service_id
        where bs.booking_id = b.id
      ) services on true
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

  async updateBookingAdmin(actorId: string, id: string, input: any, action: string) {
    return prisma.$transaction(async (tx) => {
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

      return updated;
    });
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
  }) {
    const { where, values } = adminCourtWhere(filters);
    const listValues = [...values, limit, (page - 1) * limit];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const items = await prisma.$queryRawUnsafe<any[]>(`
      select
        c.id, c.name, c.slug, c.address, c.city, c.district, c.ward,
        c.approval_status::text as "approvalStatus",
        c.active_status::text as "activeStatus",
        c.verified, c.featured,
        c.admin_note as "adminNote",
        c.update_request_note as "updateRequestNote",
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
      order by c.created_at desc
      limit $${limitIndex} offset $${offsetIndex}
    `, ...listValues);
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from courts c
      join partner_profiles p on p.id = c.partner_id
      join users u on u.id = p.user_id
      ${where}
    `, ...values);
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
        c.update_request_note as "updateRequestNote",
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

  async updateAdminCourt(id: string, input: any) {
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown, cast = "") => {
      values.push(value);
      sets.push(`${column} = $${values.length}${cast}`);
    };
    if (input.activeStatus !== undefined) add("active_status", input.activeStatus, "::court_active_status");
    if (input.verified !== undefined) add("verified", input.verified);
    if (input.featured !== undefined) add("featured", input.featured);
    if (input.adminNote !== undefined) add("admin_note", input.adminNote);
    values.push(id);
    const idIndex = values.length;
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      update courts set ${sets.join(", ")}, updated_at = now()
      where id = $${idIndex}
      returning id, name, active_status::text as "activeStatus", verified, featured, admin_note as "adminNote"
    `, ...values);
    return rows[0] ?? null;
  },

  async requestCourtUpdate(id: string, actorId: string, note: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      update courts set update_request_note = $1, update_requested_at = now(), updated_at = now()
      where id = $2
      returning id, name, partner_id as "partnerId", update_request_note as "updateRequestNote", update_requested_at as "updateRequestedAt"
    `, note, id);
    const court = rows[0];
    if (!court) return null;

    await prisma.$executeRawUnsafe(`
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
    payoutStatus?: string;
  }) {
    const clauses = ["ct.created_at >= $1", "ct.created_at < $2"];
    const values: unknown[] = [filters.from, filters.to, filters.month];
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
    if (filters.payoutStatus) add("coalesce(po.status, 'PENDING') = ?", filters.payoutStatus);
    const where = `where ${clauses.join(" and ")}`;
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const items = await prisma.$queryRawUnsafe<any[]>(`
      select ct.id, ct.booking_id as "bookingId", b.booking_code as "bookingCode",
        b.booking_date as "bookingDate", c.id as "courtId", c.name as "courtName",
        p.id as "partnerId", p.business_name as "businessName",
        ct.transaction_type as "transactionType", ct.event_type as "eventType",
        ct.gross_amount::float as "grossAmount", ct.commission_rate::float as "commissionRate",
        ct.commission_amount::float as "commissionAmount", ct.net_amount::float as "netAmount",
        coalesce(po.status, 'PENDING') as "payoutStatus", ct.created_at as "createdAt"
      from commission_transactions ct
      join bookings b on b.id = ct.booking_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = ct.partner_id
      left join partner_payouts po on po.partner_id = ct.partner_id and po.payout_month = $3
      ${where}
      order by ct.created_at desc
      limit $${limitIndex} offset $${offsetIndex}
    `, ...values, limit, (page - 1) * limit);
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from commission_transactions ct
      join bookings b on b.id = ct.booking_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = ct.partner_id
      left join partner_payouts po on po.partner_id = ct.partner_id and po.payout_month = $3
      ${where}
    `, ...values);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  async financeRefunds(page: number, limit: number, filters: {
    from: Date;
    to: Date;
    search?: string;
    partnerId?: string;
    paymentStatus?: string;
  }) {
    const clauses = [
      "coalesce(b.cancelled_at, b.updated_at, b.created_at) >= $1",
      "coalesce(b.cancelled_at, b.updated_at, b.created_at) < $2",
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
    const items = await prisma.$queryRawUnsafe<any[]>(`
      select b.id, b.booking_code as "bookingCode", b.booking_date as "bookingDate",
        b.total_price::float as "totalPrice", b.deposit_amount::float as "depositAmount",
        b.refund_amount::float as "refundAmount",
        b.platform_retained_amount::float as "platformRetainedAmount",
        b.payment_status::text as "paymentStatus", b.cancel_reason as "cancelReason",
        coalesce(b.cancelled_at, b.updated_at, b.created_at) as "refundedAt",
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "user",
        json_build_object('id', c.id, 'name', c.name, 'partner', json_build_object('id', p.id, 'businessName', p.business_name)) as "court"
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      ${where}
      order by coalesce(b.cancelled_at, b.updated_at, b.created_at) desc
      limit $${limitIndex} offset $${offsetIndex}
    `, ...values, limit, (page - 1) * limit);
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from bookings b
      join users u on u.id = b.user_id
      join courts c on c.id = b.court_id
      join partner_profiles p on p.id = c.partner_id
      ${where}
    `, ...values);
    return [items, Number(countRows[0]?.count ?? 0)] as const;
  },

  async financeReconciliation(month: string, from: Date, to: Date) {
    return prisma.$queryRawUnsafe<any[]>(`
      with tx as (
        select partner_id, sum(gross_amount)::float as gross_amount,
          sum(commission_amount)::float as commission_amount,
          sum(net_amount)::float as net_amount,
          count(*)::int as transaction_count
        from commission_transactions
        where created_at >= $2 and created_at < $3
        group by partner_id
      ),
      refunds as (
        select c.partner_id, sum(b.refund_amount)::float as refund_amount,
          sum(b.platform_retained_amount)::float as platform_retained_amount,
          count(*)::int as refund_count
        from bookings b
        join courts c on c.id = b.court_id
        where coalesce(b.cancelled_at, b.updated_at, b.created_at) >= $2
          and coalesce(b.cancelled_at, b.updated_at, b.created_at) < $3
          and b.refund_amount > 0
        group by c.partner_id
      )
      select p.id as "partnerId", p.business_name as "businessName",
        coalesce(tx.gross_amount, 0)::float as "grossAmount",
        coalesce(tx.commission_amount, 0)::float as "commissionAmount",
        coalesce(tx.net_amount, 0)::float as "netAmount",
        coalesce(tx.transaction_count, 0)::int as "transactionCount",
        coalesce(refunds.refund_amount, 0)::float as "refundAmount",
        coalesce(refunds.platform_retained_amount, 0)::float as "platformRetainedAmount",
        coalesce(refunds.refund_count, 0)::int as "refundCount",
        po.id as "payoutId", coalesce(po.status, 'PENDING') as "payoutStatus",
        po.note as "payoutNote", po.paid_at as "paidAt", po.updated_at as "payoutUpdatedAt"
      from partner_profiles p
      left join tx on tx.partner_id = p.id
      left join refunds on refunds.partner_id = p.id
      left join partner_payouts po on po.partner_id = p.id and po.payout_month = $1
      where tx.partner_id is not null or refunds.partner_id is not null or po.id is not null
      order by coalesce(tx.net_amount, 0) desc, p.business_name asc
    `, month, from, to);
  },

  async upsertPartnerPayout(actorId: string, partnerId: string, month: string, from: Date, to: Date, input: { status: string; note?: string }) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      with tx as (
        select coalesce(sum(gross_amount), 0) as gross_amount,
          coalesce(sum(commission_amount), 0) as commission_amount,
          coalesce(sum(net_amount), 0) as net_amount,
          count(*)::int as transaction_count
        from commission_transactions
        where partner_id = $1 and created_at >= $4 and created_at < $5
      )
      insert into partner_payouts (
        partner_id, payout_month, status, gross_amount, commission_amount, net_amount,
        transaction_count, note, paid_at
      )
      select $1, $2, $3, tx.gross_amount, tx.commission_amount, tx.net_amount,
        tx.transaction_count, $6, case when $3 = 'PAID' then now() else null end
      from tx
      on conflict (partner_id, payout_month) do update set
        status = excluded.status,
        gross_amount = excluded.gross_amount,
        commission_amount = excluded.commission_amount,
        net_amount = excluded.net_amount,
        transaction_count = excluded.transaction_count,
        note = excluded.note,
        paid_at = case when excluded.status = 'PAID' then coalesce(partner_payouts.paid_at, now()) else null end
      returning id, partner_id as "partnerId", payout_month as "month", status,
        gross_amount::float as "grossAmount", commission_amount::float as "commissionAmount",
        net_amount::float as "netAmount", transaction_count as "transactionCount",
        note, paid_at as "paidAt", updated_at as "updatedAt"
    `, partnerId, month, input.status, from, to, input.note ?? null);
    const payout = rows[0] ?? null;
    if (payout) {
      await this.addModerationHistory({
        entityType: "PAYOUT",
        entityId: payout.id,
        action: input.status,
        reason: input.note,
        actorId
      });
    }
    return payout;
  },

  async notificationCampaigns(page: number, limit: number, filters: { search?: string; type?: string; targetType?: string }) {
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
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const items = await prisma.$queryRawUnsafe<any[]>(`
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
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "sender",
        tu.email as "targetUserEmail",
        pp.business_name as "targetPartnerName"
      from notification_campaigns nc
      left join users u on u.id = nc.sent_by
      left join users tu on tu.id = nc.target_user_id
      left join partner_profiles pp on pp.id = nc.target_partner_id
      ${where}
      order by nc.created_at desc
      limit $${limitIndex} offset $${offsetIndex}
    `, ...values, limit, (page - 1) * limit);
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
      select count(*)::bigint as count
      from notification_campaigns nc
      left join users u on u.id = nc.sent_by
      left join users tu on tu.id = nc.target_user_id
      left join partner_profiles pp on pp.id = nc.target_partner_id
      ${where}
    `, ...values);
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
        json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email) as "sender",
        coalesce(recipients.items, '[]'::json) as "recipients"
      from notification_campaigns nc
      left join users u on u.id = nc.sent_by
      left join lateral (
        select json_agg(json_build_object(
          'id', n.id,
          'isRead', n.is_read,
          'createdAt', n.created_at,
          'user', json_build_object('id', ru.id, 'fullName', ru.full_name, 'email', ru.email, 'role', ru.role::text)
        ) order by n.created_at desc) as items
        from (
          select *
          from notifications
          where campaign_id = nc.id
          order by created_at desc
          limit 200
        ) n
        join users ru on ru.id = n.user_id
      ) recipients on true
      where nc.id = $1
    `, id);
    return rows[0] ?? null;
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
  }) {
    return prisma.$transaction(async (tx) => {
      let recipientRows: Array<{ id: string }> = [];
      if (input.targetType === "ALL") {
        recipientRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
          select id from users where status::text = 'ACTIVE'
        `);
      } else if (input.targetType === "ROLE") {
        recipientRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
          select id from users where role::text = $1 and status::text = 'ACTIVE'
        `, input.targetRole);
      } else if (input.targetType === "USER") {
        recipientRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
          select id from users where id = $1 and status::text = 'ACTIVE'
        `, input.targetUserId);
      } else if (input.targetType === "PARTNER") {
        recipientRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
          select u.id
          from partner_profiles pp
          join users u on u.id = pp.user_id
          where pp.id = $1 and u.status::text = 'ACTIVE'
        `, input.targetPartnerId);
      }
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

      return campaign;
    });
  },

  setUserStatus(id: string, status: "ACTIVE" | "LOCKED") {
    return prisma.user.update({
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
            { user: { fullName: { contains: filters.search, mode: "insensitive" } } },
            { user: { email: { contains: filters.search, mode: "insensitive" } } }
          ]
        : undefined
    };
    return prisma.$transaction([
      prisma.partnerProfile.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true, phone: true, status: true } } },
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
        user: { select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true } },
        courts: { select: { id: true, name: true, approvalStatus: true, activeStatus: true } }
      }
    });
  },

  setPartnerApproval(id: string, approvalStatus: "APPROVED" | "REJECTED") {
    return prisma.partnerProfile.update({ where: { id }, data: { approvalStatus } });
  },

  pendingCourts() {
    return prisma.court.findMany({
      where: { approvalStatus: "PENDING" },
      include: { category: true, partner: { include: { user: { select: { fullName: true, email: true } } } }, images: true },
      orderBy: { createdAt: "desc" }
    });
  },

  setCourtApproval(id: string, approvalStatus: "APPROVED" | "REJECTED", rejectionReason?: string) {
    return prisma.court.update({ where: { id }, data: { approvalStatus, rejectionReason } });
  },

  categories() {
    return prisma.courtCategory.findMany({ orderBy: { createdAt: "desc" } });
  },
  createCategory(data: Prisma.CourtCategoryCreateInput) {
    return prisma.courtCategory.create({ data });
  },
  updateCategory(id: string, data: Prisma.CourtCategoryUpdateInput) {
    return prisma.courtCategory.update({ where: { id }, data });
  },
  deleteCategory(id: string) {
    return prisma.courtCategory.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  reviews() {
    return prisma.review.findMany({
      include: { user: { select: { fullName: true, email: true } }, court: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
  },
  setReviewDisplay(id: string, displayStatus: "VISIBLE" | "HIDDEN") {
    return prisma.review.update({ where: { id }, data: { displayStatus } });
  },
  deleteReview(id: string) {
    return prisma.review.delete({ where: { id } });
  },

  reports() {
    return prisma.report.findMany({
      include: { user: { select: { fullName: true, email: true } }, court: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
  },
  setReportStatus(id: string, status: "RESOLVED" | "REJECTED") {
    return prisma.report.update({ where: { id }, data: { status, resolvedAt: new Date() } });
  },

  statistics() {
    return prisma.$transaction([
      prisma.booking.groupBy({ by: ["bookingStatus"], orderBy: { bookingStatus: "asc" }, _count: true, _sum: { totalPrice: true } }),
      prisma.court.groupBy({ by: ["city"], orderBy: { city: "asc" }, _count: true }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: true })
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

  addModerationHistory(data: { entityType: string; entityId: string; action: string; reason?: string; actorId: string }) {
    return prisma.$queryRawUnsafe<any[]>(`
      insert into moderation_history (entity_type, entity_id, action, reason, actor_id)
      values ($1, $2, $3, $4, $5)
      returning id, entity_type as "entityType", entity_id as "entityId",
        action, reason, actor_id as "actorId", created_at as "createdAt"
    `, data.entityType, data.entityId, data.action, data.reason ?? null, data.actorId);
  },

  vouchers(page: number, limit: number, filters: { search?: string; status?: string }) {
    const search = filters.search ? `%${filters.search}%` : null;
    return prisma.$transaction([
      prisma.$queryRaw<any[]>`
        select v.id, v.code, v.title, v.discount_type::text as "discountType",
          v.discount_value::float as "discountValue", v.used_count as "usedCount",
          v.usage_limit as "usageLimit", v.start_date as "startDate", v.end_date as "endDate",
          v.status::text, p.business_name as "businessName", c.name as "courtName"
        from vouchers v join partner_profiles p on p.id = v.partner_id
        left join courts c on c.id = v.court_id
        where (${filters.status ?? null}::text is null or v.status::text = ${filters.status ?? null})
          and (${search}::text is null or v.code ilike ${search} or v.title ilike ${search} or p.business_name ilike ${search})
        order by v.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from vouchers v join partner_profiles p on p.id = v.partner_id
        where (${filters.status ?? null}::text is null or v.status::text = ${filters.status ?? null})
          and (${search}::text is null or v.code ilike ${search} or v.title ilike ${search} or p.business_name ilike ${search})
      `
    ]);
  },

  setVoucherStatus(id: string, status: "ACTIVE" | "DISABLED") {
    return prisma.$executeRaw`update vouchers set status = ${status}::voucher_status, updated_at = now() where id = ${id}::uuid`;
  },

  pendingBlogs(page: number, limit: number, search?: string) {
    const pattern = search ? `%${search}%` : null;
    return prisma.$transaction([
      prisma.$queryRaw<any[]>`
        select b.id, b.title, b.excerpt, b.content, b.cover_image_url as "coverImageUrl",
          b.status::text, b.created_at as "createdAt", u.full_name as "authorName", u.email as "authorEmail"
        from blog_posts b join users u on u.id = b.author_id
        where b.status = 'PENDING'::blog_post_status
          and (${pattern}::text is null or b.title ilike ${pattern} or u.full_name ilike ${pattern})
        order by b.created_at desc offset ${(page - 1) * limit} limit ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count from blog_posts b join users u on u.id = b.author_id
        where b.status = 'PENDING'::blog_post_status
          and (${pattern}::text is null or b.title ilike ${pattern} or u.full_name ilike ${pattern})
      `
    ]);
  },

  moderateBlog(id: string, status: "PUBLISHED" | "REJECTED") {
    return prisma.$executeRaw`
      update blog_posts set status = ${status}::blog_post_status,
        published_at = case when ${status} = 'PUBLISHED' then now() else published_at end, updated_at = now()
      where id = ${id}::uuid and status = 'PENDING'::blog_post_status
    `;
  },

  pendingTournaments(page: number, limit: number, search?: string) {
    const pattern = search ? `%${search}%` : null;
    return prisma.$transaction([
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

  moderateTournament(id: string, status: "APPROVED" | "REJECTED") {
    return prisma.$executeRaw`
      update tournaments set status = ${status}::tournament_status, updated_at = now()
      where id = ${id}::uuid and status = 'PENDING'::tournament_status
    `;
  },

  auditLogs(page: number, limit: number, search?: string) {
    const where: Prisma.AuditLogWhereInput = search ? {
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { actor: { fullName: { contains: search, mode: "insensitive" } } }
      ]
    } : {};
    return prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);
  },

  blockchainLogs(page: number, limit: number, filters: { search?: string; status?: string }) {
    const where: Prisma.BlockchainLogWhereInput = {
      status: filters.status,
      OR: filters.search ? [
        { entityType: { contains: filters.search, mode: "insensitive" } },
        { entityId: { contains: filters.search, mode: "insensitive" } },
        { txHash: { contains: filters.search, mode: "insensitive" } }
      ] : undefined
    };
    return prisma.$transaction([
      prisma.blockchainLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.blockchainLog.count({ where })
    ]);
  },

  retryBlockchainLog(id: string) {
    return prisma.blockchainLog.update({
      where: { id },
      data: { attempts: { increment: 1 }, status: "PENDING", error: "Blockchain provider is not configured" }
    });
  }
};
