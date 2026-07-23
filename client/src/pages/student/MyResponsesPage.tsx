import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useStudentApi } from "@/hooks/useStudentApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudentResponse } from "@/types";

const isSurveyOpen = (survey: StudentResponse["survey"]) => {
  const now = new Date();
  return (
    survey.isActive &&
    new Date(survey.startDate) <= now &&
    new Date(survey.endDate) >= now
  );
};

export function MyResponsesPage() {
  const studentApi = useStudentApi();

  const responsesQuery = useQuery({
    queryKey: ["responses", "my"],
    queryFn: async () => (await studentApi.get<StudentResponse[]>("/responses/my")).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cevaplarım</h1>
        <p className="text-sm text-muted-foreground">
          Daha önce doldurduğunuz anketler.
        </p>
      </div>

      {responsesQuery.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {responsesQuery.isError && (
        <p className="text-sm text-destructive">Cevaplar yüklenemedi.</p>
      )}

      {responsesQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Henüz bir anket doldurmadınız.</p>
      )}

      <div className="space-y-3">
        {responsesQuery.data?.map((response) => {
          const open = isSurveyOpen(response.survey);
          return (
            <Card key={response._id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{response.survey.title}</CardTitle>
                    {response.survey.description && (
                      <CardDescription>{response.survey.description}</CardDescription>
                    )}
                  </div>
                  {!open && <Badge variant="secondary">Anket kapandı</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Gönderim tarihi: {new Date(response.createdAt).toLocaleString("tr-TR")}
                </span>
                {open && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link to={`/anketler/${response.survey._id}`} />}
                  >
                    <Pencil className="size-4" />
                    Düzenle
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
