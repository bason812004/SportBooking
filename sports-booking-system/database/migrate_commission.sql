begin;

alter type payment_status add value if not exists 'PARTIALLY_REFUNDED';

create table if not exists system_settings (
  key varchar(100) primary key,
  numeric_value numeric(12, 4),
  description text,
  updated_at timestamptz not null default now()
);

insert into system_settings (key, numeric_value, description) values
('DEFAULT_COMMISSION_RATE', 10, 'Default platform commission percentage'),
('BOOKING_DEPOSIT_RATE', 50, 'Default booking deposit percentage')
on conflict (key) do nothing;

alter table partner_profiles
  add column if not exists commission_rate numeric(5, 2);

alter table partner_profiles
  drop constraint if exists partner_profiles_commission_rate_check;
alter table partner_profiles
  add constraint partner_profiles_commission_rate_check
  check (commission_rate is null or commission_rate between 0 and 100);

alter table bookings
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists refund_amount numeric(12, 2) not null default 0,
  add column if not exists platform_retained_amount numeric(12, 2) not null default 0,
  add column if not exists cancelled_at timestamptz;

update bookings
set deposit_amount = round(total_price * 0.5, 2)
where deposit_amount = 0;

alter table bookings
  drop constraint if exists bookings_deposit_amount_check,
  drop constraint if exists bookings_refund_amount_check,
  drop constraint if exists bookings_platform_retained_amount_check;
alter table bookings
  add constraint bookings_deposit_amount_check check (deposit_amount >= 0 and deposit_amount <= total_price),
  add constraint bookings_refund_amount_check check (refund_amount >= 0 and refund_amount <= total_price),
  add constraint bookings_platform_retained_amount_check check (platform_retained_amount >= 0 and platform_retained_amount <= total_price);

alter table bookings
  add column if not exists base_price numeric(12, 2) not null default 0,
  add column if not exists dynamic_adjustment_amount numeric(12, 2) not null default 0,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists voucher_discount_amount numeric(12, 2) not null default 0,
  add column if not exists demand_prediction_snapshot jsonb;

create table if not exists commission_transactions (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id),
  partner_id uuid not null references partner_profiles(id),
  transaction_type varchar(20) not null default 'EARNING' check (transaction_type in ('EARNING', 'REVERSAL')),
  event_type varchar(20) not null check (event_type in ('COMPLETED', 'NO_SHOW', 'REFUND')),
  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  commission_rate numeric(5, 2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(12, 2) not null,
  net_amount numeric(12, 2) not null,
  original_transaction_id uuid references commission_transactions(id),
  created_at timestamptz not null default now(),
  constraint commission_transaction_sign_check check (
    (transaction_type = 'EARNING' and commission_amount >= 0 and net_amount >= 0)
    or
    (transaction_type = 'REVERSAL' and commission_amount <= 0 and net_amount <= 0)
  )
);

create index if not exists idx_commission_transactions_booking_id
  on commission_transactions(booking_id);
create index if not exists idx_commission_transactions_partner_created_at
  on commission_transactions(partner_id, created_at);
create unique index if not exists uq_commission_earning_per_booking
  on commission_transactions(booking_id)
  where transaction_type = 'EARNING';

insert into commission_transactions (
  booking_id,
  partner_id,
  transaction_type,
  event_type,
  gross_amount,
  commission_rate,
  commission_amount,
  net_amount,
  created_at
)
select
  b.id,
  c.partner_id,
  'EARNING',
  b.booking_status::text,
  case when b.booking_status = 'NO_SHOW' then b.deposit_amount else b.total_price end,
  coalesce(
    pp.commission_rate,
    (select numeric_value from system_settings where key = 'DEFAULT_COMMISSION_RATE'),
    10
  ),
  round(
    (case when b.booking_status = 'NO_SHOW' then b.deposit_amount else b.total_price end)
    * coalesce(
        pp.commission_rate,
        (select numeric_value from system_settings where key = 'DEFAULT_COMMISSION_RATE'),
        10
      ) / 100,
    2
  ),
  round(
    (case when b.booking_status = 'NO_SHOW' then b.deposit_amount else b.total_price end)
    * (
        1 - coalesce(
          pp.commission_rate,
          (select numeric_value from system_settings where key = 'DEFAULT_COMMISSION_RATE'),
          10
        ) / 100
      ),
    2
  ),
  (b.booking_date + b.end_time) at time zone 'Asia/Ho_Chi_Minh'
from bookings b
join courts c on c.id = b.court_id
join partner_profiles pp on pp.id = c.partner_id
where b.booking_status in ('COMPLETED', 'NO_SHOW')
  and not exists (
    select 1
    from commission_transactions ct
    where ct.booking_id = b.id
      and ct.transaction_type = 'EARNING'
  );

create or replace function prevent_commission_transaction_mutation()
returns trigger as $$
begin
  raise exception 'commission_transactions is immutable; insert a REVERSAL record instead';
end;
$$ language plpgsql;

drop trigger if exists trg_commission_transactions_immutable on commission_transactions;
create trigger trg_commission_transactions_immutable
before update or delete on commission_transactions
for each row execute function prevent_commission_transaction_mutation();

drop trigger if exists trg_system_settings_updated_at on system_settings;
create trigger trg_system_settings_updated_at
before update on system_settings
for each row execute function set_updated_at();

commit;
