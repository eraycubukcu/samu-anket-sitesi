import { Navigate, Outlet } from "react-router-dom";
import { clearAdminToken, isAdminTokenValid } from "@/lib/api";

export function RequireAdmin() {
  if (!isAdminTokenValid()) {
    clearAdminToken();
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
