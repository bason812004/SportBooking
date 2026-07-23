-- ============================================================
-- Settlement System + Platform Voucher Migration
-- Chạy: Supabase Dashboard > SQL Editor > New query > paste
-- Idempotent: dùng IF NOT EXISTS, ON CONFLICT DO NOTHING
-- ============================================================

-- ── ENUM types ──────────────────────────────────────────────────────────────

do $$
begin
  create type settlement_status as enum ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type withdrawal_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type voucher_funded_by as enum ('PARTNER', 'PLATFORM', 'SHARED');
exception
  when duplicate_object then null;
end $$;

-- ── SEQUENCES cho short-ID ────────────────────────────────────────────────

create sequence if not exists seq_partner_wallets;
create sequence if not exists seq_settlements;
create sequence if not exists seq_withdrawal_requests;

-- ── PARTNER WALLETS ────────────────────────────────────────────────────────

create table if not exists partner_wallets (
  id varchar(20) primary key default ('pw' || lpad(nextval('seq_partner_wallets')::text, 4, '0')),
  partner_id varchar(20) not null unique references partner_profiles(id) on delete cascade,
  available_balance numeric(14, 2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(14, 2) not null default 0 check (pending_balance >= 0),
  total_earned numeric(14, 2) not null default 0 check (total_earned >= 0),
  total_withdrawn numeric(14, 2) not null default 0 check (total_withdrawn >= 0),
  currency varchar(3) not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_wallets_partner_id on partner_wallets(partner_id);

-- ── SETTLEMENTS ───────────────────────────────────────────────────────────

create table if not exists settlements (
  id varchar(20) primary key default ('st' || lpad(nextval('seq_settlements')::text, 4, '0')),
  booking_id varchar(20) not null unique references bookings(id),
  partner_id varchar(20) not null references partner_profiles(id),
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
  updated_at timestamptz not null default now(),
  constraint settlements_net_check check (net_amount >= 0)
);

create index if not exists idx_settlements_partner_id on settlements(partner_id);
create index if not exists idx_settlements_status on settlements(status);
create index if not exists idx_settlements_created_at on settlements(created_at desc);
create index if not exists idx_settlements_booking_id on settlements(booking_id);

-- ── WITHDRAWAL REQUESTS ───────────────────────────────────────────────────

create table if not exists withdrawal_requests (
  id varchar(20) primary key default ('wr' || lpad(nextval('seq_withdrawal_requests')::text, 4, '0')),
  partner_id varchar(20) not null references partner_profiles(id),
  amount numeric(14, 2) not null check (amount > 0),
  bank_name varchar(120) not null,
  bank_account_number varchar(60) not null,
  bank_account_name varchar(160) not null,
  status withdrawal_status not null default 'PENDING',
  processed_by varchar(20) references users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint withdrawal_amount_positive check (amount > 0)
);

create index if not exists idx_withdrawal_requests_partner_id on withdrawal_requests(partner_id);
create index if not exists idx_withdrawal_requests_status on withdrawal_requests(status);

-- ── VOUCHERS: add funded_by columns ────────────────────────────────────────

alter table vouchers
  add column if not exists funded_by voucher_funded_by not null default 'PARTNER',
  add column if not exists partner_funding_percent numeric(5, 2) not null default 100.00
    check (partner_funding_percent >= 0 and partner_funding_percent <= 100),
  add column if not exists platform_funding_percent numeric(5, 2) not null default 0.00
    check (platform_funding_percent >= 0 and platform_funding_percent <= 100);

-- Make partner_id nullable for Platform vouchers
alter table vouchers
  alter column partner_id drop not null;

-- Allow existing Platform vouchers (null partner_id) to exist
-- All existing vouchers with non-null partner_id keep PARTNER funding

create index if not exists idx_vouchers_funded_by on vouchers(funded_by);

-- ── BOOKING_VOUCHERS: add platform/partner share columns ─────────────────

alter table booking_vouchers
  add column if not exists platform_share numeric(12, 2) not null default 0,
  add column if not exists partner_share numeric(12, 2) not null default 0;

-- ── SEED WALLETS cho existing partners ────────────────────────────────────

insert into partner_wallets (partner_id, available_balance, pending_balance, total_earned, total_withdrawn, currency)
select id, 0, 0, 0, 0, 'VND'
from partner_profiles
on conflict (partner_id) do nothing;

-- ── FUNCTION: auto-create wallet khi partner moi duoc tao ─────────────────

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

-- ── SEED 5 PLATFORM VOUCHERS ─────────────────────────────────────────────

do $$
declare
  now_ts timestamptz := now();
  expires_30d timestamptz := now() + interval '30 days';
  expires_90d timestamptz := now() + interval '90 days';
  expires_180d timestamptz := now() + interval '180 days';
  expires_1y timestamptz := now() + interval '1 year';
  -- vouchers.id is varchar(20); use existing seq_vouchers convention ('v' + 4-digit)
  v1_id varchar(20) := 'v' || lpad(nextval('seq_vouchers')::text, 4, '0');
  v2_id varchar(20) := 'v' || lpad(nextval('seq_vouchers')::text, 4, '0');
  v3_id varchar(20) := 'v' || lpad(nextval('seq_vouchers')::text, 4, '0');
  v4_id varchar(20) := 'v' || lpad(nextval('seq_vouchers')::text, 4, '0');
  v5_id varchar(20) := 'v' || lpad(nextval('seq_vouchers')::text, 4, '0');
begin
  -- Voucher 1: WELCOME50 - FIXED_AMOUNT 50k
  insert into vouchers (id, partner_id, court_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent,
    created_at, updated_at)
  values
    (v1_id, null, null,
     'WELCOME50', 'Chao mung thanh vien moi',
     'Ma giam gia 50.000 VND cho don hang tu 300.000 VND. Dung 1 lan.',
     'FIXED_AMOUNT', 50000, null, 300000,
     1000, 0, now_ts, expires_30d, 'ACTIVE',
     'PLATFORM', 0, 100,
     now_ts, now_ts)
  on conflict (code) do nothing;

  -- Voucher 2: SPORT10 - PERCENTAGE 10%, max 100k
  insert into vouchers (id, partner_id, court_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent,
    created_at, updated_at)
  values
    (v2_id, null, null,
     'SPORT10', 'Giam 10% cho don hang',
     'Ma giam gia 10% (toi da 100.000 VND) cho don hang tu 500.000 VND.',
     'PERCENTAGE', 10, 100000, 500000,
     500, 0, now_ts, expires_90d, 'ACTIVE',
     'PLATFORM', 0, 100,
     now_ts, now_ts)
  on conflict (code) do nothing;

  -- Voucher 3: WEEKEND15 - PERCENTAGE 15%, max 150k (for weekend only - filter handled in app)
  insert into vouchers (id, partner_id, court_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent,
    created_at, updated_at)
  values
    (v3_id, null, null,
     'WEEKEND15', 'Giam 15% cuoi tuan',
     'Ma giam gia 15% (toi da 150.000 VND) chi ap dung cuoi tuan.',
     'PERCENTAGE', 15, 150000, 0,
     300, 0, now_ts, expires_180d, 'ACTIVE',
     'PLATFORM', 0, 100,
     now_ts, now_ts)
  on conflict (code) do nothing;

  -- Voucher 4: NIGHT30 - FIXED_AMOUNT 30k (after 18:00)
  insert into vouchers (id, partner_id, court_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent,
    created_at, updated_at)
  values
    (v4_id, null, null,
     'NIGHT30', 'Giam 30.000 VND ca sang toi',
     'Ma giam gia 30.000 VND cho tat ca cac don hang.',
     'FIXED_AMOUNT', 30000, null, 0,
     200, 0, now_ts, expires_1y, 'ACTIVE',
     'PLATFORM', 0, 100,
     now_ts, now_ts)
  on conflict (code) do nothing;

  -- Voucher 5: SUMMER20 - PERCENTAGE 20%, max 200k
  insert into vouchers (id, partner_id, court_id, code, title, description,
    discount_type, discount_value, max_discount_amount, min_booking_amount,
    usage_limit, used_count, start_date, end_date, status,
    funded_by, partner_funding_percent, platform_funding_percent,
    created_at, updated_at)
  values
    (v5_id, null, null,
     'SUMMER20', 'Khuyen mai he 2026 - Giam 20%',
     'Ma giam gia 20% (toi da 200.000 VND) cho don hang tu 800.000 VND. Han su dung 1 nam.',
     'PERCENTAGE', 20, 200000, 800000,
     1000, 0, now_ts, expires_1y, 'ACTIVE',
     'PLATFORM', 0, 100,
     now_ts, now_ts)
  on conflict (code) do nothing;

  raise notice 'Seed: 5 platform vouchers created or already exist';
end $$;

-- ── VERIFICATION ───────────────────────────────────────────────────────────

do $$
begin
  raise notice '=== Migration Summary ===';
  raise notice 'Tables: partner_wallets, settlements, withdrawal_requests';
  raise notice 'Voucher columns: funded_by, partner_funding_percent, platform_funding_percent';
  perform 'Checking partner_wallets count...';
  perform count(*) from partner_wallets;
  perform 'Checking settlements count...';
  perform count(*) from settlements;
  perform 'Checking withdrawal_requests count...';
  perform count(*) from withdrawal_requests;
  perform 'Checking platform vouchers...';
  perform count(*) from vouchers where funded_by = 'PLATFORM';
  perform 'Checking vouchers columns...';
  perform column_name from information_schema.columns
    where table_name = 'vouchers' and column_name in ('funded_by', 'partner_funding_percent', 'platform_funding_percent');
end $$;
