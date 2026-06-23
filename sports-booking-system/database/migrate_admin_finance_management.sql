begin;

create sequence if not exists seq_partner_payouts;

create table if not exists partner_payouts (
  id varchar(20) primary key default ('po' || lpad(nextval('seq_partner_payouts')::text, 4, '0')),
  partner_id varchar(20) not null references partner_profiles(id) on delete cascade,
  payout_month char(7) not null check (payout_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status varchar(20) not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED')),
  gross_amount numeric(12, 2) not null default 0,
  commission_amount numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) not null default 0,
  transaction_count integer not null default 0,
  note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_payouts_amount_check check (
    gross_amount >= 0
    and commission_amount >= 0
    and net_amount >= 0
    and transaction_count >= 0
  ),
  constraint partner_payouts_partner_month_unique unique (partner_id, payout_month)
);

create index if not exists idx_partner_payouts_month_status
  on partner_payouts(payout_month, status);
create index if not exists idx_partner_payouts_partner_month
  on partner_payouts(partner_id, payout_month);

drop trigger if exists trg_partner_payouts_updated_at on partner_payouts;
create trigger trg_partner_payouts_updated_at
before update on partner_payouts
for each row execute function set_updated_at();

commit;
