# Deployment

## Frontend on Vercel

- Root directory: `frontend`
- Install: `npm install`
- Build: `npm run build`
- Output directory: `dist`
- Env: `VITE_API_BASE_URL=https://your-backend-domain/api`

## Backend on Render or Railway

- Root directory: `backend`
- Build: `npm install && npx prisma generate && npm run build`
- Start: `npm start`
- Env: copy from `.env.example` and fill real values.
- Partner withdrawals are paid by hand: an admin approves the request, transfers the money from the
  platform's bank account and clicks "Đã chuyển khoản". Leave `PAYOUT_PROVIDER` unset (or `manual`)
  and `WITHDRAWAL_AUTO_APPROVE_LIMIT` unset (0 = every request waits for an admin).
  `PAYOUT_PROVIDER=fake` is a development simulator that marks transfers as done without moving money;
  the backend refuses to start with it when `NODE_ENV=production`.

## Supabase

- Run `database/supabase_schema.sql` in SQL Editor.
- Create Storage bucket named `court-images`.
- For public image URLs, configure bucket public policy or use signed URLs in a future hardening pass.
