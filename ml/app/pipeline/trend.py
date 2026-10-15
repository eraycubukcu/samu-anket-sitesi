"""Dönemler arası değişim (Mann-Whitney U) ve diğer derslere göre anomali (z-skor)."""

from __future__ import annotations

import numpy as np
from scipy.stats import mannwhitneyu

from app.pipeline.builder import TermData
from app.pipeline.preprocess import tr_capitalize
from app.pipeline.segments import DIMENSION_LABELS

SIGNIFICANCE = 0.05
# Aynı dönemdeki ders sayısı az olduğu için 2σ yerine 1.5σ eşiği kullanılır
ANOMALY_Z = 1.5
MIN_BENCHMARKS = 3


def term_trend(terms: list[tuple[str, TermData]]) -> list[dict]:
    """Eskiden yeniye sıralı dönemler için ortalama puan zaman serisi."""
    return [
        {"term": name, "mean": data.overall_mean(), "dimension_means": data.dimension_means(),
         "n_responses": data.n_responses}
        for name, data in terms
    ]


def topic_changes(current: TermData, previous: TermData | None) -> list[dict]:
    if previous is None:
        return []
    changes = []
    for topic in current.topics:
        now = [r for rs in current.topic_ratings(topic).values() for r in rs]
        before = [r for rs in previous.topic_ratings(topic).values() for r in rs]
        if len(now) < 5 or len(before) < 5:
            continue
        p_value = float(mannwhitneyu(now, before, alternative="two-sided").pvalue)
        mean_now, mean_before = float(np.mean(now)), float(np.mean(before))
        changes.append(
            {
                "topic": topic,
                "previous_mean": round(mean_before, 2),
                "mean": round(mean_now, 2),
                "delta": round(mean_now - mean_before, 2),
                "p_value": round(p_value, 4),
                "significant": p_value < SIGNIFICANCE,
            }
        )
    return changes


def detect_anomalies(current: TermData, benchmarks: dict[str, list[float]]) -> list[dict]:
    anomalies = []
    for dim, value in current.dimension_means().items():
        others = benchmarks.get(dim) or []
        if len(others) < MIN_BENCHMARKS:
            continue
        mean, std = float(np.mean(others)), float(np.std(others, ddof=1))
        if std == 0:
            continue
        z = (value - mean) / std
        if abs(z) >= ANOMALY_Z:
            direction = "altında" if z < 0 else "üstünde"
            anomalies.append(
                {
                    "dimension": dim,
                    "value": value,
                    "benchmark_mean": round(mean, 2),
                    "z": round(z, 2),
                    "text": f"{tr_capitalize(DIMENSION_LABELS.get(dim, dim))} puanı ({value:.2f}), aynı dönemdeki "
                            f"diğer derslerin ortalamasının ({mean:.2f}) {abs(z):.1f}σ {direction}.",
                }
            )
    return anomalies
