import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthError } from "../shared/errors/AppError.js";
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";

type JwtPayload = {
  sub: string;
  role: UserRole;
};

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new AuthError());
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new AuthError("Token khong hop le hoac da het han"));
  }
}
