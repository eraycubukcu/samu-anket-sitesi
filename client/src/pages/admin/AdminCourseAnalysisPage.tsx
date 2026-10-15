import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { adminApi, getErrorMessage } from "@/lib/api";
import { exportElementToPdf } from "@/lib/pdf";
import { formatDateTime } from "@/lib/utils";
import { DIMENSION_LABELS } from "@/lib/course";
import { DECISION_META, SENTIMENT_META, formatDecimal, formatPercent } from "@/lib/analysis";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DecisionBadge } from "@/components/analysis/DecisionBadge";
import { TopicHeatmap } from "@/components/analysis/TopicHeatmap";
import { SentimentBar } from "@/components/analysis/SentimentBar";
import { SegmentScatter } from "@/components/analysis/SegmentScatter";
import { TrendChart } from "@/components/analysis/TrendChart";
import type { Course, QuestionDimension } from "@/types";
import type { AnalysisReport, FullResult, Segments } from "@/types/analysis";

// Segment profilindeki "konu:X" / "boyut:Y" anahtarlarını okunur başlığa çevirir
function profileLabel(key: string) {
  const sep = key.indexOf(":");
  const kind = key.slice(0, sep);
  const value = key.slice(sep + 1);
  return kind === "konu" ? value : DIMENSION_LABELS[value as QuestionDimension] ?? value;
}

function SegmentProfileTable({ segments }: { segments: Segments }) {
  const keys = Object.keys(segments.clusters[0]?.profile ?? {});
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Segment</TableHead>
            {keys.map((k) => (
              <TableHead key={k} className="text-right whitespace-nowrap">
                {profileLabel(k)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.clusters.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="whitespace-nowrap">{c.name}</TableCell>
              {keys.map((k) => (
                <TableCell key={k} className="text-right tabular-nums">
                  {formatDecimal(c.profile[k])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AnalysisBody({ result }: { result: FullResult }) {
  const { overall } = result;
  const OverallIcon = DECISION_META[overall.decision].icon;

  return (
    <div className="space-y-6">
      {/* Genel karar */}
      <Card style={{ borderColor: DECISION_META[overall.decision].color }}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <OverallIcon className="size-6" style={{ color: DECISION_META[overall.decision].color }} aria-hidden />
            <CardTitle className="text-lg">Müfredat önerisi: {DECISION_META[overall.decision].label}</CardTitle>
          </div>
          <CardDescription className="text-base text-foreground">{overall.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">En yüksek iyileştirme olasılığı</div>
            <div className="text-2xl font-semibold tabular-nums">{formatPercent(overall.max_improvement_probability)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Analiz edilen cevap</div>
            <div className="text-2xl font-semibold tabular-nums">{result.n_responses}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Açık uçlu yorum</div>
            <div className="text-2xl font-semibold tabular-nums">{result.sentiment.total}</div>
          </div>
        </CardContent>
      </Card>

      {/* Konu kararları */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Konu bazında öneriler</CardTitle>
          <CardDescription>
            Her konu için modelin kararı, iyileştirme olasılığı ve kararı en çok etkileyen gerekçeler.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {result.topics.map((t) => {
            const p = t.probabilities.iyilestirme_gerekli ?? 0;
            return (
              <div key={t.topic} className="space-y-2 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t.topic}</span>
                  <DecisionBadge decision={t.decision} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">İyileştirme olasılığı</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.max(p * 100, 2)}%`, backgroundColor: DECISION_META[t.decision].color }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-medium tabular-nums">{formatPercent(p)}</span>
                </div>
                {t.reasons.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                    {t.reasons.map((r) => (
                      <li key={r.feature}>{r.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Isı haritası */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Konu × boyut ortalama puanları</CardTitle>
          <CardDescription>1–5 ölçeğinde; kırmızı zayıf, mavi güçlü, gri nötr (3).</CardDescription>
        </CardHeader>
        <CardContent>
          <TopicHeatmap topics={result.topics} />
        </CardContent>
      </Card>

      {/* Yorumlar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Öğrenci yorumları</CardTitle>
          <CardDescription>Duygu analizi ve yorumlarda tekrar eden temalar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SentimentBar counts={result.sentiment.counts} total={result.sentiment.total} />
          {result.themes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {result.themes.map((theme) => (
                <div key={theme.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Tema · {theme.size} yorum</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="size-2.5 rounded-full border border-border"
                        style={{ backgroundColor: SENTIMENT_META[theme.dominant_sentiment].color }}
                        aria-hidden
                      />
                      Çoğunlukla {SENTIMENT_META[theme.dominant_sentiment].label.toLocaleLowerCase("tr-TR")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {theme.keywords.map((k) => (
                      <Badge key={k} variant="secondary">
                        {k}
                      </Badge>
                    ))}
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {theme.examples.map((e, i) => (
                      <li key={i} className="border-l-2 pl-2 italic">
                        “{e}”
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Tema çıkarmak için yeterli yorum yok (en az 10 gerekir).</p>
          )}
        </CardContent>
      </Card>

      {/* Segmentler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Öğrenci segmentleri</CardTitle>
          <CardDescription>
            Benzer cevap veren öğrenci grupları (KMeans
            {result.segments && `, k=${result.segments.k}, silhouette ${formatDecimal(result.segments.silhouette)}`}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.segments ? (
            <>
              <SegmentScatter segments={result.segments} />
              <SegmentProfileTable segments={result.segments} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Segmentasyon için yeterli cevap yok (en az 10 gerekir).</p>
          )}
        </CardContent>
      </Card>

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dönemlere göre ortalama puan</CardTitle>
          <CardDescription>Aynı dersin önceki dönemleriyle karşılaştırma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TrendChart terms={result.trend.terms} />
          {result.trend.topic_changes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konu</TableHead>
                  <TableHead className="text-right">Önceki</TableHead>
                  <TableHead className="text-right">Şimdi</TableHead>
                  <TableHead className="text-right">Değişim</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">p değeri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.trend.topic_changes.map((c) => (
                  <TableRow key={c.topic}>
                    <TableCell>{c.topic}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDecimal(c.previous_mean)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDecimal(c.mean)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {c.delta < 0 ? (
                          <ArrowDownRight className="size-4" style={{ color: "var(--viz-div-neg)" }} aria-hidden />
                        ) : (
                          <ArrowUpRight className="size-4" style={{ color: "var(--viz-div-pos)" }} aria-hidden />
                        )}
                        {c.delta > 0 ? "+" : ""}
                        {formatDecimal(c.delta)}
                        {c.significant && (
                          <Badge variant="outline" className="ml-1">
                            anlamlı
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {c.p_value < 0.001 ? "< 0,001" : formatDecimal(c.p_value, 3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground">
            "Anlamlı": Mann-Whitney U testinde p &lt; 0,05. Yani değişimin tesadüf olma ihtimali düşük.
          </p>
        </CardContent>
      </Card>

      {/* Anomaliler */}
      {result.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diğer derslere göre belirgin farklar</CardTitle>
            <CardDescription>Aynı dönemdeki diğer derslerin ortalamasına göre 1,5σ'dan büyük sapmalar.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {result.anomalies.map((a) => (
                <li key={a.dimension} className="flex items-start gap-2">
                  {a.z < 0 ? (
                    <ArrowDownRight className="mt-0.5 size-4 shrink-0" style={{ color: "var(--viz-div-neg)" }} aria-hidden />
                  ) : (
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0" style={{ color: "var(--viz-div-pos)" }} aria-hidden />
                  )}
                  {a.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="size-4" />
        <AlertTitle>Bu bir karar destek önerisidir</AlertTitle>
        <AlertDescription>
          Nihai karar öğretim üyesi ve bölüme aittir. Model:{" "}
          {result.model.decision_model === "random_forest" ? "Random Forest" : "Lojistik Regresyon"}
          {result.model.metrics?.macro_f1 != null && ` (test macro-F1 ${formatDecimal(result.model.metrics.macro_f1)})`}
          . Model şu an sentetik veriyle eğitilmiştir; gerçek veri biriktikçe yeniden eğitilmelidir.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function AdminCourseAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const courseQuery = useQuery({
    queryKey: ["admin", "course", id],
    queryFn: async () => (await adminApi.get<Course>(`/courses/${id}`)).data,
    enabled: Boolean(id),
  });

  const analysisQuery = useQuery({
    queryKey: ["admin", "analysis", id],
    queryFn: async () =>
      (await adminApi.get<{ report: AnalysisReport | null }>(`/analysis/courses/${id}`)).data.report,
    enabled: Boolean(id),
  });

  const runMutation = useMutation({
    mutationFn: async () =>
      (await adminApi.post<{ report: AnalysisReport }>(`/analysis/courses/${id}`)).data.report,
    onSuccess: (report) => {
      queryClient.setQueryData(["admin", "analysis", id], report);
      queryClient.invalidateQueries({ queryKey: ["admin", "analysis-summary"] });
      toast.success("Analiz tamamlandı.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Analiz çalıştırılamadı."));
    },
  });

  const course = courseQuery.data;
  const report = analysisQuery.data;
  const fullResult = report && !report.result.insufficient_data ? report.result : null;

  const handleExportPdf = async () => {
    if (!exportRef.current || !course) return;
    setExportingPdf(true);
    try {
      await exportElementToPdf(exportRef.current, `${course.code} ${course.term} müfredat analizi`);
    } catch (error) {
      toast.error(getErrorMessage(error, "PDF oluşturulamadı."));
    } finally {
      setExportingPdf(false);
    }
  };

  if (courseQuery.isLoading || analysisQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Ders bulunamadı</AlertTitle>
        <AlertDescription>Ders silinmiş veya bağlantı hatalı olabilir.</AlertDescription>
      </Alert>
    );
  }

  const running = runMutation.isPending;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/admin/dersler" />}>
        <ArrowLeft className="size-4" />
        Dersler
      </Button>

      <div ref={exportRef} className="space-y-6 bg-background">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {course.code} · {course.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {course.term}
              {course.instructor && ` · ${course.instructor}`}
              {report && ` · Son analiz: ${formatDateTime(report.createdAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" data-pdf-skip="true">
            {fullResult && (
              <Button variant="outline" onClick={handleExportPdf} disabled={exportingPdf || running}>
                <FileText className="size-4" />
                {exportingPdf ? "Hazırlanıyor..." : "PDF indir"}
              </Button>
            )}
            <Button onClick={() => runMutation.mutate()} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : report ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
              {running ? "Analiz ediliyor..." : report ? "Analizi yenile" : "Analizi çalıştır"}
            </Button>
          </div>
        </div>

        {analysisQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>Analiz yüklenemedi</AlertTitle>
            <AlertDescription>{getErrorMessage(analysisQuery.error, "Lütfen tekrar deneyin.")}</AlertDescription>
          </Alert>
        )}

        {report?.stale && (
          <Alert data-pdf-skip="true">
            <TriangleAlert className="size-4" />
            <AlertTitle>Analiz güncel değil</AlertTitle>
            <AlertDescription>Bu analizden sonra yeni cevaplar geldi. Güncel sonuç için analizi yenileyin.</AlertDescription>
          </Alert>
        )}

        {!report && !analysisQuery.isError && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground" aria-hidden />
              <div className="font-medium">Bu ders için henüz analiz yapılmadı</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Analiz; öğrenci geri bildirimlerinden müfredat konularına göre iyileştirme önerisi, yorum duygu ve
                tema analizi, öğrenci segmentleri ve dönemler arası trendi çıkarır.
              </p>
            </CardContent>
          </Card>
        )}

        {report?.result.insufficient_data && (
          <Alert>
            <ShieldAlert className="size-4" />
            <AlertTitle>Yeterli cevap yok</AlertTitle>
            <AlertDescription>
              Bu derste {report.result.n_responses} cevap var. Öğrenci gizliliğini korumak için (KVKK) en az{" "}
              {report.result.min_responses} cevap olmadan analiz gösterilmez.
            </AlertDescription>
          </Alert>
        )}

        {fullResult && <AnalysisBody result={fullResult} />}
      </div>
    </div>
  );
}
