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
