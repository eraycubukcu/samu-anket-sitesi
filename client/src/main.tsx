import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";
import App from "./App.tsx";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY tanımlı değil (.env dosyasını kontrol edin).");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster richColors position="top-center" />
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
