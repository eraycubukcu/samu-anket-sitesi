import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAdminToken } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Panel", end: true },
  { to: "/admin/anketler", label: "Anketler", end: false },
];

export function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Admin Paneli</span>
          <nav className="flex items-center gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "text-sm text-muted-foreground hover:text-foreground transition-colors",
                    isActive && "text-foreground font-medium",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Çıkış
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
