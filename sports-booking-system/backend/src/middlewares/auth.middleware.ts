import { AuthError } from "../shared/errors/AppError.js";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../modules/auth/auth.security.js";

type JwtPayload = {
  sub: string;
  role: UserRole;
};

/**
 * Strict auth middleware — requires a valid, non-expired token.
 * Throws AuthError if missing or invalid.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new AuthError());
  }

  try {
    const payload = verifyAccessToken(token) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new AuthError("Token khong hop le hoac da het han"));
  }
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
