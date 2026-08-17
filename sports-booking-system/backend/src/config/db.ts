import { PrismaClient } from "@prisma/client";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || "";
  if (!url) return url;
  if (!url.includes("connection_limit=")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}connection_limit=15&pool_timeout=30`;
  }
  return url;
}

const debugSql = process.env.DEBUG_SQL === "1";

export const prisma = new PrismaClient({
  log: debugSql
    ? [{ emit: "event", level: "query" }, { emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
    : process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});

if (debugSql) {
  (prisma as any).$on("query", (e: { query: string; params: string; duration: number }) => {
    console.log(`[QUERY] ${e.duration}ms ${e.query} -- params=${e.params}`);
  });
}
