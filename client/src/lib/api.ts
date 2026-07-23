import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;

const ADMIN_TOKEN_KEY = "samu_admin_token";

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
export const setAdminToken = (token: string) =>
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

// Token'ın imzasını doğrulamaz (buna gerek yok, backend zaten her istekte
// doğruluyor) - sadece bozuk/süresi dolmuş bir token'ın admin arayüzünü
// gereksiz yere göstermesini engeller.
export const isAdminTokenValid = () => {
  const token = getAdminToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// Admin JWT ile korunan uçlar için: token otomatik eklenir, 401'de oturum temizlenip
// giriş sayfasına yönlendirilir.
export const adminApi = axios.create({ baseURL });

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAdminToken();
      if (!window.location.pathname.startsWith("/admin/login")) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  },
);

// Clerk ile korunan öğrenci uçları için düz axios instance'ı; token her
// istekte useStudentApi hook'u üzerinden taze olarak ekleniyor.
export const api = axios.create({ baseURL });

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.mesaj ||
      fallback
    );
  }
  return fallback;
};
