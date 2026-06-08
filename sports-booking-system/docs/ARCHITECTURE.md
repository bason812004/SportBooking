# Architecture

Frontend and backend are intentionally separated.

## Frontend

React renders UI, performs basic client validation, stores JWT in local storage for this phase, and calls backend APIs through Axios. TanStack Query caches server responses and avoids unnecessary calls.

## Backend

Express modules follow:

```text
routes -> controller -> service -> repository -> Prisma -> Supabase PostgreSQL
```

Business rules live in services. Controllers do not query database directly.

## Database

Supabase PostgreSQL is the source of truth. The SQL script creates enum types, constraints, indexes, triggers and seed data. Prisma schema maps to the same tables and columns.

## Security

- Passwords hashed by bcrypt.
- JWT secret from env.
- Role checks in backend middleware.
- Partner ownership checked in partner service.
- Public court listing only returns approved active courts.
- Uploads use memory storage and Supabase Storage; no local image persistence.
