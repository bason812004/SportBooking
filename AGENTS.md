# AGENTS.md

## Tổng quan

Đây là dự án đặt sân thể thao, nằm trong thư mục `sports-booking-system/`:

- `backend/`: Express + TypeScript + Prisma, kết nối Supabase PostgreSQL.
- `frontend/`: React + Vite + TypeScript.
- `mobile/`: ứng dụng di động React Native/Expo dùng chung backend API.
- `database/`: schema, seed và migration SQL.
- `docs/`: tài liệu kiến trúc, API, triển khai và nghiên cứu.
- `ml/`: pipeline dự đoán nhu cầu tùy chọn, mặc định backend dùng rule-based.

Không có `package.json` ở thư mục gốc; chạy npm bên trong `backend/` hoặc `frontend/`.

## Cách làm việc

- Đọc README/docs và tìm module tương tự trước khi sửa.
- Backend giữ luồng `routes -> controller -> service -> repository -> Prisma`; controller không truy vấn Prisma trực tiếp.
- Dùng Zod + middleware để validate request; dùng `sendSuccess` cho response thành công và `AppError` cho lỗi nghiệp vụ.
- Frontend gọi API qua `src/lib/axios.ts`, dùng TanStack Query cho server state; text giao diện đặt trong `src/locales/vi` và `src/locales/en`.
- Booking, giá cuối, voucher, quyền sở hữu và trạng thái thanh toán phải được kiểm tra ở backend.
- Giữ thay đổi nhỏ, bám convention hiện có; không sửa `dist/`, `node_modules/` hay file sinh tự động.
- Không hoàn tác thay đổi có sẵn trong worktree.

## Chạy dự án

Từ thư mục `sports-booking-system/`:

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run dev                 # http://localhost:8080

# Frontend (terminal khác)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Tạo `.env` theo các file `.env.example`. Backend cần tối thiểu `DATABASE_URL`, `JWT_SECRET` (ít nhất 24 ký tự) và các biến Supabase phù hợp. Frontend dùng `VITE_API_BASE_URL`, mặc định là `http://localhost:8080/api`.

## Kiểm tra

```bash
cd backend
npm run build
npm test

cd ../frontend
npm run build
```

Frontend hiện chưa có script lint/test riêng. Sau khi thay đổi Prisma/schema, luôn chạy `npx prisma generate`; khi đổi database, kiểm tra migration và build/test backend. API docs có tại `http://localhost:8080/api/docs` khi backend đang chạy.

## Database

- Database mới: chạy `database/00_schema_tables.sql`, sau đó tùy chọn `02_seed_data.sql`.
- Database có sẵn: xem thứ tự trong `database/README.md`, đặc biệt `01_existing_db_migrations.sql`; không chạy migration phá hủy trên dữ liệu thật nếu chưa được xác nhận.
- Chạy một migration bằng Prisma:

```bash
cd backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/<migration-file>.sql
npx prisma generate
```

## Quy tắc an toàn

Cần xác nhận trước khi xóa dữ liệu, chạy migration phá hủy trên database thật, đổi auth/payment/commission/booking-pricing, xoay secret, hoặc deploy production. Các lệnh đọc, build/test cục bộ và chỉnh sửa code theo convention có thể thực hiện trực tiếp.

## Đồng bộ hướng dẫn

`CLAUDE.md` là nguồn quy tắc đầy đủ. Mỗi khi `CLAUDE.md` được sửa, phải cập nhật `AGENTS.md` tương ứng (đặc biệt commands, cấu trúc thư mục, convention và gotchas). Khi hai file khác nhau, ưu tiên nội dung mới nhất của `CLAUDE.md` và đồng bộ lại file này.
