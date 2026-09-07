import { NativeModules, Platform } from "react-native";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import type { ApiResponse, User } from "./types";

type SessionRefreshed = (session: { accessToken: string; refreshToken: string; user?: User }) => void;
type Unauthorized = () => void;

function extractHostIp(candidate?: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  const ipMatch = candidate.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  if (ipMatch && ipMatch[0] !== "127.0.0.1") {
    return ipMatch[0];
  }
  return null;
}

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // 1. Web browser fallback FIRST (to prevent cross-origin/IP mismatches on web)
  if (Platform.OS === "web" && typeof window !== "undefined" && (window as any).location?.hostname) {
    const host = (window as any).location.hostname;
    return `http://${host}:8080/api`;
  }

  // 2. Android emulator fallback (Android emulator CANNOT use PC's Wi-Fi IP directly; it must connect to 10.0.2.2)
  if (Platform.OS === "android" && !Constants.isDevice) {
    return "http://10.0.2.2:8080/api";
  }

  // 3. If explicit tunnel or remote HTTPS URL provided (e.g. localtunnel / ngrok)
  if (envUrl && envUrl.startsWith("https://")) {
    return envUrl;
  }

  // 4. In dev mode on physical device, dynamically detect the host IP running Metro packager
  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
    (NativeModules as any).SourceCode?.scriptURL,
    Constants.linkingUri,
    (Constants as any).experienceUrl
  ];

  for (const candidate of hostCandidates) {
    const detectedIp = extractHostIp(candidate);
    if (detectedIp) {
      return `http://${detectedIp}:8080/api`;
    }
  }

  // 4. If explicit valid non-localhost envUrl provided
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  return envUrl ?? "http://localhost:8080/api";
}

export const API_BASE_URL = resolveApiBaseUrl();

let customBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  return customBaseUrl ?? API_BASE_URL;
}

export function setApiBaseUrl(url: string) {
  customBaseUrl = url.trim().replace(/\/+$/, "");
  api.defaults.baseURL = customBaseUrl;
  if (__DEV__) {
    console.log(`[Mobile API] Base URL switched to: ${customBaseUrl}`);
  }
}

if (__DEV__) {
  console.log(`[Mobile API] Base URL initialized to: ${API_BASE_URL} (Platform: ${Platform.OS}, isDevice: ${Constants.isDevice})`);
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onSessionRefreshed: SessionRefreshed | null = null;
let onUnauthorized: Unauthorized | null = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000 // 25s timeout to allow cold-start and concurrent Supabase queries
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
  if (customBaseUrl) {
    config.baseURL = customBaseUrl;
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // Bypass localtunnel interstitial reminder page if localtunnel is used
  config.headers["Bypass-Tunnel-Reminder"] = "true";
  if (__DEV__) {
    console.log(`[Mobile API Req] ${config.method?.toUpperCase()} ${config.baseURL ?? API_BASE_URL}${config.url}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    if (__DEV__) {
      console.warn(`[Mobile API Err] ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${error.code ?? ""} - ${error.message}`);
    }

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

    const targetUrl = `${error.config?.baseURL ?? ""}${error.config?.url ?? ""}`;
    const isTimeout = error.code === "ECONNABORTED" || error.message?.toLowerCase().includes("timeout");
    const message = error.response?.data?.message ?? (isTimeout ? `Kết nối quá thời gian chờ (Timeout) tới: ${targetUrl}` : `Không thể kết nối máy chủ (${targetUrl})`);
    return Promise.reject(new Error(message));
  }
);

export function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined && value !== null));
}
