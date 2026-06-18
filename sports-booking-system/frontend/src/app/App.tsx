import { AppRoutes } from "../routes/AppRoutes";
import { useRealtime } from "../hooks/useRealtime";

export function App() {
  useRealtime();
  return <AppRoutes />;
}
