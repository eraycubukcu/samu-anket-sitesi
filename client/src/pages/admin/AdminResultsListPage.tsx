import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { adminApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Survey } from "@/types";

export function AdminResultsListPage() {
  const surveysQuery = useQuery({
    queryKey: ["admin", "surveys"],
    queryFn: async () => (await adminApi.get<Survey[]>("/surveys")).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sonuçlar</h1>
        <p className="text-sm text-muted-foreground">
          Bir anket seçip cevap özetini ve Excel çıktısını görüntüleyin.
        </p>
      </div>

      {surveysQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {surveysQuery.isError && (
        <p className="text-sm text-destructive">Anketler yüklenemedi.</p>
      )}

      {surveysQuery.data && surveysQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Başlık</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Sınav Tarihi</TableHead>
              <TableHead className="text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveysQuery.data.map((survey) => (
              <TableRow key={survey._id}>
                <TableCell>{survey.title}</TableCell>
                <TableCell>
                  <Badge variant={survey.isActive ? "default" : "secondary"}>
                    {survey.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(survey.examDate).toLocaleString("tr-TR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link to={`/admin/anketler/${survey._id}/sonuclar`} />}
                  >
                    <BarChart3 className="size-4" />
                    Sonuçları Gör
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {surveysQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Henüz anket oluşturulmadı.</p>
      )}
    </div>
  );
}
