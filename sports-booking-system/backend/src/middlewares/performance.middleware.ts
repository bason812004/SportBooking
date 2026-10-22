import type { Request, Response, NextFunction } from "express";

const SLOW_THRESHOLD_MS = 500;
const VERY_SLOW_THRESHOLD_MS = 1000;
const debugSql = process.env.DEBUG_SQL === "1";

function getPath(req: Request) {
  return (req.baseUrl || "") + req.path;
}

function shouldLog(method: string, url: string) {
  if (method === "GET" && url.startsWith("/api/docs")) return false;
  return true;
}

export function performanceLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    if (!shouldLog(req.method, req.originalUrl)) return;
    const path = getPath(req);
    const elapsedMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    if (elapsedMs >= VERY_SLOW_THRESHOLD_MS) {
      console.warn(
        `[PERF] ${req.method} ${req.originalUrl} -> ${res.statusCode} took ${elapsedMs}ms`,
        `\n  path=${path}`
      );
    } else if (elapsedMs >= SLOW_THRESHOLD_MS) {
      console.warn(
        `[SLOW] ${req.method} ${req.originalUrl} -> ${res.statusCode} took ${elapsedMs}ms`
      );
    } else if (debugSql) {
      console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} took ${elapsedMs}ms`);
    }
  });
  next();
}
