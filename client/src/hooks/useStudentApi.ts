import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { useMemo } from "react";

export function useStudentApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const instance = axios.create({ baseURL: import.meta.env.VITE_API_URL });

    instance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);
}
