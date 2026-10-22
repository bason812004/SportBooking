# Cấu hình Gmail và payOS

## 1. Điền cấu hình riêng trên máy

Mở `backend/.env.gmail-payos.example` và **ghép các biến** vào `backend/.env`.
Không chép đè toàn bộ `.env`: giữ nguyên DATABASE_URL, JWT và các cấu hình hiện có.
Không đưa mật khẩu/khóa API vào frontend, mobile, Git hoặc chat.

### Gmail

- Bật xác minh hai bước và tạo Mật khẩu ứng dụng cho tài khoản gửi email.
- Điền SMTP_USER và MAIL_FROM_ADDRESS bằng cùng địa chỉ Gmail.
- SMTP_PASS là Mật khẩu ứng dụng; không dùng mật khẩu đăng nhập Gmail.
- Dùng SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false (STARTTLS).
- Tài khoản do tổ chức quản lý có thể không cho phép Mật khẩu ứng dụng; kiểm tra chính sách của tài khoản.

Luồng hiện có là OTP **đăng ký**, chưa phải khôi phục mật khẩu. Mã hết hạn sau
10 phút; gửi lại cần chờ 60 giây. Database cần bảng email_verification_codes và
users.email_verified. README cũ nhắc migrate_email_verification.sql nhưng file đó
không có trong repository hiện tại; không chạy lại 00_schema_tables.sql lên DB có dữ liệu.

### payOS

Tạo và xác thực tài khoản payOS, liên kết ngân hàng và tạo kênh thanh toán.
Ánh xạ khóa vào tên biến hiện có của dự án:

| Biến backend | Giá trị trên payOS |
| --- | --- |
| PAYMENT_PROVIDER | PAYOS |
| PAYMENT_API_KEY | Client ID |
| PAYMENT_SECRET_KEY | API Key |
| PAYMENT_WEBHOOK_SECRET | Checksum Key |

PAYMENT_RETURN_URL trỏ tới giao diện `/user/bookings` (local có thể dùng
http://localhost:5173/user/bookings). PAYMENT_QR_EXPIRES_MINUTES mặc định là 15;
backend gửi cùng thời hạn của bản ghi thanh toán tới payOS.

## 2. Kiểm tra cấu hình

Chạy trong `backend/`:

```powershell
npm run check:integrations
node node_modules/tsx/dist/cli.mjs src/scripts/check_integrations.ts --smtp
```

Lệnh đầu chỉ kiểm tra trường cấu hình, không in giá trị bí mật, không gửi email
và không tạo giao dịch. Lệnh thứ hai xác minh kết nối/đăng nhập SMTP khi các trường
đã đầy đủ, cũng không gửi email. Thành công ở đây chưa chứng minh khóa payOS đúng.

## 3. Đăng ký webhook

Backend phải có URL HTTPS công khai. Khi chạy local, dùng tunnel HTTPS trỏ tới
cổng 8080; URL không được là localhost.

```text
https://TEN-MIEN-BACKEND/api/payments/webhook/payos
```

Điền URL này vào PAYMENT_WEBHOOK_URL **và đăng ký URL trong kênh thanh toán payOS**.
Biến môi trường không tự đăng ký webhook. Nếu URL tunnel thay đổi, cập nhật cả hai.
payOS gửi giao dịch mẫu để kiểm tra webhook; backend chỉ bỏ qua ghi DB khi mẫu
khớp mẫu chính thức và có chữ ký hợp lệ. Webhook thật không tìm thấy đơn vẫn báo
lỗi để tránh mất giao dịch trong lúc bản ghi đơn chưa được lưu.

Khởi động lại backend sau khi sửa `.env`. Không dùng nút hoàn tất thanh toán thử
để kết luận webhook thật đã hoạt động. Khi triển khai thật, NODE_ENV=production
để endpoint dev-complete bị vô hiệu hóa.

## 4. Kiểm thử đầu cuối sau khi điền khóa

1. Dùng email do bạn kiểm soát: đăng ký, nhận OTP, nhập mã, đăng nhập; thử mã sai,
   hết hạn và gửi lại. Việc gửi email chỉ thực hiện khi bạn chủ động kiểm thử.
2. Tạo đơn thử trên môi trường thử nghiệm, kiểm tra QR payOS và người nhận.
3. Thực hiện giao dịch nhỏ được bạn cho phép, xác nhận webhook cập nhật đúng đơn.
4. Kiểm tra webhook lặp không ghi tiền hai lần; chữ ký sai bị từ chối; thanh toán
   trễ không khôi phục sân đã giải phóng và được đưa vào luồng xử lý hoàn tiền.

QR payOS và QR chuyển khoản tại quầy là hai luồng: payOS xác nhận qua webhook;
checkout dịch vụ tại quầy vẫn cần nhân viên xác nhận khoản đã nhận. QR tại quầy
dùng tài khoản đối tác từ backend. Nếu bankName là tên ngân hàng viết tự do thay
vì mã VietQR/BIN, giao diện hiện thông tin chuyển khoản thủ công thay vì tạo QR
với tài khoản dự phòng. Việc tích hợp chi tiền/rút tiền thật vẫn nằm ngoài phần này.

## Tài liệu chính thức

- https://support.google.com/mail/answer/185833?hl=vi
- https://support.google.com/a/answer/176600?hl=en
- https://payos.vn/docs/api/

Kiểm chứng tích hợp ngoài hệ thống còn cần thông tin tài khoản/khóa thật. Các test
cục bộ dùng mock, không gửi email, không gọi payOS và không sửa dữ liệu thật.
