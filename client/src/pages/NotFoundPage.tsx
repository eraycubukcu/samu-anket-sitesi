import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
      <Button nativeButton={false} render={<Link to="/" />}>Ana sayfaya dön</Button>
    </div>
  );
}
