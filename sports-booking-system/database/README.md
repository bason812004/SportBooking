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
9. `10_recipient_role_seed.sql` if your current DB is missing the Recipient role/columns or you want the demo Recipient account

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

## Open tabs

After the service/POS and settlement-wallet migrations, apply `migrate_open_tabs.sql`
and run `npx prisma generate` in backend. This repairs legacy service quantities and
adds settlement collection sources. Apply it to fresh installations too.

## Service catalog ownership

A partner keeps one `services` row, with its own stock, per court per product name — the same
name repeating across a partner's courts is expected, not duplication. `services_court_id_name_key`
enforces one row per (court, name).

`services.image_url` is a plain TEXT column holding a URL, so a picture can be set without any
upload — paste a link in the service form, or set it in SQL. Scope the update by partner, because
the same product name exists under other partners too:

```sql
update services set image_url = 'https://...', updated_at = now()
where partner_id = 'pp0001' and name = 'Nước suối Aquafina 500ml';
```

The app applies an image to every court row of that product name for the partner, so the statement
above matches what the UI does. Price, stock and status stay per court.

`migrate_fix_orphan_service_owner.sql` cleans up after two writers that escaped that rule: it
re-points rows whose `partner_id` held a `users.id`, adopts a court for sold rows that had none,
adds the missing `services.partner_id` foreign key, and adds a partial unique index so rows with
no court still cannot repeat a name within a partner. It deletes nothing and is idempotent.

A booking can have two settlement rows: PLATFORM (actual online funds, wallet-backed)
and PARTNER (counter collections, never credited/debited to the wallet). Repeated
checkout completion only adds the unrecorded counter amount. Existing historical
platform settlements are preserved; this migration does not retroactively reconcile
wallet balances that older code credited against a full invoice instead of a deposit.
