import { useEffect } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ALLOWED_EMAIL_DOMAIN = "@samsun.edu.tr";

export function RequireStudent() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const location = useLocation();
  const navigate = useNavigate();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const isAllowedDomain = email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);

  // Clerk girişi @samsun.edu.tr dışındaki hesaplarla da tamamlanabilir
  // (Clerk kendisi domain kısıtlaması yapmıyor); backend zaten reddediyor ama
  // burada da kontrol edip kullanıcıyı hemen çıkışa yönlendiriyoruz, aksi
  // halde kullanıcı "giriş yapılmış" görünüp her istek sessizce 403 alır.
  useEffect(() => {
    if (isLoaded && isSignedIn && user && !isAllowedDomain) {
      toast.error("Sadece @samsun.edu.tr uzantılı hesaplarla giriş yapabilirsiniz.");
      signOut(() => navigate("/giris", { replace: true }));
    }
  }, [isLoaded, isSignedIn, user, isAllowedDomain, signOut, navigate]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return <Navigate to="/giris" state={{ from: location }} replace />;
  }

  if (!isAllowedDomain) return null;

  return <Outlet />;
}
