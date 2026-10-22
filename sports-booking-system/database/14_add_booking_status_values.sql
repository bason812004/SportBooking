-- Fix: schema.prisma's BookingStatus enum has DEPOSIT_PAID/IN_PROGRESS/CHECKOUT_PENDING
-- (added by the cashier/checkout merge) but the real Postgres enum `booking_status`
-- on Supabase never got these values migrated in, causing:
--   invalid input value for enum booking_status: "DEPOSIT_PAID"
-- whenever cashier.repository.ts / checkout.repository.ts query or write these statuses.
-- Purely additive, no data touched.

begin;

alter type booking_status add value if not exists 'DEPOSIT_PAID';
alter type booking_status add value if not exists 'IN_PROGRESS';
alter type booking_status add value if not exists 'CHECKOUT_PENDING';

commit;
