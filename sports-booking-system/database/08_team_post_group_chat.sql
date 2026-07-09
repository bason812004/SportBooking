-- Group chat for team recruitment posts.
-- Safe for existing databases; run after team_recruitment_posts and users exist.

create sequence if not exists seq_team_post_members;
create sequence if not exists seq_team_post_messages;

create table if not exists team_post_members (
  id varchar(20) primary key default ('tpm' || lpad(nextval('seq_team_post_members')::text, 4, '0')),
  post_id varchar(20) not null,
  user_id varchar(20) not null,
  role varchar(20) not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  unique(post_id, user_id)
);

alter table team_post_members
  drop constraint if exists team_post_members_post_id_fkey,
  drop constraint if exists team_post_members_user_id_fkey;

alter table team_post_members
  alter column id type varchar(20) using id::text,
  alter column post_id type varchar(20) using post_id::text,
  alter column user_id type varchar(20) using user_id::text,
  alter column id set default ('tpm' || lpad(nextval('seq_team_post_members')::text, 4, '0')),
  alter column role set default 'MEMBER',
  alter column joined_at set default now();

alter table team_post_members
  add constraint team_post_members_post_id_fkey foreign key (post_id) references team_recruitment_posts(id) on delete cascade,
  add constraint team_post_members_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

create table if not exists team_post_messages (
  id varchar(20) primary key default ('tmsg' || lpad(nextval('seq_team_post_messages')::text, 4, '0')),
  post_id varchar(20) not null,
  user_id varchar(20) not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table team_post_messages
  drop constraint if exists team_post_messages_post_id_fkey,
  drop constraint if exists team_post_messages_user_id_fkey;

alter table team_post_messages
  alter column id type varchar(20) using id::text,
  alter column post_id type varchar(20) using post_id::text,
  alter column user_id type varchar(20) using user_id::text,
  alter column id set default ('tmsg' || lpad(nextval('seq_team_post_messages')::text, 4, '0')),
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table team_post_messages
  add constraint team_post_messages_post_id_fkey foreign key (post_id) references team_recruitment_posts(id) on delete cascade,
  add constraint team_post_messages_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

create unique index if not exists ux_team_post_members_post_user on team_post_members(post_id, user_id);

insert into team_post_members (post_id, user_id, role)
select id, user_id, 'OWNER'
from team_recruitment_posts
on conflict (post_id, user_id) do nothing;

drop trigger if exists trg_team_post_messages_updated_at on team_post_messages;
create trigger trg_team_post_messages_updated_at
  before update on team_post_messages
  for each row execute function set_updated_at();

create index if not exists idx_team_post_members_post_id on team_post_members(post_id);
create index if not exists idx_team_post_members_user_id on team_post_members(user_id);
create index if not exists idx_team_post_messages_post_created on team_post_messages(post_id, created_at desc);
