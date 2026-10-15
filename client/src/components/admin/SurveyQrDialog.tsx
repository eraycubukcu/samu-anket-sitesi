import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildExportFilename } from "@/lib/pdf";
import { copySurveyLink, getSurveyLink, isLocalOnlyLink } from "@/lib/survey-link";

interface SurveyQrDialogProps {
  survey: { slug: string; title: string } | null;
  onOpenChange: (open: boolean) => void;
}

// Anket linkinin QR kodu: sınıfta tahtaya yansıtmak veya çıktısını almak için
export function SurveyQrDialog({ survey, onOpenChange }: SurveyQrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const link = survey ? getSurveyLink(survey.slug) : "";

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !survey) return;
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${buildExportFilename(`${survey.title} QR`)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("QR kod indirilemedi.");
    }
  };

  return (
    <Dialog open={Boolean(survey)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anket QR kodu</DialogTitle>
          <DialogDescription>
            {survey?.title}. Öğrenciler kodu telefon kamerasıyla okutunca anket açılır (giriş yapmaları istenir).
          </DialogDescription>
        </DialogHeader>

        {survey && (
          <div className="flex flex-col items-center gap-4">
            {/* QR her temada beyaz zemin üstünde siyah olmalı ki kameralar okuyabilsin */}
            <div className="rounded-xl bg-white p-3 ring-1 ring-border">
              <QRCodeCanvas
                ref={canvasRef}
                value={link}
                size={512}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#000000"
                title={`${survey.title} anket linki`}
                style={{ width: 256, height: 256 }}
              />
            </div>
            <div className="flex w-full items-center gap-2">
              <Input readOnly value={link} aria-label="Anket linki" />
              <Button type="button" variant="outline" size="icon" onClick={() => copySurveyLink(survey.slug)}>
                <Copy className="size-4" />
                <span className="sr-only">Linki kopyala</span>
              </Button>
            </div>
            {isLocalOnlyLink() && (
              <Alert>
                <TriangleAlert className="size-4" />
                <AlertTitle>Bu link sadece bu bilgisayarda açılır</AlertTitle>
                <AlertDescription>
                  Uygulama localhost'ta çalıştığı için telefon bu adresi açamaz. Aynı Wi-Fi'daki bir telefonla denemek
                  için <code>client/.env</code> dosyasına <code>VITE_PUBLIC_APP_URL=http://&lt;bilgisayarın-IP'si&gt;:5173</code>{" "}
                  ekleyin; canlıya alındığında gerçek alan adını yazın.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          <Button type="button" onClick={handleDownload}>
            <Download className="size-4" />
            PNG indir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
