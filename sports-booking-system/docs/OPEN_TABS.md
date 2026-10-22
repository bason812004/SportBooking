# Open tabs

Services are added to the booking invoice and collected at the end of play.
Deposits and FULL_PAYMENT cover only the court charge after voucher discount.
A walk-in PAY_AT_COURT booking is CONFIRMED/UNPAID, has depositAmount = 0,
and does not create a payment or QR. This applies to single, grouped and recurring visits.

POS includes today's confirmed and completed bookings. Selling a service automatically
checks in a booking within start - 30 minutes through end + 60 minutes, using Vietnam
time regardless of server timezone. Cancelled/unpaid-pending bookings cannot receive
services. A completed invoice with new debt becomes PENDING and its booking becomes
CHECKOUT_PENDING. Prior checkout payments remain deducted from the balance.

## Accounting details

- booking.totalPrice historically includes services and discounts. Checkout uses
  basePrice + dynamicAdjustmentAmount for court charges and applies services/discount once.
- Legacy service rows are accepted with NULL status and NULL/zero price totals.
- Services chosen for several dates attach once, to the first booking.
- Online payments allocate actual received amounts to booking.depositAmount and platform
  settlements. Extending playing time does not credit the wallet before money is collected.
- Each booking can have PLATFORM and PARTNER settlement rows. A composite unique key
  replaces booking-only uniqueness so mixed online/counter receipts retain their source.
- Counter settlement records are SETTLED immediately and never credit/debit the wallet.
  Re-completing an invoice adds only the new amount and updates commission earnings.
  Any pending online settlement is settled separately when checkout completes.
- Only the assigned receptionist, owning partner, or admin can confirm collection.
  Customers can view their own invoice and receive updates, but cannot mark it paid.

## Database rollout

Apply database/migrate_open_tabs.sql after the existing service/POS and settlement-wallet
migrations, then run npx prisma generate in backend. The migration repairs old service
line totals and adds collection-source uniqueness without deleting business data.
It must run before starting the updated backend against an existing database.

Historical platform settlements/wallets previously credited against full invoices are
preserved; they require separate reconciliation against payment records. The migration
does not guess or silently adjust those balances.

## Verification

Backend build and frontend production build pass. Backend tests cover deposits,
legacy service totals, partial/repeated collections, reopening, POS check-in windows,
all three walk-in creation paths, ownership, and counter settlements without wallet calls.
Prisma client generation passes. Mobile type-check has pre-existing errors in unrelated
court, teammate, partner and chat screens; no errors are reported in the modified files.

The migration was applied to the configured remote database on 2026-09-19 at the
user's request. Read-only checks confirmed the non-null collected_by column, the
unique (booking_id, collected_by) index, and no remaining service rows matching the
legacy backfill condition. Prisma Client was regenerated successfully.
Browser E2E has not been run; use the six E2E scenarios in the source plan on a test database.
