import { prisma } from "../../config/db.js";

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  displayStatus: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; fullName: string; avatarUrl: string | null };
};

const selectReview = `
  select
    r.id,
    r.rating,
    r.comment,
    r.display_status::text as "displayStatus",
    r.created_at as "createdAt",
    r.updated_at as "updatedAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "user"
  from reviews r
  join users u on u.id = r.user_id
`;

export const reviewRepository = {
  byCourt(courtId: string) {
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

  latestByUserCourt(userId: string, courtId: string) {
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

  findById(id: string) {
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
    const [updated] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        update reviews
        set rating = $2,
            comment = $3,
            display_status = 'VISIBLE'::review_display_status,
            updated_at = now()
        where id = $1
        returning id
      `,
      id,
      data.rating,
      data.comment ?? null
    );
    return updated?.id ? this.findById(updated.id) : [];
  }
};
