-- Booking pattern reminders: records each time the recurring-behavior reminder
-- job (backend/src/modules/booking-reminders) has notified a user about their
-- usual weekly slot, so a slot pattern is never reminded twice in the same week
-- even if the job runs more than once per day.
-- Safe for existing databases; run after users, courts, vouchers, notifications exist.

create sequence if not exists seq_booking_reminders;

create table if not exists booking_reminders (
  id varchar(20) primary key default ('brm' || lpad(nextval('seq_booking_reminders')::text, 4, '0')),
  user_id varchar(20) not null references users(id) on delete cascade,
  court_id varchar(20) not null references courts(id) on delete cascade,
  day_of_week int not null,
  week_start date not null,
  voucher_id varchar(20) references vouchers(id) on delete set null,
  notification_id varchar(20),
  created_at timestamptz not null default now(),
  constraint uq_booking_reminders_user_court_day_week unique (user_id, court_id, day_of_week, week_start)
);

create index if not exists idx_booking_reminders_user_id
  on booking_reminders(user_id);
