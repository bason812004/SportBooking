-- Add/fix the user voucher wallet table for existing databases.
-- This table stores which vouchers each user has claimed, used, or expired.

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
