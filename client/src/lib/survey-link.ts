import { toast } from "sonner";

// Öğrenciyle paylaşılan linkin (ve QR kodun) taban adresi. Tanımlı değilse
// panelin açıldığı adres kullanılır. Localhost'ta çalışırken telefonla QR test
// etmek için bilgisayarın yerel IP'si (ör. http://192.168.1.20:5173), canlıda
// gerçek alan adı verilir.
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/+$/, "");

export const getSurveyBaseUrl = () => PUBLIC_APP_URL || window.location.origin;

export const getSurveyLink = (surveySlug: string) =>
  `${getSurveyBaseUrl()}/anketler/${surveySlug}`;

// Link yalnızca bu bilgisayarda açılabilir mi? (telefon "localhost"u kendisi sanır)
export const isLocalOnlyLink = () => {
  const { hostname } = new URL(getSurveyBaseUrl());
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
};

export const copySurveyLink = async (surveySlug: string) => {
  try {
    await navigator.clipboard.writeText(getSurveyLink(surveySlug));
    toast.success("Anket linki kopyalandı.");
  } catch {
    toast.error("Link kopyalanamadı.");
  }
};
