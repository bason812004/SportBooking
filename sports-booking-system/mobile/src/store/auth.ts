import { create } from "zustand";
import { authApi, type LoginPayload } from "../api/auth";
import { configureClientAuth, setClientTokens } from "../api/client";
import { tokenStorage } from "../services/tokenStorage";
import type { User } from "../api/types";

const ACCESS_TOKEN_KEY = "sportbooking.accessToken";
const REFRESH_TOKEN_KEY = "sportbooking.refreshToken";
const USER_KEY = "sportbooking.user";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  bootstrapped: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: { accessToken: string; refreshToken: string; user?: User | null }) => Promise<void>;
};

async function clearStoredSession() {
  await Promise.all([
    tokenStorage.deleteItem(ACCESS_TOKEN_KEY),
    tokenStorage.deleteItem(REFRESH_TOKEN_KEY),
    tokenStorage.deleteItem(USER_KEY)
  ]);
  setClientTokens({ accessToken: null, refreshToken: null });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  bootstrapped: false,

  async setSession(session) {
    const promises: Promise<void>[] = [
      tokenStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken),
      tokenStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
    ];
    if (session.user) {
      promises.push(tokenStorage.setItem(USER_KEY, JSON.stringify(session.user)));
    }
    await Promise.all(promises);
    setClientTokens(session);
    set((state) => ({ accessToken: session.accessToken, refreshToken: session.refreshToken, user: session.user ?? state.user }));
  },

  async bootstrap() {
    configureClientAuth({
      onSessionRefreshed: (session) => {
        void get().setSession({ accessToken: session.accessToken, refreshToken: session.refreshToken, user: session.user ?? get().user });
      },
      onUnauthorized: () => {
        void get().logout();
      }
    });

    try {
      const [storedAccessToken, storedRefreshToken, storedUserRaw] = await Promise.all([
        tokenStorage.getItem(ACCESS_TOKEN_KEY),
        tokenStorage.getItem(REFRESH_TOKEN_KEY),
        tokenStorage.getItem(USER_KEY)
      ]);

      if (!storedAccessToken || !storedRefreshToken) {
        setClientTokens({ accessToken: null, refreshToken: null });
        set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
        return;
      }

      setClientTokens({ accessToken: storedAccessToken, refreshToken: storedRefreshToken });

      let cachedUser: User | null = null;
      if (storedUserRaw) {
        try {
          cachedUser = JSON.parse(storedUserRaw);
        } catch {
          // ignore corrupted json
        }
      }

      // FAST PATH: We have cached user credentials! Boot app instantly (0ms delay)!
      if (cachedUser) {
        set({ user: cachedUser, accessToken: storedAccessToken, refreshToken: storedRefreshToken, bootstrapped: true });

        // Stale-while-revalidate: Re-verify in background without blocking screen render
        void authApi
          .me()
          .then((freshUser) => {
            if (!["USER", "PARTNER"].includes(freshUser.role) || freshUser.status !== "ACTIVE") {
              void clearStoredSession();
              set({ user: null, accessToken: null, refreshToken: null });
              return;
            }
            void tokenStorage.setItem(USER_KEY, JSON.stringify(freshUser));
            set({ user: freshUser });
          })
          .catch((err: any) => {
            // Only logout if server explicitly responded with 401 Unauthorized
            if (err?.message?.includes("401") || err?.status === 401) {
              void get().logout();
            }
          });
        return;
      }

      // NO CACHED USER (first run or migration): fetch user profile with a 3.5s timeout race
      const fetchWithTimeout = Promise.race([
        authApi.me(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500))
      ]);

      try {
        const user = await fetchWithTimeout;
        if (!["USER", "PARTNER"].includes(user.role) || user.status !== "ACTIVE") {
          await clearStoredSession();
          set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
          return;
        }
        await tokenStorage.setItem(USER_KEY, JSON.stringify(user));
        set({ user, accessToken: storedAccessToken, refreshToken: storedRefreshToken, bootstrapped: true });
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.status === 401) {
          await clearStoredSession();
          set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
        } else {
          // Network timeout or offline: still set bootstrapped to true so user isn't stuck on splash!
          set({ user: null, accessToken: storedAccessToken, refreshToken: storedRefreshToken, bootstrapped: true });
        }
      }
    } catch {
      set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
    }
  },

  async login(payload) {
    const session = await authApi.login(payload);
    const accessToken = session.accessToken ?? session.token;
    if (!accessToken) throw new Error("Máy chủ không trả về access token");
    if (!["USER", "PARTNER"].includes(session.user.role)) throw new Error("Ứng dụng dành cho Khách hàng và Đối tác");
    if (session.user.status !== "ACTIVE") throw new Error("Tài khoản của bạn đang bị khóa");
    await get().setSession({ accessToken, refreshToken: session.refreshToken, user: session.user });
  },

  async logout() {
    const currentRefreshToken = get().refreshToken;
    try {
      if (currentRefreshToken) await authApi.logout(currentRefreshToken);
    } catch {
      // Local logout must still succeed when the network is unavailable.
    }
    await clearStoredSession();
    set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
  }
}));
