import { NavLink, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Anketler", end: true },
  { to: "/cevaplarim", label: "Cevaplarım", end: false },
];

export function StudentLayout() {
  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Samsun Üniversitesi Anketler</span>
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
            <UserButton afterSignOutUrl="/giris" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
