import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // VITE_API_URL=/api verildiğinde istekler aynı adres üzerinden backend'e gider.
    // Telefonla QR testinde (vite --host) telefonun localhost:5000'e ulaşamaması
    // sorununu çözer; CORS ayarı da gerekmez.
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
