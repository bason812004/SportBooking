begin;

alter table courts
  add column if not exists featured boolean not null default false,
  add column if not exists admin_note text,
  add column if not exists update_request_note text,
  add column if not exists update_requested_at timestamptz;

alter table notifications
  add column if not exists metadata_json jsonb;

create index if not exists idx_courts_featured on courts(featured);
create index if not exists idx_courts_verified on courts(verified);
create index if not exists idx_courts_update_requested_at on courts(update_requested_at desc);

commit;
