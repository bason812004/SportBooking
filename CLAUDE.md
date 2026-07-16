# CLAUDE.md

> You are the **orchestration layer** for Sports Booking System:
> connect human intent to the existing React/Vite frontend, Express/Prisma backend, Supabase database, and deterministic project scripts.

## Architecture

```txt
docs/*.md                         -> Project intent, API notes, deployment notes
database/*.sql                    -> Database schema, migrations, seed data
backend/src/modules/*             -> Backend domain modules
backend/src/shared/*              -> Shared backend errors, response helpers, utils
frontend/src/pages/*              -> Route-level UI screens
frontend/src/features/*           -> Frontend domain APIs, hooks, schemas
frontend/src/components/*         -> Shared UI components
frontend/src/lib/*                -> Axios, query client, i18n, constants, formatters
You (Claude)                     -> Read context, plan, edit code, run exact scripts
```

Backend flow:

```txt
routes -> controller -> service -> repository -> Prisma -> Supabase PostgreSQL
```

Frontend flow:

```txt
pages/routes -> feature hooks/API -> src/lib/axios.ts -> backend API
```

## Project Structure

```txt
sports-booking-system/
|-- backend/                        # Express + TypeScript + Prisma API
|   |-- prisma/schema.prisma         # Prisma models/enums mapped to Supabase
|   |-- src/
|   |   |-- app.ts                   # Express app, middleware, route mounting
|   |   |-- server.ts                # HTTP/Socket.IO startup
|   |   |-- config/                  # env, db, swagger, storage/cloudinary
|   |   |-- middlewares/             # auth, role, validate, error handling
|   |   |-- modules/                 # auth, courts, bookings, payments, vouchers...
|   |   `-- shared/                  # AppError, response helpers, utilities
|   `-- package.json                 # Backend scripts
|-- frontend/                        # React + Vite + TypeScript app
|   |-- src/
|   |   |-- app/                     # App shell
|   |   |-- components/              # Common/layout UI
|   |   |-- features/                # Domain API/hooks/schemas
|   |   |-- hooks/                   # Cross-feature hooks
|   |   |-- lib/                     # axios, i18n, query client, constants
|   |   |-- locales/                 # vi/en translations
|   |   |-- pages/                   # public/user/partner/recipient/admin pages
|   |   |-- routes/                  # App routes and route guards
|   |   `-- types/                   # Shared frontend types
|   `-- package.json                 # Frontend scripts
|-- database/                        # SQL schema, migrations, seed scripts
|-- docs/                            # Architecture, API, deployment, research notes
`-- README.md                        # Setup and product overview
```

## Commands

```bash
# Backend setup
cd sports-booking-system/backend
npm install
npx prisma generate

# Backend dev server, default port 8080
cd sports-booking-system/backend
npm run dev

# Backend build
cd sports-booking-system/backend
npm run build

# Backend tests
cd sports-booking-system/backend
npm test

# Backend production start
cd sports-booking-system/backend
npm start

# Backend Prisma sync/generate
cd sports-booking-system/backend
npm run prisma:pull
npm run prisma:generate

# Backend migration helper
cd sports-booking-system/backend
npm run db:migrate

# Run one SQL migration
cd sports-booking-system/backend
npx prisma db execute --schema prisma/schema.prisma --file ../database/<migration-file>.sql
npx prisma generate

# Frontend setup
cd sports-booking-system/frontend
npm install

# Frontend dev server, port 5173
cd sports-booking-system/frontend
npm run dev

# Frontend build
cd sports-booking-system/frontend
npm run build

# Frontend preview
cd sports-booking-system/frontend
npm run preview
```

No lint script is currently configured. No frontend test script is currently configured. There is no root `package.json`; run npm only inside `backend/` or `frontend/`.

Deploy:

```bash
# Frontend, root sports-booking-system/frontend, output dist
npm install
npm run build

# Backend, root sports-booking-system/backend
npm install
npx prisma generate
npm run build
npm start
```

## Decision Flow

1. Existing docs or README answer the task? -> Follow them.
2. Existing module pattern exists? -> Match it exactly.
3. Backend change? -> Preserve `routes -> controller -> service -> repository`.
4. Frontend change? -> Use existing `pages`, `features`, `components`, `lib`, `locales` structure.
5. Database change? -> Add/adjust SQL migration and regenerate Prisma when needed.
6. API contract change? -> Update backend validation/types and frontend API/types together.
7. Error or regression? -> Diagnose, fix, run the smallest relevant command, then report result.

## Code Conventions

- TypeScript strict in both frontend and backend.
- Backend is ESM with `moduleResolution: NodeNext`; relative backend imports must include `.js`, even in `.ts` files.
- Backend module naming usually follows `<domain>.routes.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.repository.ts`, `<domain>.validation.ts`, `<domain>.types.ts`.
- Validate backend `body`, `query`, and `params` with Zod schemas plus `validate(...)` middleware.
- Return backend success responses with `sendSuccess(res, data, statusCode?, message?)`.
- Throw `AppError` subclasses (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) and let `errorMiddleware` format the response.
- Controllers must not query Prisma directly; repositories own database access.
- Business rules belong in services or shared utilities, not React components.
- Frontend components/pages use PascalCase; hooks use `useX`; API functions use camelCase.
- Frontend API calls should go through `src/lib/axios.ts`.
- Prefer TanStack Query for server state and React Hook Form + Zod for non-trivial forms.
- Keep translated UI text in `frontend/src/locales/vi` and `frontend/src/locales/en`.
- External imports first, local imports after. Avoid new barrel files unless the folder already uses them.
- Do not edit generated/build output: `dist/`, `node_modules/`, `.next/`, `*.tsbuildinfo`.

## Key Principles

- Check existing docs, modules, and utilities before writing new code.
- Keep backend as the source of truth for booking availability, pricing, vouchers, ownership, payment state, and moderation.
- Keep frontend as an API client; do not trust frontend-calculated final totals.
- Preserve role boundaries for user, partner, recipient, and admin workflows.
- Prefer small, local changes over broad refactors.
- Update tests or add focused tests when changing shared business logic.
- After schema changes, run `npx prisma generate`.
- When something breaks, diagnose the real layer: env, DB schema/data, Prisma client, backend API, frontend client, or UI state.

## Gotchas

- Backend cannot start without `DATABASE_URL`; `JWT_SECRET` must be at least 24 characters.
- Frontend defaults to `http://localhost:8080/api` if `VITE_API_BASE_URL` is missing.
- CORS allows `FRONTEND_URL`, `http://localhost:5173`, and `http://127.0.0.1:5173`.
- Public courts require approved/active court status and active category.
- A visible court may still be unbookable if `court_prices` rows are missing.
- Booking conflict logic is overlap-based: `newStart < existingEnd && newEnd > existingStart`.
- Fresh database order: `database/00_schema_tables.sql`, then optional `database/02_seed_data.sql`.
- Existing database starts with `database/01_existing_db_migrations.sql`; apply later migrations only when missing those changes.
- Realtime requires authenticated Socket.IO connection; connect frontend realtime only after login.
- Uploads use memory storage and cloud storage; do not add local persistent image storage.
- Demand prediction is rule-based by default and may return `INSUFFICIENT_DATA`. An optional trained ML path exists (`sports-booking-system/ml/`, served via FastAPI) and is used only when `ML_SERVICE_URL` is set and a court has >= `ML_MIN_HISTORY` bookings (default 50); it always falls back to the rule-based model on any error. See `docs/RESEARCH_DIRECTION.md` and `ml/README_ML.md`.
- Worktree may already contain unrelated changes; do not revert them.

## Human-in-the-Loop

Require approval or explicit confirmation for:

- Deleting user/business data.
- Running destructive migrations against a real database.
- Changing auth, payment, commission, or booking-pricing rules.
- Rotating secrets or changing production env values.
- Deploying to production or changing deployment settings.

Auto-approve:

- Read-only inspection.
- Formatting documentation.
- Focused code edits that follow existing patterns.
- Local build/test commands.
- Regenerating Prisma client after intentional schema changes.
