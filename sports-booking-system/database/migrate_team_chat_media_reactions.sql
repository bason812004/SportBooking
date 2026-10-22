-- Migration: Extend team group chat with media, reactions, member roles.
-- Safe for existing databases (uses if not exists / add column if not exists).
-- Run this file once, then `npx prisma generate`.

-- 1. Enum: message_type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_post_message_type') then
    create type team_post_message_type as enum ('TEXT', 'IMAGE', 'VIDEO', 'SYSTEM');
  end if;
end $$;

-- 2. Extend team_post_messages with media columns
alter table team_post_messages
  add column if not exists message_type team_post_message_type not null default 'TEXT',
  add column if not exists attachment_url text,
  add column if not exists attachment_name varchar(255),
  add column if not exists attachment_size integer,
  add column if not exists thumbnail_url text,
  add column if not exists mime_type varchar(80);

-- 2b. Allow media-only messages (IMAGE / VIDEO) to omit text content.
alter table team_post_messages
  alter column content drop not null;

-- 3. Reactions table
create sequence if not exists seq_team_post_message_reactions;

create table if not exists team_post_message_reactions (
  id varchar(24) primary key default ('tmr' || lpad(nextval('seq_team_post_message_reactions')::text, 6, '0')),
  message_id varchar(20) not null references team_post_messages(id) on delete cascade,
  user_id varchar(20) not null references users(id) on delete cascade,
  reaction varchar(16) not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id)
);

create unique index if not exists ux_team_post_message_reactions_msg_user
  on team_post_message_reactions(message_id, user_id);
create index if not exists idx_team_post_message_reactions_message
  on team_post_message_reactions(message_id);

-- 4. Extend group_members: role + status + timestamps
alter table team_post_members
  add column if not exists role varchar(20) not null default 'MEMBER',
  add column if not exists status varchar(20) not null default 'ACTIVE',
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists left_at timestamptz;

-- 5. Backfill role: OWNER for the original creator if currently MEMBER
update team_post_members m
set role = 'OWNER'
from team_recruitment_posts p
where m.post_id = p.id
  and m.user_id = p.user_id
  and m.role = 'MEMBER';

-- 6. Performance indexes used by realtime + chat pagination
create index if not exists idx_team_post_members_status on team_post_members(post_id, status);
create index if not exists idx_team_post_messages_created_id on team_post_messages(post_id, created_at desc, id);
create index if not exists idx_team_post_messages_type on team_post_messages(message_type);

-- 7. Auth performance indexes
create index if not exists idx_users_email_lower on users(lower(email));
create index if not exists idx_users_role on users(role);

-- 8. Booking/voucher performance indexes
create index if not exists idx_bookings_user_date on bookings(user_id, booking_date);
create index if not exists idx_bookings_court_date on bookings(court_id, booking_date);
create index if not exists idx_user_vouchers_user_status on user_vouchers(user_id, status);
create index if not exists idx_vouchers_code on vouchers(code);
