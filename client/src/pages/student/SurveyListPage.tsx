import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useStudentApi } from "@/hooks/useStudentApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Survey, StudentResponse } from "@/types";

export function SurveyListPage() {
  const studentApi = useStudentApi();

  const surveysQuery = useQuery({
    queryKey: ["surveys", "active"],
    queryFn: async () => (await studentApi.get<Survey[]>("/surveys/active")).data,
  });

  const responsesQuery = useQuery({
    queryKey: ["responses", "my"],
    queryFn: async () => (await studentApi.get<StudentResponse[]>("/responses/my")).data,
  });

  if (surveysQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (surveysQuery.isError) {
    return <p className="text-sm text-destructive">Anketler yüklenemedi.</p>;
  }

  const answeredSurveyIds = new Set(
    (responsesQuery.data ?? []).map((r) => r.survey._id),
  );

  const surveys = surveysQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aktif Anketler</h1>
        <p className="text-sm text-muted-foreground">
          Şu anda doldurabileceğiniz anketler aşağıda listelenir.
        </p>
      </div>

      {surveys.length === 0 && (
        <p className="text-sm text-muted-foreground">Şu anda aktif anket bulunmuyor.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {surveys.map((survey) => {
          const answered = answeredSurveyIds.has(survey._id);
          return (
            <Card key={survey._id} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{survey.title}</CardTitle>
                  {answered && <Badge variant="secondary">Dolduruldu</Badge>}
                </div>
                {survey.description && (
                  <CardDescription>{survey.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  variant={answered ? "outline" : "default"}
                  className="w-full"
                  nativeButton={false}
                  render={<Link to={`/anketler/${survey.slug}`} />}
                >
                  {answered ? "Cevabı Düzenle" : "Anketi Doldur"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
