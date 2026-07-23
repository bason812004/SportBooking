import { PrismaClient } from "@prisma/client";

// Prisma 6 accepts connection pool tuning only through the DATABASE_URL
// query parameters (`?connection_limit=&pool_timeout=&pgbouncer=true`).
// When a different value is required per environment we can override the
// URL here. Keep this file lean so misconfiguration in another module
// can't break the singleton.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});
