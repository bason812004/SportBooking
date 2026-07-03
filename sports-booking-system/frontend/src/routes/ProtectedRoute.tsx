import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types/api";
import { useAuth } from "../features/auth/hooks/useAuth";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const isPartnerRoute = location.pathname.startsWith("/partner");
    return <Navigate to={isPartnerRoute ? "/partner/login" : "/login"} replace />;
  }
  if (roles && !hasRole(roles)) return <Navigate to="/" replace />;
  return <Outlet />;
}
