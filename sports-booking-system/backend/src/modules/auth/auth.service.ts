import { OAuth2Client } from "google-auth-library";
import type { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError, AuthError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { omitPassword } from "../../shared/utils/response.js";
import { emailService } from "../email/email.service.js";
import { authRepository } from "./auth.repository.js";
import { forgetAccountStatus } from "./accountStatus.js";
import { clearPasswordFailures, MAX_PASSWORD_FAILURES, passwordRetryAfter, recordPasswordFailure } from "./passwordAttempts.js";
import { realtimeService } from "../realtime/realtime.service.js";
import {
  comparePassword,
  compareOtp,
  generateAccessToken,
  generateOtp,
  generateRefreshToken,
  hashOtp,
  hashPassword,
  hashToken,
  refreshTokenExpiresAt,
  verifyRefreshToken
} from "./auth.security.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const OTP_EXPIRES_IN_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS = 5;
const FIXED_DEMO_ACCOUNTS = new Set([
  "admin@sportsbooking.com",
  "partner1@sportsbooking.com",
  "partner2@sportsbooking.com",
  "user1@sportsbooking.com"
]);

function activePendingResult(pending: {
  verifiedAt: Date | null;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
}) {
  if (pending.verifiedAt || pending.expiresAt.getTime() <= Date.now() || pending.attemptCount >= pending.maxAttempts) {
    return null;
  }
  return Math.max(1, Math.ceil((pending.expiresAt.getTime() - Date.now()) / 1000));
}

async function createSession(user: { id: string; role: "USER" | "PARTNER" | "ADMIN" | "RECIPIENT" }) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt(refreshToken)
  });
  return { accessToken, refreshToken, token: accessToken };
}

function assertActive(status: string) {
  if (status !== "ACTIVE") {
    throw new AuthError("Tai khoan dang bi khoa");
  }
}

function assertCanResend(lastSentAt: Date, resendCount: number) {
  if (resendCount >= MAX_RESENDS) {
    throw new AppError(429, "OTP_RESEND_LIMIT", "Bạn đã gửi lại mã quá số lần cho phép.");
  }
  const elapsedSeconds = Math.floor((Date.now() - lastSentAt.getTime()) / 1000);
  if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
    throw new AppError(
      429,
      "OTP_RESEND_COOLDOWN",
      `Vui lòng chờ ${RESEND_COOLDOWN_SECONDS - elapsedSeconds} giây trước khi gửi lại mã.`
    );
  }
}

async function createAndSendRegistrationCode(input: {
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  resendCount: number;
  accountType?: "USER" | "PARTNER";
  businessName?: string;
  address?: string;
  verificationDocumentUrl?: string;
}) {
  const code = generateOtp();
  const verification = await authRepository.saveRegistrationVerification({
    ...input,
    otpHash: await hashOtp(code),
    expiresAt: new Date(Date.now() + OTP_EXPIRES_IN_SECONDS * 1000)
  });
  try {
    await emailService.sendRegistrationOtp({
      to: input.email,
      fullName: input.fullName,
      code,
      expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60
    });
  } catch (error) {
    await authRepository.deleteRegistrationVerification(verification.id);
    throw error;
  }
}

export const authService = {
  async requestRegistrationCode(input: { fullName: string; email: string; phone?: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const existing = await authRepository.findByEmail(email);
    if (existing?.emailVerified) throw new ConflictError("Email đã được sử dụng", "EMAIL_EXISTS");
    if (existing && existing.role !== "USER") throw new ConflictError("Email đã được sử dụng", "EMAIL_EXISTS");

    const pending = await authRepository.findRegistrationVerification(email);
    const isExpired = pending ? pending.expiresAt.getTime() <= Date.now() : true;

    if (pending && !pending.verifiedAt && !isExpired) {
      assertCanResend(pending.lastSentAt, pending.resendCount);
    }

    const passwordHash = await hashPassword(input.password);
    await createAndSendRegistrationCode({
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || undefined,
      passwordHash,
      resendCount: pending && !isExpired ? pending.resendCount + 1 : 0,
      accountType: "USER"
    });

    return { email, expiresInSeconds: OTP_EXPIRES_IN_SECONDS };
  },

  async verifyRegistrationCode(input: { email: string; code: string }) {
    const email = input.email.trim().toLowerCase();
    if (await authRepository.findByEmail(email)) {
      throw new ConflictError("Email đã được sử dụng", "EMAIL_EXISTS");
    }
    const verification = await authRepository.findRegistrationVerification(email);
    if (!verification) throw new NotFoundError("Không tìm thấy yêu cầu xác thực đăng ký");
    if (verification.verifiedAt) throw new ConflictError("Mã xác thực đã được sử dụng", "OTP_ALREADY_USED");
    if (verification.expiresAt.getTime() <= Date.now()) {
      throw new AppError(400, "OTP_EXPIRED", "Mã xác thực đã hết hạn. Vui lòng nhấn gửi lại mã.");
    }
    if (verification.attemptCount >= verification.maxAttempts) {
      throw new AppError(429, "OTP_MAX_ATTEMPTS", "Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã.");
    }
    if (!(await compareOtp(input.code, verification.otpHash))) {
      await authRepository.incrementVerificationAttempt(verification.id);
      throw new AppError(400, "OTP_INVALID", "Mã xác thực không hợp lệ.");
    }

    const user = await authRepository.createUserFromVerification(verification.id);
    if (!user) throw new ConflictError("Mã xác thực không còn hiệu lực", "OTP_NOT_ACTIVE");

    return { user: omitPassword(user) };
  },

  async resendRegistrationCode(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    if (await authRepository.findByEmail(email)) {
      throw new ConflictError("Email đã được sử dụng", "EMAIL_EXISTS");
    }
    const pending = await authRepository.findRegistrationVerification(email);
    if (!pending || pending.verifiedAt) throw new NotFoundError("Không có yêu cầu xác thực đang chờ cho email này");

    const isExpired = pending.expiresAt.getTime() <= Date.now();
    if (isExpired) {
      await createAndSendRegistrationCode({
        fullName: pending.fullName,
        email,
        phone: pending.phone ?? undefined,
        passwordHash: pending.passwordHash,
        resendCount: 0,
        accountType: pending.accountType,
        businessName: pending.businessName ?? undefined,
        address: pending.address ?? undefined,
        verificationDocumentUrl: pending.verificationDocumentUrl ?? undefined
      });
      return { email, expiresInSeconds: OTP_EXPIRES_IN_SECONDS };
    }

    assertCanResend(pending.lastSentAt, pending.resendCount);

    await createAndSendRegistrationCode({
      fullName: pending.fullName,
      email,
      phone: pending.phone ?? undefined,
      passwordHash: pending.passwordHash,
      resendCount: pending.resendCount + 1,
      accountType: pending.accountType,
      businessName: pending.businessName ?? undefined,
      address: pending.address ?? undefined,
      verificationDocumentUrl: pending.verificationDocumentUrl ?? undefined
    });
    return { email, expiresInSeconds: OTP_EXPIRES_IN_SECONDS };
  },

  async requestPartnerRegistrationCode(input: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    businessName: string;
    address: string;
    verificationDocumentUrl?: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await authRepository.findByEmail(email);
    if (existing?.emailVerified) throw new ConflictError("Email đã được sử dụng", "EMAIL_EXISTS");
    if (existing && existing.role !== "PARTNER") throw new ConflictError("Email đã được sử dụng", "EMAIL_EXISTS");

    const pending = await authRepository.findRegistrationVerification(email);
    const isExpired = pending ? pending.expiresAt.getTime() <= Date.now() : true;

    if (pending && !pending.verifiedAt && !isExpired) {
      assertCanResend(pending.lastSentAt, pending.resendCount);
    }

    const passwordHash = await hashPassword(input.password);
    await createAndSendRegistrationCode({
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || undefined,
      passwordHash,
      resendCount: pending && !isExpired ? pending.resendCount + 1 : 0,
      accountType: "PARTNER",
      businessName: input.businessName.trim(),
      address: input.address.trim(),
      verificationDocumentUrl: input.verificationDocumentUrl
    });
    return { email, expiresInSeconds: OTP_EXPIRES_IN_SECONDS };
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

  async google(input: { credential: string; accountType?: "USER" | "PARTNER" }) {
    if (!env.GOOGLE_CLIENT_ID) throw new ValidationError("GOOGLE_CLIENT_ID chua duoc cau hinh");

    const ticket = await googleClient.verifyIdToken({
      idToken: input.credential,
      audience: env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) throw new AuthError("Google token khong hop le");
    if (!payload.email_verified) throw new AuthError("Email Google chưa được xác thực");

    const email = payload.email.trim().toLowerCase();
    const existing = await authRepository.findByEmail(email);
    if (input.accountType === "PARTNER" && !existing) {
      throw new AuthError("Chưa có tài khoản đối tác với email này. Vui lòng đăng ký đối tác trước.");
    }
    if (input.accountType === "PARTNER" && existing?.role !== "PARTNER") {
      throw new AuthError("Email này không thuộc tài khoản đối tác.");
    }
    if (input.accountType !== "PARTNER" && existing?.role === "PARTNER") {
      throw new AuthError("Vui lòng đăng nhập tại cổng dành cho đối tác.");
    }
    const user = await authRepository.upsertGoogleUser({
      email,
      fullName: payload.name ?? payload.email.split("@")[0],
      avatarUrl: payload.picture,
      providerId: payload.sub,
      existingUserId: existing?.id
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

  /**
   * The signed-in account's current password, asked before a sensitive change (a new password, the bank account
   * withdrawals go to). A wrong answer is a 400, not a 401: the session itself is fine, and a 401 would make the
   * browser refresh it. After 5 wrong answers in 15 minutes the account has to wait.
   */
  async verifyCurrentPassword(userId: string, password: string | undefined) {
    const wait = passwordRetryAfter(userId);
    if (wait > 0) {
      throw new ValidationError(`Bạn đã nhập sai mật khẩu ${MAX_PASSWORD_FAILURES} lần. Hãy thử lại sau ${Math.ceil(wait / 60_000)} phút.`);
    }
    if (!password) throw new ValidationError("Nhập mật khẩu hiện tại");
    const user = await authRepository.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy tài khoản");
    if (!user.passwordHash) {
      throw new ValidationError("Tài khoản chưa có mật khẩu đăng nhập (đăng nhập bằng Google); hãy đặt mật khẩu bằng chức năng Quên mật khẩu trước");
    }
    if (!(await comparePassword(password, user.passwordHash))) {
      const left = recordPasswordFailure(userId);
      throw new ValidationError(
        left > 0
          ? `Mật khẩu hiện tại không đúng (còn ${left} lần thử)`
          : `Mật khẩu hiện tại không đúng. Bạn đã nhập sai ${MAX_PASSWORD_FAILURES} lần, hãy thử lại sau 15 phút.`
      );
    }
    clearPasswordFailures(userId);
    return { ...user, passwordHash: user.passwordHash };
  },

  /**
   * A new password signs every other device out (their refresh tokens are revoked and older access tokens refused);
   * this device gets a fresh session in the answer. The owner is emailed in case it was not them.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const account = await authRepository.findById(userId);
    if (!account) throw new NotFoundError("Không tìm thấy tài khoản");
    if (FIXED_DEMO_ACCOUNTS.has(account.email.trim().toLowerCase())) {
      throw new ValidationError("Tài khoản mẫu luôn sử dụng mật khẩu mặc định 123456.");
    }
    const user = await this.verifyCurrentPassword(userId, currentPassword);
    if (await comparePassword(newPassword, user.passwordHash)) throw new ValidationError("Mật khẩu mới phải khác mật khẩu hiện tại");

    await authRepository.updatePassword(userId, await hashPassword(newPassword));
    await authRepository.revokeAllSessions(userId);
    forgetAccountStatus(userId);
    realtimeService.disconnectUser(userId);
    const session = await createSession(user as { id: string; role: UserRole });

    try {
      await emailService.sendPasswordChanged({ to: user.email, fullName: user.fullName, changedAt: new Date() });
    } catch (error) {
      // Email may not be configured; the password change itself stands.
      console.error("[Auth] Password change email failed:", error);
    }
    return { message: "Đổi mật khẩu thành công", user: omitPassword(user), ...session };
  }
};
