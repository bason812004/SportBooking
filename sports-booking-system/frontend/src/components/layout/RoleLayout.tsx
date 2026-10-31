import { useAuth } from "../../features/auth/hooks/useAuth";
import { DashboardLayout } from "./DashboardLayout";
import { PublicLayout } from "./PublicLayout";

/** For pages every role has (the notifications page): customers get the site layout, everyone else their dashboard. */
export function RoleLayout() {
  const { user } = useAuth();
  return user?.role === "USER" ? <PublicLayout /> : <DashboardLayout />;
}
