import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BarChart3, Copy, Link2, MoreVertical } from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { copySurveyLink } from "@/lib/survey-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <Button nativeButton={false} render={<Link to="/admin/anketler/yeni" />}>
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
              <TableHead className="hidden sm:table-cell">Sınav Tarihi</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveysQuery.data.map((survey) => (
              <TableRow key={survey._id}>
                <TableCell>{survey.title}</TableCell>
                <TableCell>
                  <Badge variant={survey.isActive ? "success" : "destructive"}>
                    {survey.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatDateTime(survey.examDate)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                      <MoreVertical className="size-4" />
                      <span className="sr-only">İşlemler</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        render={<Link to={`/admin/anketler/${survey._id}/sonuclar`} />}
                      >
                        <BarChart3 className="size-4" />
                        Sonuçlar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={<Link to={`/admin/anketler/${survey._id}/duzenle`} />}
                      >
                        <Pencil className="size-4" />
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copySurveyLink(survey.slug)}>
                        <Link2 className="size-4" />
                        Linki Kopyala
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={<Link to={`/admin/anketler/yeni?kopyala=${survey._id}`} />}
                      >
                        <Copy className="size-4" />
                        Anketi Çoğalt
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(survey)}>
                        <Trash2 className="size-4" />
                        Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
