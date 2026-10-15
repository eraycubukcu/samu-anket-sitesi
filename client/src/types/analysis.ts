// ML servisinin /analyze cevabı. Sözleşme: docs/specs/faz-3-ml-servisi.md

export type Decision = "iyilestirme_gerekli" | "izlenmeli" | "gerek_yok";
export type Sentiment = "olumlu" | "notr" | "olumsuz";

export interface TopicResult {
  topic: string;
  decision: Decision;
  decision_text: string;
  probabilities: Record<Decision, number>;
  reasons: { feature: string; text: string; impact: number }[];
  dimension_means: Partial<Record<"icerik" | "sinav" | "materyal", number>>;
  features: Record<string, number>;
}

export interface Theme {
  id: number;
  keywords: string[];
  size: number;
  dominant_sentiment: Sentiment;
  sentiment_counts: Partial<Record<Sentiment, number>>;
  examples: string[];
}

export interface Segments {
  k: number;
  silhouette: number;
  clusters: { id: number; name: string; size: number; profile: Record<string, number> }[];
  points: { x: number; y: number; cluster: number }[];
}

export interface TermPoint {
  term: string;
  mean: number | null;
  dimension_means: Record<string, number>;
  n_responses: number;
}

export interface TopicChange {
  topic: string;
  previous_mean: number;
  mean: number;
  delta: number;
  p_value: number;
  significant: boolean;
}

export interface Anomaly {
  dimension: string;
  value: number;
  benchmark_mean: number;
  z: number;
  text: string;
}

export interface InsufficientResult {
  insufficient_data: true;
  n_responses: number;
  min_responses: number;
}

export interface FullResult {
  insufficient_data: false;
  n_responses: number;
  course: { code: string; name: string; term: string; topics: string[] };
  model: {
    version: string;
    decision_model: string;
    metrics?: { macro_f1: number | null; sentiment_handwritten_accuracy: number | null };
  };
  overall: {
    decision: Decision;
    decision_text: string;
    max_improvement_probability: number;
    flagged_topics: string[];
    watch_topics: string[];
    summary: string;
  };
  topics: TopicResult[];
  sentiment: { total: number; counts: Record<Sentiment, number> };
  themes: Theme[];
  segments: Segments | null;
  trend: { terms: TermPoint[]; topic_changes: TopicChange[] };
  anomalies: Anomaly[];
}

export interface AnalysisReport {
  result: InsufficientResult | FullResult;
  modelVersion: string;
  nResponses: number;
  createdAt: string;
  stale: boolean;
}

export interface AnalysisSummaryItem {
  course: string;
  decision: Decision | null;
  flaggedTopics: string[];
  insufficientData: boolean;
  createdAt: string;
}
