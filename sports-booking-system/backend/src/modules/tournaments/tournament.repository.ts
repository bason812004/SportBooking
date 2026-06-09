import { prisma } from "../../config/db.js";

export type TournamentRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  sportType: string;
  coverImageUrl: string | null;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  maxParticipants: number;
  currentParticipants: number;
  entryFee: number;
  prizeDescription: string | null;
  status: string;
  partner: { id: string; businessName: string };
  court: { id: string; name: string; city: string; district: string; imageUrl: string | null };
};

export const tournamentRepository = {
  listPublic() {
    return prisma.$queryRaw<TournamentRow[]>`
      select
        t.id,
        t.title,
        t.slug,
        t.description,
        t.sport_type as "sportType",
        t.cover_image_url as "coverImageUrl",
        t.start_date as "startDate",
        t.end_date as "endDate",
        t.registration_deadline as "registrationDeadline",
        t.max_participants as "maxParticipants",
        t.current_participants as "currentParticipants",
        t.entry_fee::float as "entryFee",
        t.prize_description as "prizeDescription",
        t.status::text as "status",
        json_build_object('id', p.id, 'businessName', p.business_name) as "partner",
        json_build_object(
          'id', c.id,
          'name', c.name,
          'city', c.city,
          'district', c.district,
          'imageUrl', coalesce(t.cover_image_url, ci.image_url)
        ) as "court"
      from tournaments t
      join partner_profiles p on p.id = t.partner_id
      join courts c on c.id = t.court_id
      left join lateral (
        select image_url
        from court_images
        where court_id = c.id
        order by sort_order asc
        limit 1
      ) ci on true
      where t.status in ('OPEN'::tournament_status, 'APPROVED'::tournament_status)
      order by t.start_date asc
      limit 30
    `;
  },

  findPublicBySlug(slug: string) {
    return prisma.$queryRaw<TournamentRow[]>`
      select
        t.id,
        t.title,
        t.slug,
        t.description,
        t.sport_type as "sportType",
        t.cover_image_url as "coverImageUrl",
        t.start_date as "startDate",
        t.end_date as "endDate",
        t.registration_deadline as "registrationDeadline",
        t.max_participants as "maxParticipants",
        t.current_participants as "currentParticipants",
        t.entry_fee::float as "entryFee",
        t.prize_description as "prizeDescription",
        t.status::text as "status",
        json_build_object('id', p.id, 'businessName', p.business_name) as "partner",
        json_build_object(
          'id', c.id,
          'name', c.name,
          'city', c.city,
          'district', c.district,
          'imageUrl', coalesce(t.cover_image_url, ci.image_url)
        ) as "court"
      from tournaments t
      join partner_profiles p on p.id = t.partner_id
      join courts c on c.id = t.court_id
      left join lateral (
        select image_url
        from court_images
        where court_id = c.id
        order by sort_order asc
        limit 1
      ) ci on true
      where t.slug = ${slug}
        and t.status in ('OPEN'::tournament_status, 'APPROVED'::tournament_status)
      limit 1
    `;
  }
};
