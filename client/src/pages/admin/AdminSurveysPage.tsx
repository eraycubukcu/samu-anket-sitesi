import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BarChart3 } from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Survey } from "@/types";

export function AdminSurveysPage() {
  const queryClient = useQueryClient();

  const surveysQuery = useQuery({
    queryKey: ["admin", "surveys"],
    queryFn: async () => (await adminApi.get<Survey[]>("/surveys")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => adminApi.delete(`/surveys/${id}`),
    onSuccess: () => {
      toast.success("Anket silindi.");
      queryClient.invalidateQueries({ queryKey: ["admin", "surveys"] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Anket silinemedi."));
    },
  });

  const handleDelete = (survey: Survey) => {
    const confirmed = window.confirm(
      `"${survey.title}" anketini silmek istediğinize emin misiniz? Bu ankete ait tüm cevaplar da silinecek.`,
    );
    if (confirmed) deleteMutation.mutate(survey._id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Anketler</h1>
        <Button render={<Link to="/admin/anketler/yeni" />}>
          <Plus className="size-4" />
          Yeni Anket
        </Button>
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
              <TableHead className="text-right">İşlemler</TableHead>
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
                <TableCell className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Sonuçlar"
                    render={<Link to={`/admin/anketler/${survey._id}/sonuclar`} />}
                  >
                    <BarChart3 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Düzenle"
                    render={<Link to={`/admin/anketler/${survey._id}/duzenle`} />}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(survey)}
                    title="Sil"
                  >
                    <Trash2 className="size-4 text-destructive" />
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
