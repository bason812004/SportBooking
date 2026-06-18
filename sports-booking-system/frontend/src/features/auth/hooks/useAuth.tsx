import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { REFRESH_TOKEN_KEY, TOKEN_KEY, USER_KEY } from "../../../lib/constants";
import type { Role, User } from "../../../types/api";
import { authApi } from "../api/authApi";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasRole: (roles: Role[]) => boolean;
  setSession: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => readUser());
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(REFRESH_TOKEN_KEY));

  useEffect(() => {
    if (!token) return;
    let active = true;
    authApi.me()
      .then((nextUser) => {
        if (active) {
          localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
          setUser(nextUser);
        }
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          setUser(null);
          setToken(null);
          setRefreshToken(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      refreshToken,
      isAuthenticated: Boolean(user && token),
      hasRole: (roles) => Boolean(user && roles.includes(user.role)),
      setSession: (nextUser, nextToken, nextRefreshToken) => {
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        localStorage.setItem(TOKEN_KEY, nextToken);
        if (nextRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
        setUser(nextUser);
        setToken(nextToken);
        if (nextRefreshToken) setRefreshToken(nextRefreshToken);
      },
      logout: () => {
        void authApi.logout(localStorage.getItem(REFRESH_TOKEN_KEY));
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setUser(null);
        setToken(null);
        setRefreshToken(null);
        navigate("/login");
      }
    }),
    [navigate, refreshToken, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
