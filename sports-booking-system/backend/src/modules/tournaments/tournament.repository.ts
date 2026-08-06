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
  },

  findPublicById(id: string) {
    return prisma.tournament.findFirst({ where: { id, status: { in: ["OPEN", "APPROVED"] } } });
  },

  registration(tournamentId: string, userId: string) {
    return prisma.tournamentRegistration.findUnique({ where: { tournamentId_userId: { tournamentId, userId } } });
  },

  register(input: { tournamentId: string; userId: string; teamName?: string; contactPhone: string; note?: string }) {
    return prisma.$transaction(async (tx) => {
      const registration = await tx.tournamentRegistration.create({ data: input });
      await tx.tournament.update({ where: { id: input.tournamentId }, data: { currentParticipants: { increment: 1 } } });
      return registration;
    });
  },

  partnerProfile(userId: string) {
    return prisma.partnerProfile.findUnique({ where: { userId } });
  },

  partnerCourt(courtId: string, partnerId: string) {
    return prisma.court.findFirst({ where: { id: courtId, partnerId } });
  },

  listPartner(partnerId: string) {
    return prisma.tournament.findMany({ where: { partnerId }, include: { court: true }, orderBy: { createdAt: "desc" } });
  },

  findPartnerTournament(id: string, partnerId: string) {
    return prisma.tournament.findFirst({ where: { id, partnerId } });
  },

  createPartner(partnerId: string, slug: string, input: any) {
    return prisma.tournament.create({
      data: {
        partnerId,
        courtId: input.courtId,
        title: input.title,
        slug,
        description: input.description,
        sportType: input.sportType,
        coverImageUrl: input.coverImageUrl,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        registrationDeadline: new Date(input.registrationDeadline),
        maxParticipants: input.maxParticipants,
        entryFee: input.entryFee,
        prizeDescription: input.prizeDescription,
        status: input.status
      }
    });
  },

  updatePartner(id: string, slug: string | undefined, input: any) {
    return prisma.tournament.update({
      where: { id },
      data: {
        courtId: input.courtId,
        title: input.title,
        slug,
        description: input.description,
        sportType: input.sportType,
        coverImageUrl: input.coverImageUrl,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : undefined,
        maxParticipants: input.maxParticipants,
        entryFee: input.entryFee,
        prizeDescription: input.prizeDescription,
        status: input.status
      }
    });
  },

  deletePartner(id: string) {
    return prisma.tournament.update({ where: { id }, data: { status: "CANCELLED" } });
  },

  registrations(tournamentId: string, partnerId: string) {
    return prisma.tournamentRegistration.findMany({
      where: { tournamentId, tournament: { partnerId } },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: "desc" }
    });
  },

  updateRegistration(id: string, status: "APPROVED" | "REJECTED") {
    return prisma.tournamentRegistration.update({ where: { id }, data: { status } });
  },

  registrationByPartner(id: string, partnerId: string) {
    return prisma.tournamentRegistration.findFirst({ where: { id, tournament: { partnerId } } });
  }
};
