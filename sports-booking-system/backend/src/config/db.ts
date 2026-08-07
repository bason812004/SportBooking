import { PrismaClient } from "@prisma/client";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || "";
  if (!url) return url;
  if (!url.includes("connection_limit=")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}connection_limit=25&pool_timeout=30`;
  }
  return url;
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});
