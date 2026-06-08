# Huong Dan Database Supabase

## Chay schema

1. Mo Supabase project.
2. Chon SQL Editor.
3. Chon New query.
4. Paste toan bo file `database/supabase_schema.sql`.
5. Bam Run.

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
select email, role, status from users order by role, email;
select name, city, approval_status, active_status from courts;
select booking_code, booking_status, total_price from bookings;
```

## Password hash

Seed account dung password goc `123456`, nhung cot `password_hash` duoc tao bang `crypt('123456', gen_salt('bf', 10))`. Database khong luu plain password.

## Supabase Auth

Du an nay dung custom auth trong bang `users` de dap ung yeu cau JWT backend. Neu sau nay chuyen sang Supabase Auth, can cap nhat backend auth service va relation user id tu `auth.users`.
