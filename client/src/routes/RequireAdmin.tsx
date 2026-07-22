import { Navigate, Outlet } from "react-router-dom";
import { getAdminToken } from "@/lib/api";

export function RequireAdmin() {
  const token = getAdminToken();

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
