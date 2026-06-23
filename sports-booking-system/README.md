# Sports Booking System

Website quan ly va dat san the thao truc tuyen, tach rieng frontend React/Vite va backend Express/Prisma. Frontend chi goi API, backend xu ly auth, role, booking conflict, tinh tien va ket noi Supabase PostgreSQL.

## Cong nghe

- Frontend: ReactJS, Vite, TypeScript, Tailwind CSS, React Router DOM, Axios, React Hook Form, Zod, TanStack Query, Sonner, Recharts.
- Backend: Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL, JWT, bcryptjs, Zod, Multer, Supabase Storage SDK, Swagger/OpenAPI.
- Database: Supabase PostgreSQL.
- Deploy goi y: Vercel cho frontend, Render/Railway cho backend, Supabase cho database/storage.

## Cau truc

```text
sports-booking-system/
  frontend/
  backend/
  database/
  docs/
```

## Tao Supabase database

1. Tao project moi tren Supabase.
2. Vao SQL Editor > New query.
3. Copy noi dung `database/supabase_schema.sql`.
4. Run script.
5. Vao Table Editor kiem tra cac bang `users`, `courts`, `bookings`, `reviews`.

Script co seed data gom 1 admin, 2 partner, 5 user, 6 loai san, 10 san, bang gia, dich vu, booking va review mau.

## Tai khoan mau

Mat khau goc cho tat ca tai khoan mau: `123456`. Trong database chi luu bcrypt hash.

- Admin: `admin@sportsbooking.com`
- Partner 1: `partner1@sportsbooking.com`
- Partner 2: `partner2@sportsbooking.com`
- User 1: `user1@sportsbooking.com`

## Auth, Google OAuth va realtime

Backend env can co:

```env
JWT_SECRET=replace-with-legacy-or-shared-secret-at-least-24-chars
JWT_ACCESS_SECRET=replace-with-access-secret-at-least-24-chars
JWT_REFRESH_SECRET=replace-with-refresh-secret-at-least-24-chars
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
FRONTEND_URL=http://localhost:5173
```

Frontend env can co:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Email/password auth dung bcrypt va backend JWT access/refresh token. Google sign-in dung Google Identity Services o frontend, gui ID token den `POST /api/auth/google`, backend verify bang `google-auth-library`, sau do cap JWT cua he thong.

Realtime dung Socket.IO. Frontend chi connect sau khi dang nhap voi access token va lang nghe booking, court availability, notification events.

## Chay backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Can dien `.env`:

```env
PORT=8080
DATABASE_URL=postgresql://...
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=court-images
FRONTEND_URL=http://localhost:5173
```

Neu tao database bang SQL Editor, dung `npx prisma generate`. Khi muon dong bo lai Prisma schema tu Supabase co the chay `npx prisma db pull`.

API docs: `http://localhost:8080/api/docs`

## Chay frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend mac dinh chay tai `http://localhost:5173` va goi backend `http://localhost:8080/api`.

## Logic quan trong

- Backend kiem tra trung lich bang dieu kien `newStart < existingEnd && newEnd > existingStart`.
- Backend tinh tong tien dua tren bang gia, dynamic pricing, voucher discount, thoi luong va dich vu di kem.
- San chi public khi `approval_status = APPROVED` va `active_status = ACTIVE`.
- Partner chi sua san, gia, dich vu va don thuoc san cua minh.
- Admin co API khoa/mo khoa user, duyet partner, duyet san, quan ly category, review, report va thong ke.
- Frontend khong tu quyet dinh final price. Booking API luon tinh lai tren backend.
- Demand prediction khong tra ket qua AI gia. Neu thieu lich su booking, API tra `INSUFFICIENT_DATA`.

## Module moi

- Dynamic Pricing: `dynamic_pricing_rules`, `court_base_prices`, `GET /api/courts/:courtId/dynamic-price`, partner CRUD tai `/api/partner/dynamic-pricing/rules`.
- Demand Prediction: rule-based demand scoring, `demand_predictions`, `demand_features`, public API `/api/courts/:courtId/demand-prediction`, partner overview tai `/api/partner/demand-prediction/*`.
- Voucher Engine: claim, user vouchers, apply voucher, partner CRUD, admin disable.
- Tournament Platform: public registration, partner management, registration approval/rejection, admin pending approval.
- Analytics Dashboard API: partner `/api/partner/analytics/*`, admin `/api/admin/analytics/*`.

## API chinh

- `GET /api/courts/:courtId/dynamic-price?date=&startTime=&endTime=`
- `GET /api/courts/:courtId/demand-prediction?date=&startTime=&endTime=`
- `POST /api/vouchers/:id/claim`
- `GET /api/users/me/vouchers`
- `POST /api/bookings/apply-voucher`
- `POST /api/tournaments/:id/register`
- `GET /api/partner/analytics/overview`
- `GET /api/admin/analytics/overview`

## Prisma va migration

Sau khi cap nhat database:

```bash
cd backend
npx prisma generate
npm run build
npm test
```

`database/supabase_schema.sql` co ca schema day du cho database moi va cac block `create table if not exists` / `alter table add column if not exists` de bo sung an toan cho database cu. Khong xoa bang cu khi chay migration tren database dang co du lieu.

## ML-ready

Tai lieu nghien cuu nam o `docs/RESEARCH_DIRECTION.md`.

Folder `ml/` gom:

- `README_ML.md`
- `scripts/export_training_data.py`
- `scripts/train_demand_model.py`
- `scripts/evaluate_model.py`

Giai doan hien tai dung rule-based model that su chay tren du lieu booking. Chi train/deploy ML model khi co du lieu lich su du lon va co ket qua danh gia MAE/RMSE/accuracy.

## Deploy

Frontend Vercel:

1. Import repo.
2. Root Directory: `sports-booking-system/frontend`.
3. Build command: `npm run build`.
4. Output: `dist`.
5. Env: `VITE_API_BASE_URL=https://your-backend/api`.

Backend Render/Railway:

1. Root Directory: `sports-booking-system/backend`.
2. Build command: `npm install && npx prisma generate && npm run build`.
3. Start command: `npm start`.
4. Dien env nhu phan backend.

## Loi thuong gap

- `DATABASE_URL is required`: chua tao file backend `.env`.
- Login sample fail: chua chay `database/supabase_schema.sql` hoac database khong co seed.
- CORS fail: `FRONTEND_URL` backend khong khop domain frontend.
- Upload anh fail: chua tao bucket Supabase Storage hoac thieu service role key.

## Migration hoa hong

Voi database da ton tai, chay mot lan:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/migrate_commission.sql
npx prisma generate
```

## Migration quan ly Partner

Voi database da ton tai, chay mot lan de bo sung thong tin ngan hang va ma so thue:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/migrate_partner_management.sql
npx prisma generate
```

## Migration quan tri Admin

Voi database da ton tai, chay mot lan de tao audit log, ledger log va lich su kiem duyet:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/migrate_admin_management.sql
npx prisma generate
```
# Xác thực email khi đăng ký

Đăng ký tài khoản LOCAL dùng luồng OTP hai bước. Chạy
`database/migrate_email_verification.sql` trên Supabase trước khi khởi động backend,
sau đó cấu hình SMTP theo `backend/.env.example`. Với Gmail, dùng App Password thay
cho mật khẩu Gmail thông thường.

Các API:

- `POST /api/auth/register/request-code`
- `POST /api/auth/register/verify-code`
- `POST /api/auth/register/resend-code`
