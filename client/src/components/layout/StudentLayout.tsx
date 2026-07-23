import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { UserButton, useClerk } from "@clerk/clerk-react";
import { ClipboardList, ListChecks, LogOut } from "lucide-react";
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

const navItems = [
  { to: "/", label: "Anketler", icon: ListChecks, end: true },
  { to: "/cevaplarim", label: "Cevaplarım", icon: ClipboardList, end: false },
];

// useSidebar() sadece SidebarProvider'ın alt ağacında çalışır, bu yüzden
// menü SidebarProvider'ı render eden StudentLayout'tan ayrı bir bileşende.
function StudentNavMenu({
  isActive,
}: {
  isActive: (to: string, end: boolean) => boolean;
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
            isActive={isActive(item.to, item.end)}
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

export function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useClerk();

  const isActive = (to: string, end: boolean) =>
    end ? location.pathname === to : location.pathname.startsWith(to);

  const handleLogout = () => {
    signOut(() => navigate("/giris", { replace: true }));
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-3">
          <Link
            to="/"
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
              <StudentNavMenu isActive={isActive} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Çıkış Yap"
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive"
              >
                <LogOut />
                <span>Çıkış Yap</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <img
              src="/kirmizi-logo-yatay.png"
              alt="Samsun Üniversitesi"
              className="h-6 w-auto object-contain md:hidden"
            />
            <span className="hidden text-sm font-medium text-muted-foreground md:inline">
              Samsun Üniversitesi Anketler
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton />
          </div>
        </header>
        <div className="flex-1 px-6 py-8">
          <div className="mx-auto w-full max-w-3xl">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
