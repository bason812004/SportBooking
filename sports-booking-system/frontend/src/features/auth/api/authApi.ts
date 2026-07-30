import { api } from "../../../lib/axios";
import type { ApiResponse, User } from "../../../types/api";

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = LoginPayload & { fullName: string; phone?: string };
export type RegisterPartnerPayload = RegisterPayload & { businessName: string; address: string; verificationDocumentUrl?: string };
export type AuthSession = { user: User; token?: string; accessToken: string; refreshToken: string };
export type RegistrationComplete = { user: User };
export type RegistrationCodeResult = { email: string; expiresInSeconds: number; verificationPending?: boolean };

export const authApi = {
  async login(payload: LoginPayload) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/login", payload);
    return data.data;
  },
  async register(payload: RegisterPayload) {
    const { data } = await api.post<ApiResponse<RegistrationCodeResult>>("/auth/register/request-code", payload);
    return data.data;
  },
  async verifyRegistrationCode(payload: { email: string; code: string }) {
    const { data } = await api.post<ApiResponse<RegistrationComplete>>("/auth/register/verify-code", payload);
    return data.data;
  },
  async resendRegistrationCode(email: string) {
    const { data } = await api.post<ApiResponse<RegistrationCodeResult>>("/auth/register/resend-code", { email });
    return data.data;
  },
  async registerPartner(payload: RegisterPartnerPayload) {
    const { data } = await api.post<ApiResponse<RegistrationCodeResult>>("/auth/register-partner/request-code", payload);
    return data.data;
  },
  async verifyPartnerRegistrationCode(payload: { email: string; code: string }) {
    const { data } = await api.post<ApiResponse<RegistrationComplete>>("/auth/register-partner/verify-code", payload);
    return data.data;
  },
  async resendPartnerRegistrationCode(email: string) {
    const { data } = await api.post<ApiResponse<RegistrationCodeResult>>("/auth/register-partner/resend-code", { email });
    return data.data;
  },
  async google(credential: string, accountType: "USER" | "PARTNER" = "USER") {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/google", { credential, accountType });
    return data.data;
  },
  async refreshToken(refreshToken: string) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/refresh-token", { refreshToken });
    return data.data;
  },
  async me() {
    const { data } = await api.get<ApiResponse<User>>("/auth/me");
    return data.data;
  },
  async logout(refreshToken?: string | null) {
    // Fire-and-forget: backend is idempotent and the token may be expired.
    // State is cleared immediately below — no await.
    void api.post<ApiResponse<{ message: string }>>("/auth/logout", { refreshToken });
    return { message: "Dang xuat thanh cong" };
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const { data } = await api.put<ApiResponse<{ message: string }>>("/auth/change-password", payload);
    return data.data;
  }
};
