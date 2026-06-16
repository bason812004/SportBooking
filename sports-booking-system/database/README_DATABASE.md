# Huong Dan Database Supabase

## Chay schema va seed data

1. Mo Supabase project.
2. Chon SQL Editor > New query.
3. Paste toan bo file `database/supabase_schema.sql` > Bam Run.
4. Paste toan bo file `database/seed_extra_reviews.sql` > Bam Run.
5. Paste toan bo file `database/seed_blog_voucher_tournament.sql` > Bam Run.

## Quy uoc ID

Moi bang co ID dang `{prefix}{so_thu_tu}`, voi prefix la viet tat ten bang:

| Bang | Prefix | Vi du |
|------|--------|-------|
| users | u | u0001, u0021 |
| partner_profiles | pp | pp0001 |
| court_categories | cc | cc0001 |
| courts | c | c0001 |
| court_surfaces | csf | csf0001 |
| court_images | ci | ci0001 |
| court_amenities | ca | ca0001 |
| court_prices | cp | cp0001 |
| court_services | cs | cs0001 |
| bookings | b | b0001 |
| booking_services | bs | bs0001 |
| reviews | rv | rv0001 |
| reports | rp | rp0001 |
| notifications | nf | nf0001 |
| vouchers | v | v0001 |
| blog_categories | bc | bc0001 |
| blog_posts | bp | bp0001 |
| tournaments | tn | tn0001 |
| tournament_registrations | tr | tr0001 |
| team_recruitment_posts | tp | tp0001 |

Sequence tu dong sinh ID khi INSERT khong truyen id.

## Kiem tra table

Vao Table Editor va kiem tra cac bang:

- `users`
- `partner_profiles`
- `court_categories`
- `courts`
- `court_prices`
- `court_services`
- `bookings`
- `reviews`
- `reports`
- `notifications`

## Kiem tra seed data

Chay nhanh:

```sql
select id, email, role, status from users order by role, id;
select id, name, city, approval_status from courts;
select id, booking_code, booking_status, total_price from bookings;
```

## Password hash

Seed account dung password goc `123456`, nhung cot `password_hash` duoc tao bang `crypt('123456', gen_salt('bf', 10))`. Database khong luu plain password.

## Supabase Auth

Du an nay dung custom auth trong bang `users` de dap ung yeu cau JWT backend. Neu sau nay chuyen sang Supabase Auth, can cap nhat backend auth service va relation user id tu `auth.users`.
