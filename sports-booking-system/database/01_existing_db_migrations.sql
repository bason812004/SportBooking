-- Combined migrations for an existing Sports Booking database.
-- Run this only after the base schema exists.


-- ============================================================
-- Source: database\migrate_admin_management.sql
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id varchar(20) not null,
  action varchar(100) not null,
  entity_type varchar(80) not null,
  entity_id varchar(100) not null,
  metadata jsonb,
  previous_hash varchar(64),
  current_hash varchar(64) not null,
  created_at timestamptz not null default now()
);

alter table audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;
alter table audit_logs
  alter column actor_id type varchar(20) using actor_id::text;
alter table audit_logs
  add constraint audit_logs_actor_id_fkey foreign key (actor_id) references users(id);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor_id on audit_logs(actor_id);

create table if not exists blockchain_logs (
  id uuid primary key default gen_random_uuid(),
  audit_log_id uuid references audit_logs(id),
  entity_type varchar(80) not null,
  entity_id varchar(100) not null,
  payload_hash varchar(64) not null,
  network varchar(80) not null default 'NOT_CONFIGURED',
  tx_hash varchar(120),
  status varchar(30) not null default 'PENDING',
  error text,
  attempts integer not null default 0,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blockchain_logs_status on blockchain_logs(status);
create index if not exists idx_blockchain_logs_created_at on blockchain_logs(created_at desc);

create table if not exists moderation_history (
  id uuid primary key default gen_random_uuid(),
  entity_type varchar(80) not null,
  entity_id varchar(100) not null,
  action varchar(50) not null,
  reason text,
  actor_id varchar(20) not null,
  created_at timestamptz not null default now()
);

alter table moderation_history
  drop constraint if exists moderation_history_actor_id_fkey;
alter table moderation_history
  alter column actor_id type varchar(20) using actor_id::text;
alter table moderation_history
  add constraint moderation_history_actor_id_fkey foreign key (actor_id) references users(id);

create index if not exists idx_moderation_history_entity
  on moderation_history(entity_type, entity_id, created_at desc);


-- ============================================================
-- Source: database\migrate_booking_slots_payments.sql
-- ============================================================
-- Add multi-slot booking and QR payment foundation without dropping existing data.
-- This migration keeps the existing booking/payment enum values:
-- booking_status: PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
-- payment_status: UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED

alter type payment_status add value if not exists 'PARTIALLY_REFUNDED';

alter type payment_method add value if not exists 'QR_TRANSFER';
alter type payment_method add value if not exists 'ONLINE_GATEWAY';

do $$
begin
  create type payment_type as enum ('DEPOSIT', 'FULL_PAYMENT', 'REMAINING_PAYMENT');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type availability_block_status as enum ('ACTIVE', 'INACTIVE');
exception
  when duplicate_object then null;
end $$;

alter table court_availability_blocks
  add column if not exists status availability_block_status not null default 'ACTIVE';

create table if not exists booking_slots (
  id uuid primary key default gen_random_uuid(),
  booking_id varchar(20) not null references bookings(id) on delete cascade,
  court_id varchar(20) not null references courts(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  slot_price numeric(12, 2) not null check (slot_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_slots_time_check check (start_time < end_time)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id varchar(20) not null references bookings(id) on delete cascade,
  user_id varchar(20) not null references users(id) on delete cascade,
  provider varchar(60) not null,
  payment_method payment_method not null,
  payment_type payment_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency varchar(3) not null default 'VND',
  status payment_status not null default 'UNPAID',
  external_order_id varchar(80) not null unique,
  external_transaction_id varchar(120),
  qr_code_url text,
  qr_payload text,
  payment_reference varchar(80) not null,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  provider varchar(60) not null,
  provider_transaction_id varchar(120) not null,
  provider_status varchar(40) not null,
  amount numeric(12, 2) not null check (amount >= 0),
  raw_payload_json jsonb not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_payment_transactions_provider_tx unique(provider, provider_transaction_id)
);

create index if not exists idx_courts_sport_location_status
  on courts(category_id, city, district, active_status, approval_status);
create index if not exists idx_courts_lat_lng on courts(latitude, longitude);
create index if not exists idx_court_prices_lookup on court_prices(court_id, day_type, start_time, end_time);
create index if not exists idx_booking_slots_schedule on booking_slots(court_id, booking_date, start_time, end_time);
create index if not exists idx_booking_slots_booking_id on booking_slots(booking_id);
create index if not exists idx_payments_booking_id on payments(booking_id);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_payments_status_expires_at on payments(status, expires_at);
create index if not exists idx_payment_transactions_payment_id on payment_transactions(payment_id);


-- ============================================================
-- User voucher wallet: stores vouchers claimed by each user.
-- Safe for existing databases that were created before vouchers.
-- ============================================================
do $$
begin
  create type user_voucher_status as enum ('CLAIMED', 'USED', 'EXPIRED');
exception
  when duplicate_object then null;
end $$;

create sequence if not exists seq_user_vouchers;

create table if not exists user_vouchers (
  id varchar(40) primary key default ('uv' || lpad(nextval('seq_user_vouchers')::text, 4, '0')),
  user_id varchar(20) not null,
  voucher_id varchar(20) not null,
  status user_voucher_status not null default 'CLAIMED',
  claimed_at timestamptz not null default now(),
  used_at timestamptz
);

alter table user_vouchers
  drop constraint if exists user_vouchers_user_id_fkey;
alter table user_vouchers
  drop constraint if exists user_vouchers_voucher_id_fkey;

alter table user_vouchers
  alter column id type varchar(40) using id::text,
  alter column id set default ('uv' || lpad(nextval('seq_user_vouchers')::text, 4, '0')),
  alter column user_id type varchar(20) using user_id::text,
  alter column voucher_id type varchar(20) using voucher_id::text,
  alter column status type user_voucher_status using status::text::user_voucher_status,
  alter column status set default 'CLAIMED'::user_voucher_status,
  alter column claimed_at set default now();

alter table user_vouchers
  add constraint user_vouchers_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table user_vouchers
  add constraint user_vouchers_voucher_id_fkey foreign key (voucher_id) references vouchers(id) on delete cascade;

create unique index if not exists user_vouchers_user_voucher_unique on user_vouchers(user_id, voucher_id);
create index if not exists idx_user_vouchers_user_id on user_vouchers(user_id);
create index if not exists idx_user_vouchers_voucher_id on user_vouchers(voucher_id);


-- ============================================================
-- Blog moderation, comment toggles, and search support.
-- ============================================================
alter table if exists blog_posts
  add column if not exists allow_comments boolean not null default true;

update blog_posts
set allow_comments = true
where allow_comments is null;

create index if not exists idx_blog_posts_public_search
  on blog_posts (status, visibility, published_at desc, created_at desc);

create index if not exists idx_blog_posts_allow_comments
  on blog_posts (allow_comments);


-- ============================================================
-- Group chat for team recruitment posts.
-- ============================================================
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

-- Source: database\09_court_deposit_percent.sql
alter table courts
  add column if not exists deposit_percent numeric(5, 2) null;

alter table courts
  drop constraint if exists courts_deposit_percent_check;

alter table courts
  add constraint courts_deposit_percent_check
  check (deposit_percent is null or (deposit_percent >= 0 and deposit_percent < 50));

-- Source: database\10_recipient_role_seed.sql
alter type user_role add value if not exists 'RECIPIENT';

alter table users
  add column if not exists partner_id varchar(20);

alter table users
  add column if not exists managed_court_id varchar(20);

alter table users
  drop constraint if exists users_partner_id_fkey;

alter table users
  drop constraint if exists users_managed_court_id_fkey;

alter table users
  add constraint users_partner_id_fkey
  foreign key (partner_id) references partner_profiles(id) on delete cascade;

alter table users
  add constraint users_managed_court_id_fkey
  foreign key (managed_court_id) references courts(id) on delete set null;

create index if not exists idx_users_partner_id on users(partner_id);
create index if not exists idx_users_managed_court_id on users(managed_court_id);

insert into users (
  id, full_name, email, phone, password_hash, role, provider, provider_id,
  email_verified, status, partner_id, managed_court_id
)
select
  'u0091',
  'Recipient San Sala',
  'partner1+recipient@sportsbooking.com',
  '0900000091',
  crypt('123456', gen_salt('bf', 10)),
  'RECIPIENT'::user_role,
  'LOCAL'::auth_provider,
  null,
  true,
  'ACTIVE'::account_status,
  'pp0001',
  'c0001'
where exists (select 1 from partner_profiles where id = 'pp0001')
  and exists (select 1 from courts where id = 'c0001' and partner_id = 'pp0001')
on conflict (email) do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  password_hash = excluded.password_hash,
  role = excluded.role,
  provider = excluded.provider,
  provider_id = excluded.provider_id,
  email_verified = excluded.email_verified,
  status = excluded.status,
  partner_id = excluded.partner_id,
  managed_court_id = excluded.managed_court_id,
  updated_at = now();
