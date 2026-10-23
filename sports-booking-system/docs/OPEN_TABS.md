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
- Early check-in and extensions follow the court's partner-set policy (courts.early_check_in_* and
  extension_price_percent, database/20_court_time_charge_policy.sql): the minutes right before the
  booked start up to the free allowance cost nothing, arriving earlier than the maximum is refused,
  and the rest is charged at the partner's % of the hour-by-hour court price. The counter shows the
  same figures beforehand (GET /recipient/bookings/:id/time-charge-quote) and each charge is noted on
  the booking. The partner edits the policy on the court's price page; it does not trigger re-approval.
- Each booking can have PLATFORM and PARTNER settlement rows. A composite unique key
  replaces booking-only uniqueness so mixed online/counter receipts retain their source.
- PARTNER settlement rows record court money the partner collected itself (cash, the partner's own
  QR, bank transfer). They are written whenever a booking becomes COMPLETED, by any path
  (settlementService.chargePartnerCollected), on court time only after the voucher, minus what the
  PLATFORM row already covers; services sold at the counter carry no commission. The partner keeps
  that money, so its commission is taken from the wallet's available balance and any shortfall
  becomes partner_wallets.commission_debt (database/23_partner_commission_debt.sql). Later online
  earnings pay the debt first; withdrawals are refused while debt remains; an admin records transfers
  to the platform account (POST /admin/wallets/partner-wallets/:partnerId/debt-payments).
  Re-completing an invoice charges only the increase; an admin-cancelled PARTNER row waives (refunds)
  its commission. Any pending online settlement is settled separately when checkout completes.
- A walk-in QR created at booking time is paid into the platform's PayOS account, so only the
  provider confirms it (webhook, the 25s poller, or the counter's "Kiểm tra lại" button via
  POST /recipient/payments/:id/sync). That path records the PLATFORM settlement and credits the
  partner wallet. POST /recipient/payments/:id/confirm is a dev/QA shortcut through the same path
  and returns 403 in production; it never sets PAID directly.
- When the court (partner or staff) cancels a booking that was paid online, the money is still in the
  platform's account: the booking stays CANCELLED/PAID and a REFUND_REQUIRED admin notification is
  queued in the same transaction (admin_notification_outbox). The admin refunds the customer and then
  sets REFUNDED with the refund amount, as for late payments. Counter-paid bookings are refunded by
  the court on the spot and become REFUNDED immediately.
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
