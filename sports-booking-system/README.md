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
- Backend tinh tong tien dua tren bang gia, thoi luong va dich vu di kem.
- Hoa hong mac dinh luu trong `system_settings`; `partner_profiles.commission_rate` co the override theo doi tac.
- Khi booking chuyen `COMPLETED`, he thong snapshot doanh thu goc, ty le hoa hong, phi va thuc nhan vao `commission_transactions`.
- Khi `NO_SHOW`, hoa hong duoc tinh tren tien coc. Huy truoc 24 gio hoan 100%; huy trong 24 gio hoan 50%.
- `commission_transactions` la immutable; dieu chinh sau nay phai them ban ghi `REVERSAL`.
- Partner co the tao voucher nhap, sua/xoa khi chua phat hanh, kich hoat va vo hieu hoa voucher.
- Voucher co the ap dung cho tat ca san cua partner hoac mot san cu the; backend kiem tra ownership.
- Voucher `ACTIVE` con han moi duoc hien thi tren trang voucher public.
- San chi public khi `approval_status = APPROVED` va `active_status = ACTIVE`.
- Partner chi sua san, gia, dich vu va don thuoc san cua minh.
- Admin co API khoa/mo khoa user, duyet partner, duyet san, quan ly category, review, report va thong ke.

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
