import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export function SsoCallbackPage() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Giriş tamamlanıyor...</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
    </div>
  );
}
