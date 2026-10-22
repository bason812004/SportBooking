import { api } from "./client";
import type { ApiResponse, User } from "./types";

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = LoginPayload & { fullName: string; phone?: string };
export type AuthSession = { user: User; token?: string; accessToken: string; refreshToken: string };
export type RegistrationCodeResult = { email: string; expiresInSeconds: number; verificationPending?: boolean };

export const authApi = {
  async login(payload: LoginPayload) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/login", payload);
    return data.data;
  },
  async requestRegistrationCode(payload: RegisterPayload) {
    const { data } = await api.post<ApiResponse<RegistrationCodeResult>>("/auth/register/request-code", payload);
    return data.data;
  },
  async verifyRegistrationCode(payload: { email: string; code: string }) {
    const { data } = await api.post<ApiResponse<{ user: User }>>("/auth/register/verify-code", payload);
    return data.data;
  },
  async resendRegistrationCode(email: string) {
    const { data } = await api.post<ApiResponse<RegistrationCodeResult>>("/auth/register/resend-code", { email });
    return data.data;
  },
  async me() {
    const { data } = await api.get<ApiResponse<User>>("/auth/me");
    return data.data;
  },
  async logout(refreshToken?: string | null) {
    const { data } = await api.post<ApiResponse<{ message: string }>>("/auth/logout", { refreshToken });
    return data.data;
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const { data } = await api.put<ApiResponse<{ message: string }>>("/auth/change-password", payload);
    return data.data;
  },
  async googleLogin(idToken: string) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/google", { idToken });
    return data.data;
  }
};

