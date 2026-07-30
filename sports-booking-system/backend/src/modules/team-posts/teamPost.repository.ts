import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

export type TeamPostRow = {
  id: string;
  title: string;
  sportType: string;
  courtName: string;
  address: string;
  currentPlayers: number;
  maxPlayers: number;
  missingPlayers: number;
  playingDate: Date | null;
  startTime: string;
  endTime: string;
  pricePerPerson: number;
  extraServices: string | null;
  note: string | null;
  zaloGroupLink: string | null;
  zaloQrImage: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; fullName: string; avatarUrl: string | null };
};

export type TeamPostInput = {
  userId: string;
  courtId?: string | null;
  title: string;
  sportType: string;
  courtName: string;
  address: string;
  currentPlayers: number;
  maxPlayers: number;
  playingDate?: string | null;
  startTime: string;
  endTime: string;
  pricePerPerson: number;
  extraServices?: string | null;
  note?: string | null;
  zaloGroupLink?: string | null;
  zaloQrImage?: string | null;
};

export type TeamPostMessageRow = {
  id: string;
  postId: string;
  content: string | null;
  messageType: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
  sender: { id: string; fullName: string; avatarUrl: string | null };
  reactions?: Array<{ reaction: string; userId: string; createdAt: Date }>;
};

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

const selectMessage = `
  select
    msg.id,
    msg.post_id as "postId",
    msg.content,
    msg.message_type::text as "messageType",
    msg.attachment_url as "attachmentUrl",
    msg.attachment_name as "attachmentName",
    msg.attachment_size as "attachmentSize",
    msg.thumbnail_url as "thumbnailUrl",
    msg.mime_type as "mimeType",
    msg.created_at as "createdAt",
    msg.updated_at as "updatedAt",
    json_build_object('id', u.id, 'fullName', u.full_name, 'avatarUrl', u.avatar_url) as "sender"
  from team_post_messages msg
  join users u on u.id = msg.user_id
`;

let chatTablesReady = false;

async function ensureTeamChatTables() {
  if (chatTablesReady) return;

  const statements = [
    "create sequence if not exists seq_team_post_members",
    "create sequence if not exists seq_team_post_messages",
    "create sequence if not exists seq_team_post_message_reactions",
    `
    create table if not exists team_post_members (
      id varchar(20) primary key default ('tpm' || lpad(nextval('seq_team_post_members')::text, 4, '0')),
      post_id varchar(20) not null references team_recruitment_posts(id) on delete cascade,
      user_id varchar(20) not null references users(id) on delete cascade,
      role varchar(20) not null default 'MEMBER',
      status varchar(20) not null default 'ACTIVE',
      joined_at timestamptz not null default now(),
      left_at timestamptz,
      unique(post_id, user_id)
    )
    `,
    `
    create table if not exists team_post_messages (
      id varchar(20) primary key default ('tmsg' || lpad(nextval('seq_team_post_messages')::text, 4, '0')),
      post_id varchar(20) not null references team_recruitment_posts(id) on delete cascade,
      user_id varchar(20) not null references users(id) on delete cascade,
      content text,
      message_type varchar(20) not null default 'TEXT',
      attachment_url text,
      attachment_name varchar(255),
      attachment_size integer,
      thumbnail_url text,
      mime_type varchar(80),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
    `,
    "create unique index if not exists ux_team_post_members_post_user on team_post_members(post_id, user_id)",
    `
    insert into team_post_members (post_id, user_id, role)
    select id, user_id, 'OWNER'
    from team_recruitment_posts
    on conflict (post_id, user_id) do nothing
    `,
    "create index if not exists idx_team_post_members_post_id on team_post_members(post_id)",
    "create index if not exists idx_team_post_members_user_id on team_post_members(user_id)",
    "create index if not exists idx_team_post_messages_post_created on team_post_messages(post_id, created_at desc)",
    `
    create table if not exists team_post_message_reactions (
      id varchar(24) primary key default ('tmr' || lpad(nextval('seq_team_post_message_reactions')::text, 6, '0')),
      message_id varchar(20) not null references team_post_messages(id) on delete cascade,
      user_id varchar(20) not null references users(id) on delete cascade,
      reaction varchar(16) not null,
      created_at timestamptz not null default now(),
      unique(message_id, user_id)
    )
    `,
    "create unique index if not exists ux_team_post_message_reactions_msg_user on team_post_message_reactions(message_id, user_id)",
    "create index if not exists idx_team_post_message_reactions_message on team_post_message_reactions(message_id)"
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  chatTablesReady = true;
}

export const teamPostRepository = {
  list() {
    return prisma.$queryRawUnsafe<TeamPostRow[]>(`
      ${selectPost}
      where p.status = 'OPEN'::team_recruitment_status
      order by p.playing_date nulls last, p.start_time asc, p.created_at desc
      limit 60
    `);
  },

  listMine(userId: string) {
    return prisma.$queryRawUnsafe<TeamPostRow[]>(
      `
        ${selectPost}
        where p.user_id = $1
        order by p.updated_at desc, p.created_at desc
        limit 100
      `,
      userId
    );
  },

  async listJoined(userId: string) {
    await ensureTeamChatTables();
    return prisma.$queryRawUnsafe<TeamPostRow[]>(
      `
        ${selectPost}
        join team_post_members m on m.post_id = p.id
        where m.user_id = $1
          and m.status = 'ACTIVE'
          and (p.user_id = $1 or m.id is not null)
        order by p.playing_date nulls last, p.start_time asc, p.updated_at desc
        limit 100
      `,
      userId
    );
  },

  findById(id: string) {
    return prisma.$queryRawUnsafe<TeamPostRow[]>(
      `
        ${selectPost}
        where p.id = $1
        limit 1
      `,
      id
    );
  },

  async create(input: TeamPostInput) {
    const [inserted] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        insert into team_recruitment_posts (
          user_id, court_id, title, sport_type, court_name, address,
          current_players, max_players, playing_date, start_time, end_time,
          price_per_person, extra_services, note, zalo_group_link, zalo_qr_image
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::time, $11::time,
          $12, $13, $14, $15, $16
        )
        returning id
      `,
      input.userId,
      input.courtId ?? null,
      input.title,
      input.sportType,
      input.courtName,
      input.address,
      input.currentPlayers,
      input.maxPlayers,
      input.playingDate ?? null,
      input.startTime,
      input.endTime,
      input.pricePerPerson,
      input.extraServices ?? null,
      input.note ?? null,
      input.zaloGroupLink ?? null,
      input.zaloQrImage ?? null
    );
    if (!inserted?.id) return [];

    await ensureTeamChatTables();
    await prisma.$executeRaw`
      insert into team_post_members (post_id, user_id, role)
      values (${inserted.id}, ${input.userId}, 'OWNER')
      on conflict (post_id, user_id) do nothing
    `;
    return this.findById(inserted.id);
  },

  async update(id: string, input: TeamPostInput) {
    const [updated] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        update team_recruitment_posts
        set
          court_id = $3,
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
          zalo_qr_image = $17,
          updated_at = now()
        where id = $1
          and user_id = $2
        returning id
      `,
      id,
      input.userId,
      input.courtId ?? null,
      input.title,
      input.sportType,
      input.courtName,
      input.address,
      input.currentPlayers,
      input.maxPlayers,
      input.playingDate ?? null,
      input.startTime,
      input.endTime,
      input.pricePerPerson,
      input.extraServices ?? null,
      input.note ?? null,
      input.zaloGroupLink ?? null,
      input.zaloQrImage ?? null
    );
    return updated?.id ? this.findById(updated.id) : [];
  },

  delete(id: string, userId: string) {
    return prisma.$executeRaw`
      delete from team_recruitment_posts
      where id = ${id}
        and user_id = ${userId}
    `;
  },

  async join(id: string, userId: string) {
    await ensureTeamChatTables();

    // Fast path: already an active member
    const [existing] = await prisma.$queryRaw<Array<{ status: string | null }>>`
      select status
      from team_post_members
      where post_id = ${id} and user_id = ${userId}
      limit 1
    `;
    if (existing?.status === "ACTIVE") return this.findById(id);

    // Attempt to insert (idempotent: ON CONFLICT do nothing for duplicate)
    await prisma.$executeRaw`
      insert into team_post_members (post_id, user_id, role, status)
      values (${id}, ${userId}, 'MEMBER', 'ACTIVE')
      on conflict (post_id, user_id)
        do update set status = 'ACTIVE', left_at = null
        where team_post_members.status <> 'ACTIVE'
    `;

    // Update player count and status on the post
    await prisma.$executeRaw`
      update team_recruitment_posts
      set
        current_players = (
          select count(*)::int
          from team_post_members
          where post_id = ${id} and status = 'ACTIVE'
        ),
        status = case
          when (
            select count(*)::int
            from team_post_members
            where post_id = ${id} and status = 'ACTIVE'
          ) >= max_players
          then 'FULL'::team_recruitment_status
          else status
        end,
        updated_at = now()
      where id = ${id}
    `;

    return this.findById(id);
  },

  async isMember(postId: string, userId: string) {
    await ensureTeamChatTables();
    const [row] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      select exists (
        select 1
        from team_recruitment_posts p
        where p.id = ${postId}
          and (
            p.user_id = ${userId}
            or exists (
              select 1 from team_post_members m
              where m.post_id = p.id
                and m.user_id = ${userId}
                and m.status = 'ACTIVE'
            )
          )
      ) as "exists"
    `;
    return Boolean(row?.exists);
  },

  async listMessages(postId: string) {
    await ensureTeamChatTables();
    return prisma.$queryRawUnsafe<TeamPostMessageRow[]>(
      `
        ${selectMessage}
        where msg.post_id = $1
        order by msg.created_at asc
        limit 200
      `,
      postId
    );
  },

  async createMessage(
    postId: string,
    userId: string,
    payload: {
      content?: string | null;
      messageType?: string;
      attachmentUrl?: string | null;
      attachmentName?: string | null;
      attachmentSize?: number | null;
      thumbnailUrl?: string | null;
      mimeType?: string | null;
    }
  ) {
    await ensureTeamChatTables();
    const contentVal = payload.content ?? null;
    const msgType = (payload.messageType ?? "TEXT") as string;
    const [inserted] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `insert into team_post_messages
        (post_id, user_id, content, message_type, attachment_url, attachment_name, attachment_size, thumbnail_url, mime_type)
       values ($1, $2, $3, $4::team_post_message_type, $5, $6, $7, $8, $9)
       returning id`,
      postId, userId, contentVal, msgType,
      payload.attachmentUrl ?? null,
      payload.attachmentName ?? null,
      payload.attachmentSize ?? null,
      payload.thumbnailUrl ?? null,
      payload.mimeType ?? null
    );
    if (!inserted?.id) return [];

    return this.listMessages(postId);
  },

  async getMember(postId: string, userId: string) {
    await ensureTeamChatTables();
    const rows = await prisma.$queryRaw<Array<{ role: string; status: string }>>`
      select role, status
      from team_post_members
      where post_id = ${postId} and user_id = ${userId}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listMembers(postId: string) {
    await ensureTeamChatTables();
    const rows = await prisma.$queryRaw<Array<{
      userId: string;
      fullName: string;
      avatarUrl: string | null;
      role: string;
      status: string;
      joinedAt: Date;
    }>>`
      select m.user_id as "userId", u.full_name as "fullName", u.avatar_url as "avatarUrl",
             m.role, m.status, m.joined_at as "joinedAt"
      from team_post_members m
      join users u on u.id = m.user_id
      where m.post_id = ${postId} and (m.status = 'ACTIVE' or m.status is null)
      order by (case when m.role = 'OWNER' then 0 when m.role = 'ADMIN' then 1 else 2 end), m.joined_at asc
    `;
    return rows;
  },

  async countActiveAdmins(postId: string) {
    await ensureTeamChatTables();
    const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from team_post_members
      where post_id = ${postId}
        and status = 'ACTIVE'
        and role in ('OWNER', 'ADMIN')
    `;
    return row?.count ?? 0;
  },

  async leaveGroup(postId: string, userId: string) {
    await ensureTeamChatTables();
    return prisma.$executeRaw`
      update team_post_members
      set status = 'LEFT', left_at = now(), updated_at = now()
      where post_id = ${postId} and user_id = ${userId} and status = 'ACTIVE'
    `;
  },

  async removeMember(postId: string, userId: string) {
    await ensureTeamChatTables();
    return prisma.$executeRaw`
      update team_post_members
      set status = 'REMOVED', left_at = now(), updated_at = now()
      where post_id = ${postId} and user_id = ${userId} and status = 'ACTIVE'
    `;
  },

  async updateMemberRole(postId: string, userId: string, role: "OWNER" | "ADMIN" | "MEMBER") {
    await ensureTeamChatTables();
    return prisma.$executeRaw`
      update team_post_members
      set role = ${role}, updated_at = now()
      where post_id = ${postId} and user_id = ${userId} and status = 'ACTIVE'
    `;
  },

  async upsertReaction(messageId: string, userId: string, reaction: string) {
    await ensureTeamChatTables();
    const rows = await prisma.$queryRaw<Array<{ id: string; reaction: string; createdAt: Date }>>`
      insert into team_post_message_reactions (message_id, user_id, reaction)
      values (${messageId}, ${userId}, ${reaction})
      on conflict (message_id, user_id) do update set reaction = excluded.reaction, created_at = now()
      returning id, reaction, created_at as "createdAt"
    `;
    return rows[0];
  },

  async removeReaction(messageId: string, userId: string) {
    await ensureTeamChatTables();
    return prisma.$executeRaw`
      delete from team_post_message_reactions
      where message_id = ${messageId} and user_id = ${userId}
    `;
  },

  async listReactionsForMessages(messageIds: string[]) {
    await ensureTeamChatTables();
    if (messageIds.length === 0) return [];
    const rows = await prisma.$queryRaw<Array<{
      messageId: string;
      userId: string;
      reaction: string;
      createdAt: Date;
    }>>(Prisma.sql`
      select message_id as "messageId",
             user_id as "userId",
             reaction,
             created_at as "createdAt"
      from team_post_message_reactions
      where message_id in (${Prisma.join(messageIds)})
    `);
    return rows;
  },

  async messageBelongsToPost(messageId: string, postId: string) {
    const [row] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      select exists (
        select 1 from team_post_messages where id = ${messageId} and post_id = ${postId}
      ) as "exists"
    `;
    return Boolean(row?.exists);
  }
};
