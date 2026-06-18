import { api } from "../../../lib/axios";
import type { ApiResponse, User } from "../../../types/api";

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = LoginPayload & { fullName: string; phone?: string };
export type RegisterPartnerPayload = RegisterPayload & { businessName: string; address: string; verificationDocumentUrl?: string };
export type AuthSession = { user: User; token?: string; accessToken: string; refreshToken: string };

export const authApi = {
  async login(payload: LoginPayload) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/login", payload);
    return data.data;
  },
  async register(payload: RegisterPayload) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/register", payload);
    return data.data;
  },
  async registerPartner(payload: RegisterPartnerPayload) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/register-partner", payload);
    return data.data;
  },
  async google(credential: string) {
    const { data } = await api.post<ApiResponse<AuthSession>>("/auth/google", { credential });
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
    const { data } = await api.post<ApiResponse<{ message: string }>>("/auth/logout", { refreshToken });
    return data.data;
  }
};
