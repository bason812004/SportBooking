import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types/api";
import { useAuth } from "../features/auth/hooks/useAuth";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const isPartnerOrRecipientRoute = location.pathname.startsWith("/partner") || location.pathname.startsWith("/recipient");
    return <Navigate to={isPartnerOrRecipientRoute ? "/partner/login" : "/login"} replace />;
  }
  if (roles && !hasRole(roles)) return <Navigate to="/" replace />;
  return <Outlet />;
}
