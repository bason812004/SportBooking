import { create } from "zustand";
import { authApi, type LoginPayload } from "../api/auth";
import { configureClientAuth, setClientTokens } from "../api/client";
import { tokenStorage } from "../services/tokenStorage";
import type { User } from "../api/types";

const ACCESS_TOKEN_KEY = "sportbooking.accessToken";
const REFRESH_TOKEN_KEY = "sportbooking.refreshToken";

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
  await Promise.all([tokenStorage.deleteItem(ACCESS_TOKEN_KEY), tokenStorage.deleteItem(REFRESH_TOKEN_KEY)]);
  setClientTokens({ accessToken: null, refreshToken: null });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  bootstrapped: false,

  async setSession(session) {
    await Promise.all([
      tokenStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken),
      tokenStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
    ]);
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

    const [storedAccessToken, storedRefreshToken] = await Promise.all([
      tokenStorage.getItem(ACCESS_TOKEN_KEY),
      tokenStorage.getItem(REFRESH_TOKEN_KEY)
    ]);
    if (!storedAccessToken || !storedRefreshToken) {
      setClientTokens({ accessToken: null, refreshToken: null });
      set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
      return;
    }

    setClientTokens({ accessToken: storedAccessToken, refreshToken: storedRefreshToken });
    try {
      const user = await authApi.me();
      if (user.role !== "USER" || user.status !== "ACTIVE") {
        await clearStoredSession();
        set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
        return;
      }
      set({ user, accessToken: storedAccessToken, refreshToken: storedRefreshToken, bootstrapped: true });
    } catch {
      await clearStoredSession();
      set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true });
    }
  },

  async login(payload) {
    const session = await authApi.login(payload);
    const accessToken = session.accessToken ?? session.token;
    if (!accessToken) throw new Error("May chu khong tra ve access token");
    if (session.user.role !== "USER") throw new Error("Ung dung mobile chi danh cho tai khoan khach hang");
    if (session.user.status !== "ACTIVE") throw new Error("Tai khoan cua ban dang bi khoa");
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
