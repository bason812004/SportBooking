-- ============================================================
-- sports-booking-system - Complete Database Schema
-- Bao gồm tất cả bảng + Settlement System + Platform Vouchers
-- Chạy: Supabase Dashboard > SQL Editor > New query > paste
-- ============================================================

create extension if not exists "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────────────

do $$ begin create type user_role as enum ('USER','PARTNER','ADMIN','RECIPIENT');
exception when duplicate_object then null; end $$;
do $$ begin create type auth_provider as enum ('LOCAL','GOOGLE');
exception when duplicate_object then null; end $$;
do $$ begin create type account_status as enum ('ACTIVE','LOCKED','INACTIVE');
exception when duplicate_object then null; end $$;
do $$ begin create type court_active_status as enum ('ACTIVE','INACTIVE','MAINTENANCE');
exception when duplicate_object then null; end $$;
do $$ begin create type court_approval_status as enum ('PENDING','APPROVED','REJECTED','NEEDS_UPDATE');
exception when duplicate_object then null; end $$;
do $$ begin create type day_type as enum ('WEEKDAY','WEEKEND','HOLIDAY');
exception when duplicate_object then null; end $$;
do $$ begin create type booking_status as enum ('PENDING','PENDING_PAYMENT','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW','REJECTED');
exception when duplicate_object then null; end $$;
do $$ begin create type payment_status as enum ('UNPAID','PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED','EXPIRED');
exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('CASH','BANK_TRANSFER','QR_TRANSFER','ONLINE_GATEWAY','MOMO','VNPAY','ZALOPAY');
exception when duplicate_object then null; end $$;
do $$ begin create type payment_type as enum ('DEPOSIT','FULL_PAYMENT','REMAINING_PAYMENT');
exception when duplicate_object then null; end $$;
do $$ begin create type availability_block_status as enum ('ACTIVE','INACTIVE');
exception when duplicate_object then null; end $$;
do $$ begin create type voucher_status as enum ('DRAFT','ACTIVE','EXPIRED','DISABLED');
exception when duplicate_object then null; end $$;
do $$ begin create type voucher_discount_type as enum ('PERCENTAGE','FIXED_AMOUNT');
exception when duplicate_object then null; end $$;
do $$ begin create type voucher_funded_by as enum ('PARTNER','PLATFORM','SHARED');
exception when duplicate_object then null; end $$;
do $$ begin create type user_voucher_status as enum ('CLAIMED','USED','EXPIRED');
exception when duplicate_object then null; end $$;
do $$ begin create type notification_type as enum ('BOOKING','PAYMENT','PROMOTION','SYSTEM','VOUCHER','TOURNAMENT');
exception when duplicate_object then null; end $$;
do $$ begin create type analytics_event_type as enum ('COURT_VIEWED','COURT_SEARCHED','BOOKING_CREATED','BOOKING_CANCELLED','VOUCHER_CLAIMED','VOUCHER_APPLIED','TOURNAMENT_VIEWED','TOURNAMENT_REGISTERED','DYNAMIC_PRICE_VIEWED','DYNAMIC_PRICE_CALCULATED','PREDICTION_VIEWED','DEMAND_PREDICTION_GENERATED','TOURNAMENT_CREATED');
exception when duplicate_object then null; end $$;
do $$ begin create type demand_prediction_level as enum ('LOW','MEDIUM','HIGH','VERY_HIGH');
exception when duplicate_object then null; end $$;
do $$ begin create type demand_prediction_status as enum ('GENERATED','INSUFFICIENT_DATA','FAILED');
exception when duplicate_object then null; end $$;
do $$ begin create type tournament_status as enum ('DRAFT','OPEN','FULL','ONGOING','COMPLETED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type tournament_registration_status as enum ('PENDING','APPROVED','REJECTED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type settlement_status as enum ('PENDING','PROCESSING','SETTLED','FAILED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type withdrawal_status as enum ('PENDING','APPROVED','REJECTED','PAID');
exception when duplicate_object then null; end $$;

-- ── SEQUENCES ────────────────────────────────────────────────────────────

create sequence if not exists seq_partner_wallets;
create sequence if not exists seq_settlements;
create sequence if not exists seq_withdrawal_requests;

-- ════════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ════════════════════════════════════════════════════════════════════════

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(120) not null,
  email varchar(160) not null unique,
  phone varchar(30),
  password_hash text,
  role user_role not null default 'USER',
  provider auth_provider not null default 'LOCAL',
  provider_id varchar(160),
  email_verified boolean not null default false,
  avatar_url text,
  status account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_id uuid,
  recipient_partner_id uuid
);

create table if not exists partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  business_name varchar(160) not null,
  business_slug varchar(160),
  description text,
  logo_url text,
  address text,
  city varchar(120),
  district varchar(120),
  tax_code varchar(60),
  commission_rate numeric(5, 2),
  approval_status court_approval_status not null default 'PENDING',
  approved_at timestamptz,
  approved_by uuid references users(id),
  bank_name varchar(120),
  bank_account_number varchar(60),
  bank_account_holder varchar(160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists court_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null unique,
  slug varchar(120) not null unique,
  description text,
  icon_url text,
  sort_order int not null default 0,
  status court_active_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sport_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references court_categories(id),
  name varchar(80) not null,
  slug varchar(100) not null,
  icon_url text,
  status court_active_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists courts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner_profiles(id) on delete cascade,
  category_id uuid not null references court_categories(id),
  name varchar(160) not null,
  slug varchar(200) not null unique,
  description text,
  address text,
  city varchar(120),
  district varchar(120),
  ward varchar(120),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  approval_status court_approval_status not null default 'PENDING',
  active_status court_active_status not null default 'ACTIVE',
  verified boolean not null default false,
  featured boolean not null default false,
  min_price numeric(12, 2),
  max_price numeric(12, 2),
  opening_hours jsonb default '{}'::jsonb,
  deposit_percent numeric(5, 2) default 0,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists court_surfaces (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  name varchar(80) not null,
  surface_type varchar(60),
  price_modifier numeric(5, 2) default 0,
  active_status court_active_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists court_images (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  image_url text not null,
  caption varchar(200),
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists court_amenities (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  name varchar(80) not null,
  icon varchar(60),
  created_at timestamptz not null default now()
);

create table if not exists court_prices (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  court_surface_id uuid references court_surfaces(id) on delete cascade,
  day_type day_type not null default 'WEEKDAY',
  start_time time not null,
  end_time time not null,
  price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint court_prices_time_check check (start_time < end_time)
);

create table if not exists court_base_prices (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  day_type day_type not null,
  start_time time not null,
  end_time time not null,
  base_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dynamic_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner_profiles(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  name varchar(160) not null,
  description text,
  multiplier numeric(5, 2) not null default 1.0,
  day_of_week int[],
  start_time time,
  end_time time,
  active_status court_active_status not null default 'ACTIVE',
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists court_services (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  name varchar(120) not null,
  description text,
  price numeric(12, 2) not null,
  unit varchar(30) default 'lan',
  active_status court_active_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists court_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  reason varchar(200),
  status availability_block_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code varchar(30) not null unique,
  user_id uuid not null references users(id),
  court_id uuid not null references courts(id),
  court_surface_id uuid references court_surfaces(id),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  total_price numeric(12, 2) not null,
  base_price numeric(12, 2) not null default 0,
  dynamic_adjustment_amount numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0,
  voucher_discount_amount numeric(12, 2) not null default 0,
  platform_retained_amount numeric(12, 2) not null default 0,
  demand_prediction_snapshot jsonb,
  deposit_amount numeric(12, 2) not null default 0,
  refund_amount numeric(12, 2) not null default 0,
  payment_method payment_method not null default 'CASH',
  payment_status payment_status not null default 'UNPAID',
  booking_status booking_status not null default 'PENDING',
  cancel_reason text,
  note text,
  admin_note text,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking_slots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  slot_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_slots_time_check check (start_time < end_time)
);

create table if not exists booking_services (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  service_id uuid not null references court_services(id),
  quantity int not null default 1,
  price numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  provider varchar(60) not null,
  payment_method payment_method not null,
  payment_type payment_type not null,
  amount numeric(12, 2) not null,
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
  amount numeric(12, 2) not null,
  raw_payload_json jsonb not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint uq_payment_transactions_provider_tx unique(provider, provider_transaction_id)
);

-- ── VOUCHERS ─────────────────────────────────────────────────────────────

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partner_profiles(id) on delete cascade,
  court_id uuid references courts(id) on delete cascade,
  code varchar(40) not null unique,
  title varchar(160) not null,
  description text,
  discount_type voucher_discount_type not null,
  discount_value numeric(12, 2) not null,
  max_discount_amount numeric(12, 2),
  min_booking_amount numeric(12, 2) not null default 0,
  usage_limit int,
  used_count int not null default 0,
  start_date timestamptz not null,
  end_date timestamptz not null,
  status voucher_status not null default 'DRAFT',
  funded_by voucher_funded_by not null default 'PARTNER',
  partner_funding_percent numeric(5, 2) not null default 100.00,
  platform_funding_percent numeric(5, 2) not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  voucher_id uuid not null references vouchers(id) on delete cascade,
  status user_voucher_status not null default 'CLAIMED',
  claimed_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz,
  booking_id uuid references bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking_vouchers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  voucher_id uuid not null references vouchers(id),
  user_voucher_id uuid references user_vouchers(id),
  discount_amount numeric(12, 2) not null,
  platform_share numeric(12, 2) not null default 0,
  partner_share numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- SETTLEMENT SYSTEM
-- ════════════════════════════════════════════════════════════════════════

create table if not exists partner_wallets (
  id varchar(20) primary key default ('pw' || lpad(nextval('seq_partner_wallets')::text, 4, '0')),
  partner_id uuid not null unique references partner_profiles(id) on delete cascade,
  available_balance numeric(14, 2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(14, 2) not null default 0 check (pending_balance >= 0),
  total_earned numeric(14, 2) not null default 0 check (total_earned >= 0),
  total_withdrawn numeric(14, 2) not null default 0 check (total_withdrawn >= 0),
  currency varchar(3) not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settlements (
  id varchar(20) primary key default ('st' || lpad(nextval('seq_settlements')::text, 4, '0')),
  booking_id uuid not null unique references bookings(id),
  partner_id uuid not null references partner_profiles(id),
  payment_id uuid references payments(id),
  gross_amount numeric(14, 2) not null default 0 check (gross_amount >= 0),
  voucher_discount numeric(14, 2) not null default 0 check (voucher_discount >= 0),
  platform_discount numeric(14, 2) not null default 0 check (platform_discount >= 0),
  partner_discount numeric(14, 2) not null default 0 check (partner_discount >= 0),
  commission_amount numeric(14, 2) not null default 0 check (commission_amount >= 0),
  service_fee numeric(14, 2) not null default 0 check (service_fee >= 0),
  net_amount numeric(14, 2) not null default 0 check (net_amount >= 0),
  status settlement_status not null default 'PENDING',
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists withdrawal_requests (
  id varchar(20) primary key default ('wr' || lpad(nextval('seq_withdrawal_requests')::text, 4, '0')),
  partner_id uuid not null references partner_profiles(id),
  amount numeric(14, 2) not null check (amount > 0),
  bank_name varchar(120) not null,
  bank_account_number varchar(60) not null,
  bank_account_name varchar(160) not null,
  status withdrawal_status not null default 'PENDING',
  processed_by uuid references users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════

create index if not exists idx_vouchers_funded_by on vouchers(funded_by);
create index if not exists idx_vouchers_status on vouchers(status);
create index if not exists idx_partner_wallets_partner_id on partner_wallets(partner_id);
create index if not exists idx_settlements_partner_id on settlements(partner_id);
create index if not exists idx_settlements_status on settlements(status);
create index if not exists idx_settlements_created_at on settlements(created_at desc);
create index if not exists idx_withdrawal_requests_partner_id on withdrawal_requests(partner_id);
create index if not exists idx_withdrawal_requests_status on withdrawal_requests(status);

-- ════════════════════════════════════════════════════════════════════════
-- AUTO-CREATE WALLET WHEN PARTNER CREATED
-- ════════════════════════════════════════════════════════════════════════

create or replace function create_partner_wallet()
returns trigger language plpgsql security definer as $$
begin
  if NEW.id is not null then
    insert into partner_wallets (partner_id)
    values (NEW.id)
    on conflict (partner_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_create_partner_wallet on partner_profiles;
create trigger trg_create_partner_wallet
  after insert on partner_profiles
  for each row execute function create_partner_wallet();

-- ════════════════════════════════════════════════════════════════════════
-- SEED PLATFORM VOUCHERS
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  now_ts timestamptz := now();
begin
  insert into vouchers (id, partner_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent)
  values
    (gen_random_uuid(), null, 'WELCOME50', 'Chao mung thanh vien moi',
     'Ma giam gia 50.000 VND cho don hang tu 300.000 VND.',
     'FIXED_AMOUNT', 50000, null, 300000, 1000, 0,
     now_ts, now_ts + interval '30 days', 'ACTIVE',
     'PLATFORM', 0, 100)
  on conflict (code) do nothing;

  insert into vouchers (id, partner_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent)
  values
    (gen_random_uuid(), null, 'SPORT10', 'Giam 10% cho don hang',
     'Ma giam gia 10% (toi da 100.000 VND) cho don hang tu 500.000 VND.',
     'PERCENTAGE', 10, 100000, 500000, 500, 0,
     now_ts, now_ts + interval '90 days', 'ACTIVE',
     'PLATFORM', 0, 100)
  on conflict (code) do nothing;

  insert into vouchers (id, partner_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent)
  values
    (gen_random_uuid(), null, 'WEEKEND15', 'Giam 15% cuoi tuan',
     'Ma giam gia 15% (toi da 150.000 VND) chi ap dung cuoi tuan.',
     'PERCENTAGE', 15, 150000, 0, 300, 0,
     now_ts, now_ts + interval '180 days', 'ACTIVE',
     'PLATFORM', 0, 100)
  on conflict (code) do nothing;

  insert into vouchers (id, partner_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent)
  values
    (gen_random_uuid(), null, 'NIGHT30', 'Giam 30.000 VND ca dem',
     'Ma giam gia 30.000 VND cho tat ca cac don hang.',
     'FIXED_AMOUNT', 30000, null, 0, 200, 0,
     now_ts, now_ts + interval '365 days', 'ACTIVE',
     'PLATFORM', 0, 100)
  on conflict (code) do nothing;

  insert into vouchers (id, partner_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent)
  values
    (gen_random_uuid(), null, 'SUMMER20', 'Khuyen mai he 2026',
     'Ma giam gia 20% (toi da 200.000 VND) cho don hang tu 800.000 VND.',
     'PERCENTAGE', 20, 200000, 800000, 1000, 0,
     now_ts, now_ts + interval '365 days', 'ACTIVE',
     'PLATFORM', 0, 100)
  on conflict (code) do nothing;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- SEED WALLETS cho existing partners
-- ════════════════════════════════════════════════════════════════════════

insert into partner_wallets (partner_id, available_balance, pending_balance, total_earned, total_withdrawn, currency)
select id, 0, 0, 0, 0, 'VND'
from partner_profiles
on conflict (partner_id) do nothing;