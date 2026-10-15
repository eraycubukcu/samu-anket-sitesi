import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  Settings,
  BarChart3,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearAdminToken } from "@/lib/api";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    to: "/admin/anketler",
    label: "Anketler",
    icon: ListChecks,
    end: false,
    // "/admin/anketler/yeni" kendi menü öğesine sahip, "Anketler" ile
    // birlikte aktif görünmesin diye burada hariç tutuluyor.
    exclude: ["/admin/anketler/yeni"],
  },
  { to: "/admin/anketler/yeni", label: "Anket Oluştur", icon: PlusCircle, end: true },
  { to: "/admin/dersler", label: "Dersler", icon: BookOpen, end: false },
  { to: "/admin/sonuclar", label: "Sonuçlar", icon: BarChart3, end: false },
  { to: "/admin/ayarlar", label: "Ayarlar", icon: Settings, end: true },
];

// useSidebar() sadece SidebarProvider'ın alt ağacında çalışır, bu yüzden
// menü SidebarProvider'ı render eden AdminLayout'tan ayrı bir bileşende.
function AdminNavMenu({
  isActive,
}: {
  isActive: (to: string, end: boolean, exclude?: string[]) => boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.to}>
          <SidebarMenuButton
            isActive={isActive(item.to, item.end, item.exclude)}
            tooltip={item.label}
            onClick={handleNavigate}
            render={<NavLink to={item.to} />}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string, end: boolean, exclude: string[] = []) => {
    if (exclude.some((path) => location.pathname.startsWith(path))) return false;
    return end ? location.pathname === to : location.pathname.startsWith(to);
  };

  const handleLogout = () => {
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-3">
          <Link
            to="/admin"
            className="flex justify-center group-data-[collapsible=icon]:hidden"
          >
            <img
              src="/kirmizi-logo-yatay.png"
              alt="Samsun Üniversitesi"
              className="h-8 w-auto object-contain"
            />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <AdminNavMenu isActive={isActive} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Çıkış"
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive"
              >
                <LogOut />
                <span>Çıkış</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">Admin Paneli</span>
          </div>
          <ThemeToggle />
        </header>
        <div className="flex-1 px-6 py-8">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
