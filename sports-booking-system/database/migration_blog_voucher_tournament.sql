-- Migration thêm bảng Blog, Voucher và Giải đấu cho database hiện tại.
-- Chạy file này trước database/seed_blog_voucher_tournament.sql nếu DB của bạn đã tồn tại từ trước.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'voucher_discount_type') then
    create type voucher_discount_type as enum ('PERCENTAGE', 'FIXED_AMOUNT');
  end if;
  if not exists (select 1 from pg_type where typname = 'voucher_status') then
    create type voucher_status as enum ('DRAFT', 'ACTIVE', 'EXPIRED', 'DISABLED');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_voucher_status') then
    create type user_voucher_status as enum ('CLAIMED', 'USED', 'EXPIRED');
  end if;
  if not exists (select 1 from pg_type where typname = 'blog_post_status') then
    create type blog_post_status as enum ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');
  end if;
  if not exists (select 1 from pg_type where typname = 'blog_visibility') then
    create type blog_visibility as enum ('PUBLIC', 'PRIVATE');
  end if;
  if not exists (select 1 from pg_type where typname = 'tournament_status') then
    create type tournament_status as enum ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED');
  end if;
  if not exists (select 1 from pg_type where typname = 'tournament_registration_status') then
    create type tournament_registration_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  end if;
end $$;

create table if not exists vouchers (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partner_profiles(id) on delete cascade,
  court_id uuid references courts(id) on delete cascade,
  code varchar(40) not null unique,
  title varchar(160) not null,
  description text,
  discount_type voucher_discount_type not null,
  discount_value numeric(12, 2) not null check (discount_value > 0),
  max_discount_amount numeric(12, 2) check (max_discount_amount is null or max_discount_amount >= 0),
  min_booking_amount numeric(12, 2) not null default 0 check (min_booking_amount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  start_date timestamptz not null,
  end_date timestamptz not null,
  status voucher_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vouchers_valid_date_check check (start_date < end_date),
  constraint vouchers_usage_check check (usage_limit is null or used_count <= usage_limit)
);

create table if not exists user_vouchers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  voucher_id uuid not null references vouchers(id) on delete cascade,
  status user_voucher_status not null default 'CLAIMED',
  claimed_at timestamptz not null default now(),
  used_at timestamptz,
  unique(user_id, voucher_id)
);

create table if not exists booking_vouchers (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  voucher_id uuid not null references vouchers(id),
  discount_amount numeric(12, 2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists blog_categories (
  id uuid primary key default uuid_generate_v4(),
  name varchar(120) not null unique,
  slug varchar(140) not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog_posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references users(id) on delete cascade,
  title varchar(220) not null,
  slug varchar(240) not null unique,
  excerpt text,
  content text not null,
  cover_image_url text,
  category_id uuid references blog_categories(id),
  status blog_post_status not null default 'DRAFT',
  visibility blog_visibility not null default 'PUBLIC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists blog_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog_likes (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references blog_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists tournaments (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partner_profiles(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  title varchar(220) not null,
  slug varchar(240) not null unique,
  description text,
  sport_type varchar(80) not null,
  cover_image_url text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  registration_deadline timestamptz not null,
  max_participants integer not null check (max_participants > 0),
  current_participants integer not null default 0 check (current_participants >= 0),
  entry_fee numeric(12, 2) not null default 0 check (entry_fee >= 0),
  prize_description text,
  status tournament_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_date_check check (registration_deadline <= start_date and start_date <= end_date),
  constraint tournaments_capacity_check check (current_participants <= max_participants)
);

create table if not exists tournament_registrations (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  team_name varchar(160),
  contact_phone varchar(30) not null,
  note text,
  status tournament_registration_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique(tournament_id, user_id)
);

create index if not exists idx_vouchers_partner_id on vouchers(partner_id);
create index if not exists idx_vouchers_court_id on vouchers(court_id);
create index if not exists idx_vouchers_status on vouchers(status);
create index if not exists idx_vouchers_date_range on vouchers(start_date, end_date);
create index if not exists idx_user_vouchers_user_id on user_vouchers(user_id);
create index if not exists idx_booking_vouchers_booking_id on booking_vouchers(booking_id);
create index if not exists idx_blog_posts_author_id on blog_posts(author_id);
create index if not exists idx_blog_posts_status on blog_posts(status);
create index if not exists idx_blog_posts_slug on blog_posts(slug);
create index if not exists idx_blog_comments_post_id on blog_comments(post_id);
create index if not exists idx_tournaments_partner_id on tournaments(partner_id);
create index if not exists idx_tournaments_court_id on tournaments(court_id);
create index if not exists idx_tournaments_status on tournaments(status);
create index if not exists idx_tournaments_slug on tournaments(slug);
create index if not exists idx_tournament_registrations_tournament_id on tournament_registrations(tournament_id);
create index if not exists idx_tournament_registrations_user_id on tournament_registrations(user_id);
