import { AlertTriangle, CheckCircle2, Eye, type LucideIcon } from "lucide-react";
import type { Decision, Sentiment } from "@/types/analysis";

// Karar = durum rengi. Renk tek başına anlam taşımasın diye her zaman ikon + etiketle kullanılır.
export const DECISION_META: Record<Decision, { label: string; icon: LucideIcon; color: string }> = {
  iyilestirme_gerekli: { label: "İyileştirme gerekli", icon: AlertTriangle, color: "var(--viz-critical)" },
  izlenmeli: { label: "İzlenmeli", icon: Eye, color: "var(--viz-warning)" },
  gerek_yok: { label: "Gerek yok", icon: CheckCircle2, color: "var(--viz-good)" },
};

export const SENTIMENT_META: Record<Sentiment, { label: string; color: string }> = {
  olumsuz: { label: "Olumsuz", color: "var(--viz-div-neg)" },
  notr: { label: "Nötr", color: "var(--viz-div-mid)" },
  olumlu: { label: "Olumlu", color: "var(--viz-div-pos)" },
};

export const SERIES_COLORS = ["var(--viz-series-1)", "var(--viz-series-2)", "var(--viz-series-3)"];

// 1-5 puanı iraksak skalaya çevirir: 1 = tam kırmızı, 3 = nötr gri, 5 = tam mavi
export function divergingColor(value: number) {
  const t = Math.max(-1, Math.min(1, (value - 3) / 2));
  const pole = t < 0 ? "var(--viz-div-neg)" : "var(--viz-div-pos)";
  return `color-mix(in oklab, ${pole} ${Math.round(Math.abs(t) * 100)}%, var(--viz-div-mid))`;
}

// Koyu hücre üstünde beyaz, açık hücre üstünde koyu yazı
export function divergingInk(value: number) {
  return Math.abs(value - 3) / 2 > 0.55 ? "#ffffff" : "var(--foreground)";
}

export function formatPercent(value: number) {
  return `%${Math.round(value * 100)}`;
}

export function formatDecimal(value: number, digits = 2) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
