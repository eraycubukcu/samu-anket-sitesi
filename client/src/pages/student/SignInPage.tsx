import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

export function SignInPage() {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/giris/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch {
      toast.error("Giriş başlatılamadı, lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <img
            src="/kirmizi-logo.png"
            alt="Samsun Üniversitesi"
            className="h-20 w-auto"
          />
          <div>
            <h1 className="text-lg font-semibold">Samsun Üniversitesi</h1>
            <p className="text-sm text-muted-foreground">Anket Sistemi</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={!isLoaded || loading}
          >
            <GoogleIcon className="size-4" />
            {loading ? "Yönlendiriliyor..." : "Google ile Giriş Yap"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Sadece @samsun.edu.tr uzantılı hesaplarla giriş yapabilirsiniz.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
