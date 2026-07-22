import { useQuery } from "@tanstack/react-query";
import { useStudentApi } from "@/hooks/useStudentApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudentResponse } from "@/types";

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
        {responsesQuery.data?.map((response) => (
          <Card key={response._id}>
            <CardHeader>
              <CardTitle className="text-base">{response.survey.title}</CardTitle>
              {response.survey.description && (
                <CardDescription>{response.survey.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gönderim tarihi: {new Date(response.createdAt).toLocaleString("tr-TR")}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
