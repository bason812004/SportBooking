import { prisma } from "../../config/db.js";
const selectPost = `
  select
    p.id,
    p.title,
    p.sport_type as "sportType",
    p.court_name as "courtName",
    p.address,
    p.current_players as "currentPlayers",
    p.max_players as "maxPlayers",
    p.missing_players as "missingPlayers",
    p.playing_date as "playingDate",
    p.start_time::text as "startTime",
    p.end_time::text as "endTime",
    p.price_per_person::float as "pricePerPerson",
    p.extra_services as "extraServices",
    p.note,
    p.zalo_group_link as "zaloGroupLink",
    p.zalo_qr_image as "zaloQrImage",
    p.status::text as "status",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "createdBy"
  from team_recruitment_posts p
  join users u on u.id = p.user_id
`;
export const teamPostRepository = {
    list() {
        return prisma.$queryRawUnsafe(`
      ${selectPost}
      where p.status = 'OPEN'::team_recruitment_status
      order by p.playing_date nulls last, p.start_time asc, p.created_at desc
      limit 60
    `);
    },
    findById(id) {
        return prisma.$queryRawUnsafe(`
        ${selectPost}
        where p.id = $1::uuid
        limit 1
      `, id);
    },
    create(input) {
        return prisma.$queryRawUnsafe(`
      with inserted as (
        insert into team_recruitment_posts (
          user_id, court_id, title, sport_type, court_name, address,
          current_players, max_players, playing_date, start_time, end_time,
          price_per_person, extra_services, note, zalo_group_link, zalo_qr_image
        ) values (
          $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::date, $10::time, $11::time,
          $12, $13, $14, $15, $16
        )
        returning id
      )
      ${selectPost}
      join inserted i on i.id = p.id
      limit 1
    `, input.userId, input.courtId ?? null, input.title, input.sportType, input.courtName, input.address, input.currentPlayers, input.maxPlayers, input.playingDate ?? null, input.startTime, input.endTime, input.pricePerPerson, input.extraServices ?? null, input.note ?? null, input.zaloGroupLink ?? null, input.zaloQrImage ?? null);
    },
    update(id, input) {
        return prisma.$queryRawUnsafe(`
      with updated as (
        update team_recruitment_posts
        set
          court_id = $3::uuid,
          title = $4,
          sport_type = $5,
          court_name = $6,
          address = $7,
          current_players = $8,
          max_players = $9,
          playing_date = $10::date,
          start_time = $11::time,
          end_time = $12::time,
          price_per_person = $13,
          extra_services = $14,
          note = $15,
          zalo_group_link = $16,
          zalo_qr_image = $17
        where id = $1::uuid
          and user_id = $2::uuid
        returning id
      )
      ${selectPost}
      join updated u2 on u2.id = p.id
      limit 1
    `, id, input.userId, input.courtId ?? null, input.title, input.sportType, input.courtName, input.address, input.currentPlayers, input.maxPlayers, input.playingDate ?? null, input.startTime, input.endTime, input.pricePerPerson, input.extraServices ?? null, input.note ?? null, input.zaloGroupLink ?? null, input.zaloQrImage ?? null);
    },
    delete(id, userId) {
        return prisma.$executeRaw `
      delete from team_recruitment_posts
      where id = ${id}::uuid
        and user_id = ${userId}::uuid
    `;
    },
    join(id) {
        return prisma.$queryRawUnsafe(`
      with joined as (
        update team_recruitment_posts
        set current_players = current_players + 1
        where id = $1::uuid
          and status = 'OPEN'::team_recruitment_status
          and current_players < max_players
        returning id
      )
      ${selectPost}
      join joined j on j.id = p.id
      limit 1
    `, id);
    }
};
