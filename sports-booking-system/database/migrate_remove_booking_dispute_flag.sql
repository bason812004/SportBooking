begin;

drop index if exists idx_bookings_dispute_status;
drop index if exists idx_bookings_flag_status;

alter table bookings
  drop constraint if exists bookings_dispute_status_check,
  drop constraint if exists bookings_flag_status_check;

alter table bookings
  drop column if exists dispute_status,
  drop column if exists flag_status;

commit;
