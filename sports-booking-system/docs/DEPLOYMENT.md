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

## Supabase

- Run `database/supabase_schema.sql` in SQL Editor.
- Create Storage bucket named `court-images`.
- For public image URLs, configure bucket public policy or use signed URLs in a future hardening pass.
