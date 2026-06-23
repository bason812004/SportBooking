import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, message = "Success") {
  return res.status(statusCode).json({ success: true, message, data });
}

export function omitPassword<T extends { passwordHash?: string | null }>(record: T) {
  const { passwordHash, ...rest } = record;
  void passwordHash;
  return rest;
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}
