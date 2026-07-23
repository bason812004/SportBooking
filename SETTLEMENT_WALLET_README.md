# Ví Hệ Thống & Quyết Toán Doanh Thu - Implementation Summary

## 1. Database Schema

### Bảng mới

#### `partner_wallets` - Ví escrow cho mỗi Partner
- `id` (varchar(20), pk)
- `partner_id` (varchar(20), unique, FK partner_profiles)
- `available_balance` (decimal) - số dư khả dụng (đã quyết toán, được rút)
- `pending_balance` (decimal) - số dư chờ quyết toán (đã thanh toán nhưng booking chưa hoàn thành)
- `total_earned` (decimal) - tổng doanh thu từ trước đến nay
- `total_withdrawn` (decimal) - tổng tiền đã rút
- `currency` (varchar(3), default 'VND')

#### `settlements` - Quyết toán cho mỗi booking đã thanh toán
- `id` (varchar(20), pk)
- `booking_id` (varchar(20), unique, FK bookings)
- `partner_id` (varchar(20), FK partner_profiles)
- `payment_id` (uuid, FK payments)
- `gross_amount` (decimal) - tổng doanh thu gốc (slots + services)
- `voucher_discount` (decimal) - tổng giảm giá voucher
- `platform_discount` (decimal) - giảm giá từ Platform Voucher (=0, sẽ tích hợp sau)
- `partner_discount` (decimal) - giảm giá từ Partner Voucher
- `commission_amount` (decimal) - hoa hồng hệ thống
- `service_fee` (decimal)
- `net_amount` (decimal) - Partner thực nhận
- `status` (settlement_status): `PENDING` | `PROCESSING` | `SETTLED` | `FAILED` | `CANCELLED`
- `settled_at`, `created_at`, `updated_at`

#### `withdrawal_requests` - Yêu cầu rút tiền của Partner
- `id` (varchar(20), pk)
- `partner_id` (varchar(20), FK)
- `amount` (decimal, > 0)
- `bank_name`, `bank_account_number`, `bank_account_name`
- `status` (withdrawal_status): `PENDING` | `APPROVED` | `REJECTED` | `PAID`
- `processed_by` (varchar(20), FK users.id) - Admin duyệt
- `note`

### SQL migration
File: `database/migrate_settlement_wallet.sql`
- Tạo enum types
- Tạo 3 bảng mới (idempotent với `if not exists`)
- Seed wallet mặc định (balance=0) cho tất cả partner hiện có
- Trigger tự động tạo wallet khi partner mới được insert
- Indexes cho performance

### Prisma Schema
Đã cập nhật `backend/prisma/schema.prisma`:
- Thêm enum `SettlementStatus`, `WithdrawalStatus`
- Thêm models `PartnerWallet`, `Settlement`, `WithdrawalRequest`
- Cập nhật relations trên `PartnerProfile`, `User`, `Booking`

## 2. Quy tắc chia doanh thu

### Công thức tính Settlement
```
gross_amount     = sum(slotPrice) + sum(service.price * quantity)
voucher_discount = sum(voucher discount áp dụng cho booking)
commission_amount = gross_amount * (commission_rate / 100)
net_amount       = gross_amount - commission_amount

Trong đó:
- partner_discount = voucher_discount (voucher Partner → trừ vào doanh thu Partner)
- platform_discount = 0 (chưa có Platform Voucher)
```

### Ví dụ (theo yêu cầu)
- Giá sân: 400,000 VND
- Voucher Partner: -50,000 VND
- Voucher Platform: -20,000 VND
- Hoa hồng: 10%
- User thanh toán: 330,000 VND

Tính toán:
- `gross_amount` = 400,000 (giá gốc sân, KHÔNG trừ voucher)
- `partner_discount` = 50,000 (trừ vào doanh thu Partner)
- `commission_amount` = 400,000 × 10% = 40,000
- `net_amount` = 400,000 - 40,000 = 360,000 (Partner nhận)
- Platform chịu 20,000 (chi phí marketing)
- User thanh toán 330,000 = gross_amount - partner_voucher - platform_voucher

### Quy tắc xử lý Voucher
- **Partner Voucher**: Trừ vào `gross_amount` trước khi tính commission → Partner chịu phần giảm giá này
- **Platform Voucher**: Tính là `platform_discount`, là chi phí marketing của hệ thống, KHÔNG ảnh hưởng commission
- Hiện tại schema đã track `platform_discount` và `partner_discount` riêng biệt để sẵn sàng tích hợp Platform Voucher sau

### Commission rate
- Đọc từ `partner_profiles.commission_rate` (override riêng)
- Nếu null → fallback default rate (10%) từ `system_settings`

## 3. Booking Flow với Settlement

### Bước 1-4: Thanh toán → Booking CONFIRMED
1. User thanh toán QR
2. Backend webhook xác minh giao dịch (`paymentRepository.applyWebhook`)
3. Payment status → `PAID`
4. Booking status → `CONFIRMED`
5. **Tự động tạo Settlement** với status `PENDING`:
   - Insert record `settlements`
   - Cộng `net_amount` vào `partner_wallets.pending_balance`
   - Cộng `net_amount` vào `partner_wallets.total_earned`
6. Realtime emit `settlement:updated` cho Partner & Admin

### Bước 5-6: Booking hoàn thành → Settlement SETTLED
Khi Admin cập nhật booking status từ CONFIRMED → COMPLETED:
- Settlement status: `PENDING` → `SETTLED`, set `settled_at`
- Wallet: `pending_balance -= net_amount`, `available_balance += net_amount`
- Realtime emit để dashboard cập nhật live

### Bước 7: Booking bị hủy
Nếu booking bị CANCELLED trong khi settlement vẫn PENDING:
- Wallet: `pending_balance -= net_amount` (rollback)
- Settlement status: `CANCELLED`
- Realtime emit

### Bước 8-9: Withdrawal
1. Partner gọi `POST /api/partner/withdrawals` với amount + bank info
2. Backend validate: `amount ≤ available_balance`
3. Tạo `withdrawal_requests` với status `PENDING`
4. Realtime emit `withdrawal:created`

### Bước 10-12: Admin xử lý Withdrawal
- `PUT /api/admin/withdrawals/:id/approve` → status `APPROVED`
- `PUT /api/admin/withdrawals/:id/reject` → status `REJECTED`, **hoàn lại** `available_balance`
- `PUT /api/admin/withdrawals/:id/paid` → status `PAID`:
  - `available_balance -= amount`
  - `total_withdrawn += amount`
- Realtime emit `withdrawal:updated` mỗi bước

## 4. API endpoints

### Partner (`requireRole(PARTNER)`)
```
GET    /api/partner/wallet/me                          - Lấy ví của tôi
GET    /api/partner/settlements                        - Danh sách settlement của tôi
GET    /api/partner/settlements/:id                    - Chi tiết settlement
GET    /api/partner/settlements/summary                - Thống kê settlement
POST   /api/partner/withdrawals                        - Tạo yêu cầu rút tiền
GET    /api/partner/withdrawals                        - Lịch sử rút tiền của tôi
```

### Admin (`requireRole(ADMIN)`)
```
GET    /api/admin/wallets/partner-wallets              - Danh sách tất cả ví Partner
GET    /api/admin/wallets/partner-wallets/:partnerId   - Chi tiết 1 ví Partner
GET    /api/admin/wallets/partner-wallets/summary      - Tổng quan ví toàn hệ thống

GET    /api/admin/settlements                          - Danh sách tất cả settlement (filter theo partner, status, date range)
GET    /api/admin/settlements/summary                  - Tổng quan settlement
PUT    /api/admin/settlements/:id/settle               - Force settle 1 settlement
PUT    /api/admin/settlements/:id/cancel               - Hủy settlement (refund)

GET    /api/admin/withdrawals                          - Tất cả yêu cầu rút tiền
GET    /api/admin/withdrawals/summary                  - Thống kê withdrawal
PUT    /api/admin/withdrawals/:id/approve              - Duyệt
PUT    /api/admin/withdrawals/:id/reject               - Từ chối (hoàn tiền)
PUT    /api/admin/withdrawals/:id/paid                  - Xác nhận đã chuyển khoản
```

## 5. Realtime events
Thêm vào `realtimeEvents`:
- `settlement:updated` - Settlement status thay đổi
- `withdrawal:created` - Có yêu cầu rút tiền mới (notify admin)
- `withdrawal:updated` - Withdrawal status thay đổi (notify partner)
- `wallet:updated` - Số dư thay đổi

Rooms:
- `partner:<partnerId>` - Channel riêng cho mỗi Partner
- `admin` - Channel cho tất cả Admin

## 6. Frontend Pages

### `/partner/wallet` - Partner Wallet Dashboard
- 4 stats cards: Available, Pending, Total Earned, Total Withdrawn
- CTA rút tiền (chỉ hiện khi available > 0)
- 3 tabs:
  - **Tổng quan**: Quy tắc quyết toán + Quy tắc tính doanh thu
  - **Lịch sử quyết toán**: Bảng settlement với gross/commission/net
  - **Lịch sử rút tiền**: Bảng withdrawal với nút tạo yêu cầu
- Modal rút tiền: amount + bank info

### `/admin/settlements` - Admin Settlement Management
- 4 summary cards: Gross, Commission, Net, Pending
- Filter theo status
- Bảng tất cả settlements: booking, partner, breakdown, status

### `/admin/withdrawals` - Admin Withdrawal Management
- 3 summary cards: Total, Pending, Paid
- Filter theo status
- Bảng với action buttons:
  - PENDING → Duyệt / Từ chối
  - APPROVED → Xác nhận thanh toán
  - REJECTED / PAID → Hiển thị trạng thái cuối

## 7. Security & Data Integrity

### Database Transactions
Tất cả cập nhật balance được thực hiện trong `prisma.$transaction`:
- `settlementService.createSettlementFromPayment` (tx)
- `settlementService.settle` (tx)
- `settlementService.cancel` (tx)
- `withdrawalService.create` (tx-safe via atomic operations)
- `withdrawalService.approve` / `reject` / `markPaid` (tx)
- `paymentRepository.applyWebhook` (tx) - atomic với settlement creation

### Authorization
- Partner chỉ xem được settlement/wallet/withdrawal của chính mình (check `partnerId` trong controller)
- Partner KHÔNG thể:
  - Đổi số dư ví
  - Đổi status settlement
  - Đổi status withdrawal (trừ implicit cancel qua reject)
- Chỉ Admin mới có thể: approve, reject, paid, cancel settlement

### Audit Log
Mọi action Admin đều gọi `recordAdminAction`:
- `SETTLEMENT_COMPLETED`
- `SETTLEMENT_CANCELLED`
- `WITHDRAWAL_APPROVED`
- `WITHDRAWAL_REJECTED`
- `WITHDRAWAL_PAID`

### Idempotency
- `applyWebhook` kiểm tra `payment_transactions` table trước khi xử lý → tránh double-create settlement
- `settlement.findUnique({ where: { bookingId } })` trước khi insert → tránh duplicate

### Realtime Safety
Realtime events chỉ emit SAU khi transaction commit thành công → không phát sự kiện nếu rollback.

## 8. Files đã thêm/sửa

### Backend (mới)
```
backend/src/modules/settlements/
  ├── settlement.types.ts
  ├── settlement.repository.ts
  ├── settlement.service.ts
  ├── settlement.controller.ts
  ├── settlement.validation.ts
  └── settlement.routes.ts

backend/src/modules/wallets/
  ├── wallet.types.ts
  ├── wallet.repository.ts
  ├── wallet.service.ts
  ├── wallet.controller.ts
  └── wallet.routes.ts

backend/src/modules/withdrawals/
  ├── withdrawal.types.ts
  ├── withdrawal.repository.ts
  ├── withdrawal.service.ts
  ├── withdrawal.controller.ts
  ├── withdrawal.validation.ts
  └── withdrawal.routes.ts
```

### Backend (sửa)
```
backend/prisma/schema.prisma              # +3 models, +2 enums
backend/src/app.ts                        # Register routes
backend/src/modules/realtime/realtime.events.ts   # +3 events
backend/src/modules/payments/payment.repository.ts # Auto-create settlement
backend/src/modules/admin/admin.repository.ts      # Auto-settle on COMPLETED, cancel on CANCELLED
```

### Frontend (mới)
```
frontend/src/pages/partner/PartnerWalletPage.tsx
frontend/src/pages/admin/AdminSettlementsPage.tsx
frontend/src/pages/admin/AdminWithdrawalsPage.tsx
frontend/src/pages/admin/StatusBadges.tsx
```

### Frontend (sửa)
```
frontend/src/types/api.ts                  # +6 types (Wallet, Settlement, Withdrawal)
frontend/src/features/partner/api/partnerApi.ts  # +5 API methods
frontend/src/features/admin/api/adminApi.ts      # +9 API methods
frontend/src/routes/AppRoutes.tsx          # +3 routes
frontend/src/components/layout/DashboardLayout.tsx  # +2 menu items
frontend/src/pages/admin/AdminBookingsPage.tsx  # Tiny pre-existing TS fix
```

### Database (mới)
```
database/migrate_settlement_wallet.sql
```

## 9. Verification

### Backend
```bash
cd backend
npx tsc --noEmit     # PASS
npm run build        # PASS
npx prisma validate  # PASS
npx prisma generate  # PASS
```

### Frontend
```bash
cd frontend
npx tsc --noEmit     # PASS (sau khi fix 1 pre-existing issue)
npm run build        # PASS
```

### Manual Test Cases
1. User thanh toán booking 400k, commission 10% → Settlement net = 360k, pending_balance += 360k
2. Admin set booking COMPLETED → settlement SETTLED, pending -= 360k, available += 360k
3. Partner withdraw 200k → request PENDING, không ảnh hưởng balance
4. Admin approve → status APPROVED (balance chưa đổi)
5. Admin mark PAID → available -= 200k, total_withdrawn += 200k
6. Admin reject withdrawal → hoàn lại available (nếu đã approve)

### Đảm bảo nhất quán dữ liệu
- Mọi cập nhật balance trong transaction
- Validation amount ≤ available trước khi tạo withdrawal
- Trigger DB tự tạo wallet khi partner mới insert
- Realtime emit SAU khi tx commit
- Audit log cho mọi admin action