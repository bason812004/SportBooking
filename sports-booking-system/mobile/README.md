# SportBooking Mobile Application

Production-ready, feature-complete mobile application built with **React Native**, **Expo Router**, **TypeScript**, **TanStack Query**, **Axios**, **SecureStore**, **Zustand**, and **i18n** for **Users** and **Partners**.

---

## 📱 Features

### 👤 Customer App (User)
- **Authentication**: JWT Auth via `expo-secure-store`, Login, Registration with 6-digit Email Verification OTP, Google OAuth integration, role-gated access.
- **Home & Discovery**: Dynamic location permission & distance calculation (`expo-location`), debounced search, multi-sport filters (Pickleball, Tennis, Badminton, Football, Basketball, Volleyball).
- **Court Detail**: Cover image gallery, pricing details, amenities, reviews, sticky CTA button.
- **Mobile Calendar & Booking**: Multi-date & multi-week slot selection persisted in global `useBookingStore` (switching weeks/dates never resets selected slots), real-time slot statuses (`AVAILABLE`, `SELECTED`, `BOOKED`, `BLOCKED`, `MAINTENANCE`, `PASSED`), dynamic pricing breakdown, demand prediction snapshot, voucher auto-apply & batch claim.
- **QR Payment**: Bank QR payment display, live countdown timer, realtime payment status polling.
- **Booking History**: Filter by All, Pending, Paid, Completed, Cancelled.
- **Community & Realtime Chat**: Teammates recruitment, join team, realtime group chat with text/image/video attachments, optimistic UI, reactions, and admin group controls.
- **Tournaments & Blogs**: Tournament registrations and blog reader with comments.

### 🏢 Partner App (Court Owner)
- **Partner Dashboard**: Total revenue, total bookings, occupancy rate, peak hours analytics.
- **Court Management**: List partner courts, create court, edit pricing, upload image gallery.
- **Booking Management**: Timeline calendar of court reservations, confirm/cancel bookings.
- **Voucher Management**: Create and publish court vouchers.

---

## 🏗️ Architecture

```
mobile/
├── app/                        # Expo Router Pages & Navigation
│   ├── _layout.tsx             # Root layout, Providers & Theme
│   ├── index.tsx               # Auth & Role Redirection
│   ├── (auth)/                 # Login, Register, Verify Email, Forgot Password
│   ├── (tabs)/                 # Customer 5-Tab Navigation (Home, Courts, Teammates, Vouchers, Profile)
│   ├── booking/                # Booking Calendar & Checkout Screen
│   ├── bookings/               # Customer Booking History & Detail
│   ├── payment/                # QR Code Payment Screen & Countdown
│   ├── partner/                # Partner Dashboard & Court Management Stack
│   └── teammates/              # Community Recruitment & Chat
├── src/
│   ├── api/                    # Axios API Clients & Query Keys
│   ├── components/             # Reusable Design System Tokens & Components
│   ├── i18n/                   # VI / EN Translation Dictionaries & Store
│   ├── store/                  # Zustand Global Stores (Auth, Booking, Language)
│   ├── services/               # Token Storage, Realtime, Push Notifications
│   └── utils/                  # Currency & Date Formatters
```

---

## 🚀 Quick Start

### 1. Requirements
- Node.js 18+
- Expo CLI (`npx expo`)
- Working backend running at `http://localhost:5000/api` (or LAN IP)

### 2. Setup Environment
```bash
cd mobile
cp .env.example .env
```

Configure `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```
*(For Android emulator, use `http://10.0.2.2:5000/api`. For physical device, use `http://<your-lan-ip>:5000/api`)*

### 3. Start Expo Development Server
```bash
npm start
```

### 4. Build Development Client / Android APK
```bash
npm run android:dev
```
or via EAS:
```bash
npx eas-cli build -p android --profile preview
```

---

## 🔗 Deep Link Schemes

Deep link scheme: `sportbooking://`

Supported routes:
- `sportbooking://court/{id}`
- `sportbooking://booking/{id}`
- `sportbooking://payment/{bookingId}`
- `sportbooking://team/{id}`
- `sportbooking://tournament/{slug}`

---

## 🌐 Internationalization (i18n)

Supported languages: **Vietnamese (VI)** and **English (EN)**.
Switching language in-app updates all screens instantly via `useLanguageStore`.
