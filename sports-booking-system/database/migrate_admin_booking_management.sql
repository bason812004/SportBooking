begin;

alter table bookings
  add column if not exists admin_note text;

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

create index if not exists idx_booking_admin_actions_booking_id
  on booking_admin_actions(booking_id, created_at desc);
create index if not exists idx_booking_admin_actions_actor_id
  on booking_admin_actions(actor_id, created_at desc);

commit;
