import { OAuth2Client } from "google-auth-library";
import { AccountStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { AuthError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { omitPassword } from "../../shared/utils/response.js";
import { authRepository } from "./auth.repository.js";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  hashToken,
  refreshTokenExpiresAt,
  verifyRefreshToken
} from "./auth.security.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

async function createSession(user: { id: string; role: "USER" | "PARTNER" | "ADMIN" }) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt(refreshToken)
  });
  return { accessToken, refreshToken, token: accessToken };
}

function assertActive(status: AccountStatus) {
  if (status !== AccountStatus.ACTIVE) {
    throw new AuthError("Tai khoan dang bi khoa");
  }
}

export const authService = {
  async register(input: { fullName: string; email: string; phone?: string; password: string }) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) throw new ConflictError("Email da duoc su dung", "EMAIL_EXISTS");

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createUser({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: "USER",
      provider: "LOCAL"
    });

    return { user: omitPassword(user), ...(await createSession(user)) };
  },

  async registerPartner(input: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    businessName: string;
    address: string;
    verificationDocumentUrl?: string;
  }) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) throw new ConflictError("Email da duoc su dung", "EMAIL_EXISTS");

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createPartner({
      user: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash
      },
      businessName: input.businessName,
      address: input.address,
      verificationDocumentUrl: input.verificationDocumentUrl
    });

    return { user: omitPassword(user), ...(await createSession(user)) };
  },

  async login(input: { email: string; password: string }) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) throw new AuthError("Email hoac mat khau khong dung");
    assertActive(user.status);
    if (!user.passwordHash) throw new AuthError("Tai khoan nay dang nhap bang Google");

    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) throw new AuthError("Email hoac mat khau khong dung");

    return { user: omitPassword(user), ...(await createSession(user)) };
  },

  async google(input: { credential: string }) {
    if (!env.GOOGLE_CLIENT_ID) throw new ValidationError("GOOGLE_CLIENT_ID chua duoc cau hinh");

    const ticket = await googleClient.verifyIdToken({
      idToken: input.credential,
      audience: env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) throw new AuthError("Google token khong hop le");

    const user = await authRepository.upsertGoogleUser({
      email: payload.email,
      fullName: payload.name ?? payload.email.split("@")[0],
      avatarUrl: payload.picture,
      providerId: payload.sub
    });
    assertActive(user.status);

    return { user: omitPassword(user), ...(await createSession(user)) };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.tokenType !== "refresh") throw new AuthError("Refresh token khong hop le");

    const stored = await authRepository.findRefreshToken(hashToken(refreshToken));
    if (!stored || stored.userId !== payload.sub) throw new AuthError("Refresh token khong hop le");
    assertActive(stored.user.status);

    await authRepository.revokeRefreshToken(hashToken(refreshToken));
    return { user: omitPassword(stored.user), ...(await createSession(stored.user)) };
  },

  async logout(refreshToken?: string) {
    if (refreshToken) await authRepository.revokeRefreshToken(hashToken(refreshToken));
    return { message: "Dang xuat thanh cong" };
  },

  async me(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new NotFoundError("Khong tim thay tai khoan");
    return omitPassword(user);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new NotFoundError("Khong tim thay tai khoan");
    if (!user.passwordHash) throw new AuthError("Tai khoan nay chua co mat khau cuc bo");
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw new AuthError("Mat khau hien tai khong dung");
    await authRepository.updatePassword(userId, await hashPassword(newPassword));
    return { message: "Doi mat khau thanh cong" };
  }
};
