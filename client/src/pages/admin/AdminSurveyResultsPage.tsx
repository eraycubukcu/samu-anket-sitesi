import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SurveyResults } from "@/types";

export function AdminSurveyResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [exporting, setExporting] = useState(false);

  const resultsQuery = useQuery({
    queryKey: ["admin", "survey-results", id],
    queryFn: async () => (await adminApi.get<SurveyResults>(`/responses/survey/${id}`)).data,
    enabled: Boolean(id),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await adminApi.get(`/responses/survey/${id}/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `anket-sonuclari-${id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getErrorMessage(error, "Excel dosyası indirilemedi."));
    } finally {
      setExporting(false);
    }
  };

  if (resultsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (resultsQuery.isError || !resultsQuery.data) {
    return <p className="text-sm text-destructive">Sonuçlar yüklenemedi.</p>;
  }

  const results = resultsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{results.survey}</h1>
          <p className="text-sm text-muted-foreground">
            Toplam {results.totalResponses} cevap
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || results.totalResponses === 0}>
          <Download className="size-4" />
          {exporting ? "İndiriliyor..." : "Excel İndir"}
        </Button>
      </div>

      <div className="space-y-4">
        {results.summary.map((question, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                {index + 1}. {question.questionText}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {question.questionType === "rating" && (
                <div className="space-y-2">
                  <p className="text-sm">
                    Ortalama: <span className="font-semibold">{question.average}</span>
                  </p>
                  <div className="space-y-1">
                    {question.distribution.map((d) => (
                      <div key={d.star} className="flex items-center gap-2 text-sm">
                        <span className="w-10 text-muted-foreground">{d.star} ★</span>
                        <div className="h-2 flex-1 rounded bg-muted">
                          <div
                            className="h-2 rounded bg-primary"
                            style={{
                              width: results.totalResponses
                                ? `${(d.count / results.totalResponses) * 100}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span className="w-6 text-right text-muted-foreground">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(question.questionType === "radio" || question.questionType === "checkbox") && (
                <div className="space-y-1">
                  {Object.entries(question.optionCounts).map(([option, count]) => (
                    <div key={option} className="flex items-center gap-2 text-sm">
                      <span className="w-32 truncate">{option}</span>
                      <div className="h-2 flex-1 rounded bg-muted">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{
                            width: results.totalResponses
                              ? `${(count / results.totalResponses) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {question.questionType === "text" && (
                <ul className="space-y-1 text-sm">
                  {question.answers.length === 0 && (
                    <li className="text-muted-foreground">Henüz cevap yok.</li>
                  )}
                  {question.answers.map((answer, i) => (
                    <li key={i} className="rounded bg-muted px-3 py-2">
                      {answer}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
