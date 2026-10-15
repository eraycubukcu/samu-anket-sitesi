import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { exportElementToPdf } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionBarChart } from "@/components/admin/QuestionBarChart";
import type { SurveyResults } from "@/types";

function buildExportFilename(surveyTitle: string | undefined) {
  return `${surveyTitle ?? "anket"} sonuçları`.replace(/[\\/:*?"<>|]/g, "").trim();
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
    >
      <ArrowLeft className="size-4" />
      Geri
    </Button>
  );
}

export function AdminSurveyResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const resultsQuery = useQuery({
    queryKey: ["admin", "survey-results", id],
    queryFn: async () => (await adminApi.get<SurveyResults>(`/responses/survey/${id}`)).data,
    enabled: Boolean(id),
  });

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const response = await adminApi.get(`/responses/survey/${id}/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${buildExportFilename(resultsQuery.data?.survey)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getErrorMessage(error, "Excel dosyası indirilemedi."));
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    const node = exportRef.current;
    if (!node) return;

    setExportingPdf(true);
    try {
      await exportElementToPdf(node, buildExportFilename(resultsQuery.data?.survey));
    } catch (error) {
      toast.error(getErrorMessage(error, "PDF oluşturulamadı."));
    } finally {
      setExportingPdf(false);
    }
  };

  const exporting = exportingExcel || exportingPdf;

  if (resultsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackButton />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (resultsQuery.isError || !resultsQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackButton />
        <p className="text-sm text-destructive">Sonuçlar yüklenemedi.</p>
      </div>
    );
  }

  const results = resultsQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportExcel}
            disabled={exporting || results.totalResponses === 0}
            className="border border-neutral-300 bg-white text-black hover:bg-neutral-100"
          >
            <FileSpreadsheet className="size-4" />
            {exportingExcel ? "İndiriliyor..." : "Excel İndir"}
          </Button>
          <Button
            onClick={handleExportPdf}
            disabled={exporting || results.totalResponses === 0}
            className="border border-neutral-300 bg-white text-black hover:bg-neutral-100"
          >
            <FileText className="size-4" />
            {exportingPdf ? "İndiriliyor..." : "PDF İndir"}
          </Button>
        </div>
      </div>

      <div ref={exportRef} className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{results.survey}</h1>
          <p className="text-sm text-muted-foreground">
            Toplam {results.totalResponses} cevap
          </p>
        </div>

        <div className="space-y-4">
          {results.summary.map((question, index) => (
            <Card
              key={index}
              data-pdf-skip={question.questionType === "text" ? "true" : undefined}
            >
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  {index + 1}. {question.questionText}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {question.questionType === "rating" && (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Ortalama: <span className="font-semibold">{question.average}</span>
                    </p>
                    <QuestionBarChart
                      data={question.distribution.map((d) => ({
                        label: `${d.star} ★`,
                        count: d.count,
                      }))}
                      total={results.totalResponses}
                    />
                  </div>
                )}

                {(question.questionType === "radio" || question.questionType === "checkbox") && (
                  <QuestionBarChart
                    data={Object.entries(question.optionCounts).map(([option, count]) => ({
                      label: option,
                      count,
                    }))}
                    total={results.totalResponses}
                  />
                )}

                {question.questionType === "text" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Açık uçlu sorular Excel/PDF çıktısına dahil edilmez.
                    </p>
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
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
