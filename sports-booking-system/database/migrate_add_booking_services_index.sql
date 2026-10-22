-- Migration: Index on booking_services.booking_id for cashier lookups (add/update/remove
-- service, release services on cancel/no-show). Safe on populated databases (idempotent).

create index if not exists idx_booking_services_booking_id
  on booking_services(booking_id);
