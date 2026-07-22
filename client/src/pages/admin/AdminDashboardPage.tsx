import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminStats } from "@/types";

export function AdminDashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => (await adminApi.get<AdminStats>("/admin/stats")).data,
  });

  if (statsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-destructive">İstatistikler yüklenemedi.</p>;
  }

  const stats = statsQuery.data;
  const tiles = [
    { label: "Toplam Anket", value: stats.totalSurveys },
    { label: "Aktif Anket", value: stats.activeSurveys },
    { label: "Toplam Cevap", value: stats.totalResponses },
    { label: "Toplam Öğrenci", value: stats.totalStudents },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Panel</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {tile.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">{tile.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Anketler</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlık</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Cevap Sayısı</TableHead>
                <TableHead>Oluşturulma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentSurveys.map((survey) => (
                <TableRow key={survey._id}>
                  <TableCell>
                    <Link
                      to={`/admin/anketler/${survey._id}/sonuclar`}
                      className="hover:underline"
                    >
                      {survey.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={survey.isActive ? "default" : "secondary"}>
                      {survey.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell>{survey.responseCount}</TableCell>
                  <TableCell>
                    {new Date(survey.createdAt).toLocaleDateString("tr-TR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
