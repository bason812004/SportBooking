# Combined Database Scripts

Use these files instead of running many scattered SQL scripts by hand.

## Fresh database

Run in this order:

1. `00_schema_tables.sql`
2. `02_seed_data.sql` if you want demo data

`00_schema_tables.sql` contains the core tables, enums, triggers, and indexes. Also apply the admin notification outbox migration below after the wallet/withdrawal and court-image prerequisites are installed.

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

## Reliable ADMIN notifications

Apply `admin_notification_outbox.sql` after `repair_court_image_moderation.sql` and the wallet/withdrawal migrations (`migrate_settlement_wallet.sql` for databases without those tables). Stop the backend while applying this change, regenerate Prisma, then restart it:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/admin_notification_outbox.sql
npx prisma generate
npm run dev
```

This adds a private outbox and triggers for court/profile review, pending blog/tournament submissions, image submissions, reports and withdrawal requests. Drafts and unchanged resubmissions do not generate review events. No historical rows are replayed and applying the migration again does not duplicate triggers. Apply this migration before running the new backend: blog/tournament services now rely on the trigger instead of sending a second notification.

The worker checks every 3 seconds. It locks each event, inserts notices for all active admins and marks the event processed in one transaction. Rollback/restart cannot leave half-delivered events; retries back off up to one hour. Missing active admins also cause a retry. Socket delivery happens after commit; clients recover missed socket events through reconnect/focus refresh and 30-second polling.

Inspect pending failures using `SELECT id, type, attempts, next_attempt_at, last_error FROM admin_notification_outbox WHERE processed_at IS NULL ORDER BY id;`. Avoid exposing this table through Supabase client APIs; RLS is enabled without client policies.

Run `npx tsx src/scripts/check_admin_notification_triggers.ts` to verify event triggers and rollback against temporary PostgreSQL tables, without modifying live business rows or sending notices.

## Court image moderation

For an existing database, apply the additive `repair_court_image_moderation.sql` migration before starting the updated backend:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/repair_court_image_moderation.sql
npx prisma generate
```

The migration creates a separate image request table and a unique index for pending replacements. Existing published images and court approval statuses are preserved. Fresh schemas and the combined existing-database migration include the same table. On Windows, stop the local backend before regenerating Prisma if its engine DLL is locked, then restart it.

## Repair team post demo text

If `tp0001` or `tp0003` displays corrupted Vietnamese text, run from `backend/`:

```bash
npx prisma db execute --schema prisma/schema.prisma --file ../database/repair_team_post_seed_encoding.sql
```

This transaction repairs six text fields per post only when their values still match the corrupted seed text. It preserves customized text, prices, schedules, and membership. It is safe to rerun. New databases use the corrected text in `02_seed_data.sql`. Refresh the mobile list after applying the repair.

## Voucher Vietnamese text

Run `npx prisma db execute --schema prisma/schema.prisma --file ../database/repair_voucher_vietnamese_text.sql` from `backend/` to add Vietnamese accents to the known WELCOME50, SPORT10, WEEKEND15, NIGHT30 and SUMMER20 seed titles/descriptions. Exact old-value guards make it safe to rerun and preserve customized text. Codes, discount amounts and eligibility rules are unchanged. The corresponding SQL and Prisma seed sources also use accented text.

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

## Purchase orders per court

Apply `migrate_purchase_order_court_scope.sql` before starting the backend that scopes purchase orders to a court (cụm sân):

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/migrate_purchase_order_court_scope.sql
npx prisma generate
```

It only adds columns: `purchase_orders.court_id`, who created/ordered/received/cancelled the order and when,
`received_amount`, `receive_note`, and `purchase_order_items.received_quantity`. Existing rows are left untouched
(older orders simply have no court) and it is safe to rerun. On Windows, stop the local backend before regenerating
Prisma if its engine DLL is locked, then restart it.

# Đồng bộ mã sân con

Chạy `normalize_court_surface_codes.sql` để chuyển mã số cũ sang `S01`, `S02`… và tên `<Tên cụm sân> - Sân 01`. Script giữ nguyên ID, không xóa/gộp sân và không thay đổi liên kết booking. Nếu `01` và `S01` cùng tồn tại, bản ghi mã số được cấp mã S còn trống. Có thể chạy lại an toàn; mã tùy chỉnh không có dạng số được giữ nguyên.
