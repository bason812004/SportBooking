import axios from "axios";
import { REFRESH_TOKEN_KEY, TOKEN_KEY, USER_KEY } from "./constants";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !(original as { __isRetryRequest?: boolean }).__isRetryRequest) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        refreshPromise ??= api
          .post("/auth/refresh-token", { refreshToken })
          .then((response) => {
            const session = response.data?.data;
            const accessToken = session?.accessToken ?? session?.token;
            if (!accessToken) return null;
            localStorage.setItem(TOKEN_KEY, accessToken);
            if (session?.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
            if (session?.user) localStorage.setItem(USER_KEY, JSON.stringify(session.user));
            return accessToken as string;
          })
          .catch(() => null)
          .finally(() => {
            refreshPromise = null;
          });
        const accessToken = await refreshPromise;
        if (accessToken) {
          (original as { __isRetryRequest?: boolean }).__isRetryRequest = true;
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        }
      }
    }

    const message = error.response?.data?.message ?? error.response?.data?.error?.message ?? "Khong the ket noi may chu";
    const rejected = new Error(message) as Error & { code?: string };
    rejected.code = error.response?.data?.error?.code ?? error.response?.data?.code;
    return Promise.reject(rejected);
  }
);
