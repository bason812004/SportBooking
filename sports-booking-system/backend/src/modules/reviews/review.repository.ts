import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

/** Filters of the admin moderation list and the partner's reviews page (partnerId scopes it to one partner). */
export type ReviewListFilters = {
  partnerId?: string;
  courtId?: string;
  status?: "VISIBLE" | "HIDDEN";
  rating?: number;
  search?: string;
  /** true: only reviews the court owner replied to; false: only those still waiting for a reply. */
  replied?: boolean;
};

function listWhere(filters: ReviewListFilters): Prisma.ReviewWhereInput {
  const contains = filters.search ? { contains: filters.search, mode: "insensitive" as const } : undefined;
  return {
    displayStatus: filters.status,
    rating: filters.rating,
    courtId: filters.courtId,
    reply: filters.replied === undefined ? undefined : filters.replied ? { isNot: null } : { is: null },
    court: filters.partnerId ? { partnerId: filters.partnerId } : undefined,
    OR: contains
      ? [{ comment: contains }, { user: { fullName: contains } }, { user: { email: contains } }, { court: { name: contains } }]
      : undefined
  };
}

const listInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  court: { select: { id: true, name: true, partner: { select: { id: true, businessName: true } } } },
  booking: { select: { id: true, bookingCode: true, bookingDate: true, bookingStatus: true } },
  reply: { select: { content: true, updatedAt: true } }
} satisfies Prisma.ReviewInclude;

/** The last moderation decision on each review (hide, show again), with the reason the admin gave. */
async function latestModeration(ids: string[]) {
  if (!ids.length) return new Map<string, { action: string; reason: string | null; createdAt: Date }>();
  const rows = await prisma.$queryRaw<Array<{ entityId: string; action: string; reason: string | null; createdAt: Date }>>`
    select distinct on (entity_id) entity_id as "entityId", action, reason, created_at as "createdAt"
    from moderation_history
    where entity_type = 'REVIEW' and entity_id = any(${ids}::text[])
    order by entity_id, created_at desc
  `;
  return new Map(rows.map(({ entityId, ...decision }) => [entityId, decision]));
}

/** When an admin took down the court owner's reply to each review, and why (the latest take-down). */
export async function replyRemovals(ids: string[]) {
  if (!ids.length) return new Map<string, { reason: string | null; removedAt: Date }>();
  const rows = await prisma.$queryRaw<Array<{ entityId: string; reason: string | null; removedAt: Date }>>`
    select distinct on (entity_id) entity_id as "entityId", reason, created_at as "removedAt"
    from moderation_history
    where entity_type = 'REVIEW' and action = 'REPLY_REMOVED' and entity_id = any(${ids}::text[])
    order by entity_id, created_at desc
  `;
  return new Map(rows.map(({ entityId, ...removal }) => [entityId, removal]));
}

export type ReviewRow = {
  id: string;
  courtId: string;
  rating: number;
  comment: string | null;
  displayStatus: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; fullName: string; avatarUrl: string | null };
  /** The court owner's reply, signed with the business name. */
  reply: { content: string; repliedAt: string; businessName: string | null } | null;
};

const selectReview = `
  select
    r.id,
    r.court_id as "courtId",
    r.rating,
    r.comment,
    r.is_edited as "isEdited",
    r.display_status::text as "displayStatus",
    r.created_at as "createdAt",
    r.updated_at as "updatedAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "user",
    case when rr.review_id is null then null
         else json_build_object('content', rr.content, 'repliedAt', rr.updated_at, 'businessName', p.business_name)
    end as "reply"
  from reviews r
  join users u on u.id = r.user_id
  join courts c on c.id = r.court_id
  left join partner_profiles p on p.id = c.partner_id
  left join review_replies rr on rr.review_id = r.id
`;

let reviewTablesReady = false;

export async function ensureReviewTables() {
  if (reviewTablesReady) return;
  try {
    await prisma.$executeRaw`
      alter table reviews
      add column if not exists is_edited boolean not null default false
    `;
    reviewTablesReady = true;
  } catch (err: any) {
    console.warn("[ReviewRepository] Note on ensure review tables:", err?.message || err);
  }
}

export const ensureIsEditedColumn = ensureReviewTables;

export const reviewRepository = {
  async byCourt(courtId: string) {
    return prisma.$queryRawUnsafe<ReviewRow[]>(
      `
        ${selectReview}
        where r.court_id = $1
          and r.display_status = 'VISIBLE'::review_display_status
        order by r.updated_at desc, r.created_at desc
      `,
      courtId
    );
  },

  async byCourts(courtIds: string[]) {
    if (!courtIds.length) return new Map<string, ReviewRow[]>();
    const rows = await prisma.$queryRawUnsafe<ReviewRow[]>(
      `
        ${selectReview}
        where r.court_id = any($1::text[])
          and r.display_status = 'VISIBLE'::review_display_status
        order by r.updated_at desc, r.created_at desc
      `,
      courtIds
    );

    const map = new Map<string, ReviewRow[]>();
    for (const id of courtIds) map.set(id, []);
    for (const row of rows) {
      const list = map.get(row.courtId) ?? [];
      list.push(row);
      map.set(row.courtId, list);
    }
    return map;
  },

  async latestByUserCourt(userId: string, courtId: string) {
    return prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        select id
        from reviews
        where user_id = $1
          and court_id = $2
        order by updated_at desc, created_at desc
        limit 1
      `,
      userId,
      courtId
    );
  },

  async findById(id: string) {
    await ensureIsEditedColumn();
    return prisma.$queryRawUnsafe<ReviewRow[]>(
      `
        ${selectReview}
        where r.id = $1
        limit 1
      `,
      id
    );
  },

  async create(data: { userId: string; courtId: string; bookingId?: string | null; rating: number; comment?: string | null }) {
    await ensureIsEditedColumn();
    const [inserted] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        insert into reviews (user_id, court_id, booking_id, rating, comment, display_status)
        values ($1, $2, $3, $4, $5, 'VISIBLE'::review_display_status)
        returning id
      `,
      data.userId,
      data.courtId,
      data.bookingId ?? null,
      data.rating,
      data.comment ?? null
    );
    return inserted?.id ? this.findById(inserted.id) : [];
  },

  async update(id: string, data: { rating: number; comment?: string | null }) {
    await ensureIsEditedColumn();
    const [updated] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        update reviews
        set rating = $2,
            comment = $3,
            is_edited = true,
            updated_at = now()
        where id = $1
        returning id
      `,
      id,
      data.rating,
      data.comment ?? null
    );
    return updated?.id ? this.findById(updated.id) : [];
  },

  async delete(id: string) {
    await prisma.$executeRawUnsafe(
      `
        delete from reviews
        where id = $1
      `,
      id
    );
    return true;
  },

  /**
   * The customer's completed booking at the court that has no review yet (the given one, or the latest), which is
   * what a new review is attached to: only customers who played there review a court, once per booking.
   */
  reviewableBooking(userId: string, courtId: string, bookingId?: string | null) {
    return prisma.booking.findFirst({
      where: { id: bookingId ?? undefined, userId, courtId, bookingStatus: "COMPLETED", review: { is: null } },
      orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
      select: { id: true, bookingCode: true, bookingDate: true }
    });
  },

  completedBookingCount(userId: string, courtId: string) {
    return prisma.booking.count({ where: { userId, courtId, bookingStatus: "COMPLETED" } });
  },

  async list(filters: ReviewListFilters, page: number, limit: number) {
    const where = listWhere(filters);
    const [rows, total] = await Promise.all([
      prisma.review.findMany({ where, include: listInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.review.count({ where })
    ]);
    const [moderation, removals] = await Promise.all([latestModeration(rows.map((row) => row.id)), replyRemovals(rows.map((row) => row.id))]);
    const items = rows.map(({ is_edited, reply, ...row }) => ({
      ...row,
      isEdited: is_edited,
      // Played there: the review is attached to a booking of the reviewer that was completed.
      verified: row.booking?.bookingStatus === "COMPLETED",
      reply: reply ? { content: reply.content, repliedAt: reply.updatedAt } : null,
      moderation: moderation.get(row.id) ?? null,
      // An admin took the owner's reply down: it cannot be posted again.
      replyRemoval: removals.get(row.id) ?? null
    }));
    return { items, total };
  },

  /** A review of one of the partner's courts, with what replying to it needs; null when it is not theirs. */
  forPartner(id: string, partnerId: string) {
    return prisma.review.findFirst({
      where: { id, court: { partnerId } },
      select: { id: true, userId: true, courtId: true, displayStatus: true, reply: { select: { content: true } }, court: { select: { name: true } } }
    });
  },

  /** Writes the court owner's reply, or rewrites it (one per review); the review row itself is left untouched. */
  saveReply(reviewId: string, content: string, authorId: string) {
    return prisma.reviewReply.upsert({
      where: { reviewId },
      create: { reviewId, content, authorId },
      update: { content, authorId }
    });
  },

  async deleteReply(reviewId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
    const { count } = await db.reviewReply.deleteMany({ where: { reviewId } });
    return count > 0;
  },

  /** Review counts by rating and display status, for the averages a page shows next to its list. */
  ratingCounts(filters: Pick<ReviewListFilters, "partnerId" | "courtId">) {
    return prisma.review.groupBy({ by: ["rating", "displayStatus"], where: listWhere(filters), _count: { _all: true } });
  }
};
