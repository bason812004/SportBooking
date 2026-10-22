import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";

type TokenUser = { id: string; role: UserRole };

const accessSecret = env.JWT_ACCESS_SECRET ?? env.JWT_SECRET;
const refreshSecret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET;

export function hashPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(code: string) {
  return bcrypt.hash(code, env.BCRYPT_SALT_ROUNDS);
}

export function compareOtp(code: string, otpHash: string) {
  return bcrypt.compare(code, otpHash);
}

export function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function generateAccessToken(user: TokenUser) {
  return jwt.sign({ role: user.role }, accessSecret, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as any
  });
}

export function generateRefreshToken(user: TokenUser) {
  return jwt.sign({ role: user.role, tokenType: "refresh" }, refreshSecret, {
    subject: user.id,
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret) as { sub: string; role: UserRole };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, refreshSecret) as { sub: string; role: UserRole; tokenType?: string; exp?: number };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt(refreshToken: string) {
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
