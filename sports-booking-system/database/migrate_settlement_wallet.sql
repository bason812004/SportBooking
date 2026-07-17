begin;

-- ============================================================
-- Settlement Wallet: partner_wallets, settlements, withdrawal_requests
-- ============================================================

create sequence if not exists seq_partner_wallets;
create sequence if not exists seq_settlements;c
create sequence if not exists seq_withdrawal_requests;

-- ------------------------------------------------------------
-- partner_wallets: vi escrow cho moi partner
-- ------------------------------------------------------------
create table if not exists partner_wallets (
  id varchar(20) primary key default ('pw' || lpad(nextval('seq_partner_wallets')::text, 4, '0')),
  partner_id varchar(20) not null unique references partner_profiles(id) on delete cascade,
  available_balance numeric(12, 2) not null default 0 check (available_balance >= 0),
  pending_balance numeric(12, 2) not null default 0 check (pending_balance >= 0),
  total_earned numeric(12, 2) not null default 0 check (total_earned >= 0),
  total_withdrawn numeric(12, 2) not null default 0 check (total_withdrawn >= 0),
  currency varchar(3) not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_wallets_partner_id on partner_wallets(partner_id);

-- ------------------------------------------------------------
-- settlements: quyet toan cho moi booking da thanh toan online
-- ------------------------------------------------------------
create table if not exists settlements (
  id varchar(20) primary key default ('st' || lpad(nextval('seq_settlements')::text, 4, '0')),
  booking_id varchar(20) not null unique references bookings(id),
  partner_id varchar(20) not null references partner_profiles(id),
  payment_id uuid references payments(id) on delete set null,
  gross_amount numeric(12, 2) not null default 0 check (gross_amount >= 0),
  voucher_discount numeric(12, 2) not null default 0 check (voucher_discount >= 0),
  platform_discount numeric(12, 2) not null default 0 check (platform_discount >= 0),
  partner_discount numeric(12, 2) not null default 0 check (partner_discount >= 0),
  commission_rate numeric(5, 2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(12, 2) not null default 0 check (commission_amount >= 0),
  service_fee numeric(12, 2) not null default 0 check (service_fee >= 0),
  net_amount numeric(12, 2) not null default 0 check (net_amount >= 0),
  status varchar(20) not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED', 'CANCELLED')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_settlements_partner_created_at on settlements(partner_id, created_at);
create index if not exists idx_settlements_status on settlements(status);

-- ------------------------------------------------------------
-- withdrawal_requests: yeu cau rut tien cua partner
-- ------------------------------------------------------------
create table if not exists withdrawal_requests (
  id varchar(20) primary key default ('wd' || lpad(nextval('seq_withdrawal_requests')::text, 4, '0')),
  partner_id varchar(20) not null references partner_profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  bank_name varchar(120),
  bank_account_number varchar(60),
  bank_account_name varchar(160),
  status varchar(20) not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  processed_by varchar(20) references users(id) on delete set null,
  processed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_requests_partner_created_at on withdrawal_requests(partner_id, created_at);
create index if not exists idx_withdrawal_requests_status on withdrawal_requests(status);

-- ------------------------------------------------------------
-- Reconcile voi ban bang cu (neu da ton tai tu lan chay truoc):
-- them cot thieu va chuyen status tu pg enum sang varchar + check
-- ------------------------------------------------------------
alter table settlements
  add column if not exists commission_rate numeric(5, 2) not null default 10;
alter table settlements
  drop constraint if exists settlements_commission_rate_check;
alter table settlements
  add constraint settlements_commission_rate_check check (commission_rate between 0 and 100);

alter table withdrawal_requests
  add column if not exists processed_at timestamptz;

alter table settlements alter column status drop default;
alter table settlements alter column status type varchar(20) using status::text;
alter table settlements alter column status set default 'PENDING';
alter table settlements drop constraint if exists settlements_status_check;
alter table settlements
  add constraint settlements_status_check
  check (status in ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED', 'CANCELLED'));

alter table withdrawal_requests alter column status drop default;
alter table withdrawal_requests alter column status type varchar(20) using status::text;
alter table withdrawal_requests alter column status set default 'PENDING';
alter table withdrawal_requests drop constraint if exists withdrawal_requests_status_check;
alter table withdrawal_requests
  add constraint withdrawal_requests_status_check
  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PAID'));

drop type if exists settlement_status;
drop type if exists withdrawal_status;

-- ------------------------------------------------------------
-- updated_at triggers (set_updated_at() da co tu 00_schema_tables.sql)
-- ------------------------------------------------------------
drop trigger if exists trg_partner_wallets_updated_at on partner_wallets;
create trigger trg_partner_wallets_updated_at
before update on partner_wallets
for each row execute function set_updated_at();

drop trigger if exists trg_settlements_updated_at on settlements;
create trigger trg_settlements_updated_at
before update on settlements
for each row execute function set_updated_at();

drop trigger if exists trg_withdrawal_requests_updated_at on withdrawal_requests;
create trigger trg_withdrawal_requests_updated_at
before update on withdrawal_requests
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Backfill: tao vi balance=0 cho moi partner hien co
-- ------------------------------------------------------------
insert into partner_wallets (partner_id)
select pp.id
from partner_profiles pp
where not exists (
  select 1 from partner_wallets w where w.partner_id = pp.id
);

-- ------------------------------------------------------------
-- Trigger: tu dong tao vi khi partner moi duoc insert
-- ------------------------------------------------------------
create or replace function create_partner_wallet()
returns trigger as $$
begin
  insert into partner_wallets (partner_id)
  values (new.id)
  on conflict (partner_id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_partner_profiles_create_wallet on partner_profiles;
create trigger trg_partner_profiles_create_wallet
after insert on partner_profiles
for each row execute function create_partner_wallet();

commit;
