import { PrismaClient } from "@prisma/client";

function getDatabaseUrl() {
  let url = process.env.DATABASE_URL || process.env.DIRECT_URL || "";
  if (!url) return url;

  if (url.includes("connection_limit=")) {
    url = url.replace(/connection_limit=\d+/, "connection_limit=30");
  } else {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connection_limit=30`;
  }

  if (url.includes("pool_timeout=")) {
    url = url.replace(/pool_timeout=\d+/, "pool_timeout=30");
  } else {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}pool_timeout=30`;
  }

  if (!url.includes("sslmode=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}sslmode=require`;
  }

  if (!url.includes("connect_timeout=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connect_timeout=30`;
  }

  return url;
}

const debugSql = process.env.DEBUG_SQL === "1";

export const prisma = new PrismaClient({
  log: debugSql
    ? [{ emit: "event", level: "query" }, { emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
    : ["error"],
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
