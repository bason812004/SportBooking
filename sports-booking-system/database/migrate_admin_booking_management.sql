begin;

alter table bookings
  add column if not exists dispute_status varchar(30) not null default 'NONE',
  add column if not exists admin_note text,
  add column if not exists flag_status varchar(30) not null default 'NORMAL';

alter table bookings
  drop constraint if exists bookings_dispute_status_check,
  drop constraint if exists bookings_flag_status_check;

alter table bookings
  add constraint bookings_dispute_status_check
  check (dispute_status in ('NONE', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
  add constraint bookings_flag_status_check
  check (flag_status in ('NORMAL', 'FLAGGED', 'CLEARED'));

create sequence if not exists seq_booking_admin_actions;

create table if not exists booking_admin_actions (
  id varchar(20) primary key default ('baa' || lpad(nextval('seq_booking_admin_actions')::text, 4, '0')),
  booking_id varchar(20) not null references bookings(id) on delete cascade,
  actor_id varchar(20) not null references users(id),
  action varchar(80) not null,
  note text,
  previous_status jsonb,
  new_status jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_dispute_status on bookings(dispute_status);
create index if not exists idx_bookings_flag_status on bookings(flag_status);
create index if not exists idx_booking_admin_actions_booking_id
  on booking_admin_actions(booking_id, created_at desc);
create index if not exists idx_booking_admin_actions_actor_id
  on booking_admin_actions(actor_id, created_at desc);

commit;
