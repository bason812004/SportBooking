import { AuthError } from "../shared/errors/AppError.js";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { sessionRefusal } from "../modules/auth/accountStatus.js";
import { verifyAccessToken } from "../modules/auth/auth.security.js";

type JwtPayload = {
  sub: string;
  role: UserRole;
  iat?: number;
};

/**
 * Strict auth middleware — requires a valid, non-expired token of an account that is still active.
 * Throws AuthError if missing or invalid, once the account is locked, or when its sessions were revoked after the token was issued.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new AuthError());
  }

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token) as JwtPayload;
  } catch {
    return next(new AuthError("Token khong hop le hoac da het han"));
  }

  try {
    const refusal = await sessionRefusal(payload.sub, payload.iat);
    if (refusal === "LOCKED") return next(new AuthError("Tai khoan dang bi khoa"));
    if (refusal === "REVOKED") return next(new AuthError("Phien dang nhap da het hieu luc, vui long dang nhap lai"));
  } catch (error) {
    return next(error);
  }
  req.user = { id: payload.sub, role: payload.role };
  return next();
}

/**
 * Optional auth middleware — attaches user if a valid token is present,
 * but succeeds even when no token or an expired token is provided.
 * Use this for logout and other operations that should work regardless
 * of token validity.
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(); // No token — proceed without user
  }

  try {
    const payload = verifyAccessToken(token) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // Expired or invalid token — proceed anyway (e.g. logout should succeed)
  }

  return next();
}
