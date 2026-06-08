import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "../types/api";
import { useAuth } from "../features/auth/hooks/useAuth";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !hasRole(roles)) return <Navigate to="/" replace />;
  return <Outlet />;
}
