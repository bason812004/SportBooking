# Combined Database Scripts

Use these files instead of running many scattered SQL scripts by hand.

## Fresh database

Run in this order:

1. `00_schema_tables.sql`
2. `02_seed_data.sql` if you want demo data

`00_schema_tables.sql` already contains the current table structure, enums, triggers, and indexes.

## Existing database

Run in this order:

1. `01_existing_db_migrations.sql`
2. `03_diagnose_court_search.sql` to inspect visibility problems
3. Your own insert/update script, based on `04_insert_court_template.sql`
4. `05_seed_test_bookings_old_status.sql` if you need sample booking schedules for availability testing
5. `06_user_voucher_wallet.sql` if your current DB is missing or has an old `user_vouchers` table
6. `07_blog_moderation_comments_search.sql` if your current DB is missing blog comment toggles/search indexes
7. `08_team_post_group_chat.sql` if your current DB is missing team chat member/message tables
8. `09_court_deposit_percent.sql` if your current DB is missing court-level deposit percent settings

`01_existing_db_migrations.sql` already includes the user voucher wallet fix. The standalone `06_user_voucher_wallet.sql` is useful when you only want to patch voucher claiming on an existing database.

## Test bookings

`05_seed_test_bookings_old_status.sql` only uses the older enum values:

- booking status: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- payment status: `UNPAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`

It seeds bookings on `2026-06-24`. Use:

```txt
GET /api/courts/:courtId/availability?date=2026-06-24
```

Expected behavior:

- `PENDING`, `CONFIRMED`, `COMPLETED` block slots.
- `CANCELLED`, `NO_SHOW` do not block slots.

## Why a court may not appear in search

The backend public court API filters these conditions:

- `courts.approval_status = 'APPROVED'`
- `courts.active_status = 'ACTIVE'`
- linked `court_categories.status = 'ACTIVE'`
- keyword/city/district/sport/price/location filters must match

Booking quote also needs price rows in `court_prices`. Without prices, the court can appear in search, but users may not be able to create a valid quote for selected slots.
