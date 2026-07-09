import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { ApiResponse, User } from "./types";

type SessionRefreshed = (session: { accessToken: string; refreshToken: string; user?: User }) => void;
type Unauthorized = () => void;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/api";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onSessionRefreshed: SessionRefreshed | null = null;
let onUnauthorized: Unauthorized | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

export function setClientTokens(tokens: { accessToken?: string | null; refreshToken?: string | null }) {
  accessToken = tokens.accessToken ?? null;
  refreshToken = tokens.refreshToken ?? null;
}

export function configureClientAuth(handlers: { onSessionRefreshed: SessionRefreshed; onUnauthorized: Unauthorized }) {
  onSessionRefreshed = handlers.onSessionRefreshed;
  onUnauthorized = handlers.onUnauthorized;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as (InternalAxiosRequestConfig & { __isRetryRequest?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original.__isRetryRequest && refreshToken) {
      refreshPromise ??= api
        .post<ApiResponse<{ accessToken?: string; token?: string; refreshToken: string; user?: User }>>("/auth/refresh-token", { refreshToken })
        .then((response) => {
          const session = response.data.data;
          const nextAccessToken = session.accessToken ?? session.token;
          if (!nextAccessToken) return null;
          accessToken = nextAccessToken;
          refreshToken = session.refreshToken;
          onSessionRefreshed?.({ accessToken: nextAccessToken, refreshToken: session.refreshToken, user: session.user });
          return nextAccessToken;
        })
        .catch(() => null)
        .finally(() => {
          refreshPromise = null;
        });

      const nextToken = await refreshPromise;
      if (nextToken) {
        original.__isRetryRequest = true;
        original.headers.Authorization = `Bearer ${nextToken}`;
        return api(original);
      }
    }

    if (error.response?.status === 401) {
      onUnauthorized?.();
    }

    const message = error.response?.data?.message ?? "Khong the ket noi may chu";
    return Promise.reject(new Error(message));
  }
);

export function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined && value !== null));
}

