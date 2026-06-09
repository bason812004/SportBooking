# I18n Upgrade Audit

## Implemented

- Added `react-i18next`, `i18next`, and `i18next-browser-languagedetector`.
- Added locale namespaces for `vi` and `en`:
  - `common.json`
  - `homepage.json`
  - `courts.json`
  - `booking.json`
  - `partner.json`
  - `admin.json`
  - `footer.json`
  - `header.json`
- Reworked `src/lib/i18n.tsx` to initialize i18next with browser language detection and localStorage persistence.
- Kept the existing `useLanguage()` adapter so legacy pages continue to work while new pages use i18next keys.
- Added `LanguageSwitcher` for Header, Mobile Menu, Footer, and Dashboard.
- Rebuilt Public Header as a SaaS-style header with:
  - Announcement bar
  - Main navigation
  - Explore Courts mega menu
  - Global search
  - Notification center
  - User menu
  - Quick action buttons
  - Mobile hamburger menu
- Rebuilt Footer as an enterprise footer with:
  - Brand section
  - Explore, player, partner, support, legal links
  - Contact details
  - Social media
  - App buttons
  - Newsletter
  - Platform statistics
  - Footer bottom legal copy
- Migrated high-impact public conversion components to i18n keys:
  - `SearchHeader`
  - `StickyBookingBar`
  - `StickyBookingPanel`
  - `ReviewSection`

## Verification

- Frontend build passed with `npm run build`.
- Vite still reports large chunk warnings. This is a performance/code-splitting warning, not a build failure.

## Remaining Hard-Code Migration

The project still contains hard-coded text in many page-specific sections, especially the large redesigned Homepage, Search/List Page, and Court Detail Page component data files. These should be migrated namespace-by-namespace next:

- `src/pages/public/home/*`
- `src/pages/public/search/*`
- `src/pages/public/detail/*`
- `src/pages/auth/*`
- `src/pages/user/*`
- `src/pages/partner/*`
- `src/pages/admin/*`

Recommended next step: migrate one domain at a time into the existing namespace files instead of adding more legacy dictionary entries.
