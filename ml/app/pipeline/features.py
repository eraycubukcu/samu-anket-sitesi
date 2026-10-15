"""Ders × dönem × konu birimi için model özelliklerini hesaplar.

Eğitim verisi (data/generate_synthetic.py) ve canlı analiz (Faz 3, ML servisi)
aynı fonksiyonu kullanır; böylece eğitimde ve tahminde özellikler birebir aynı
şekilde hesaplanır.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

TOPIC_DIMENSIONS = ("icerik", "sinav", "materyal")
GENERAL_DIMENSIONS = ("ogretim", "is_yuku")
SENTIMENTS = ("olumlu", "notr", "olumsuz")

FEATURE_NAMES = [
    "mean_icerik",
    "mean_sinav",
    "mean_materyal",
    "mean_ogretim",
    "mean_is_yuku",
    "topic_std",
    "low_ratio",
    "neg_comment_ratio",
    "hardest_rate",
    "difficulty_mean",
    "trend",
    "n_responses",
]

# Konuya özel yorum bu sayının altındaysa ders geneli yorumlar kullanılır
MIN_TOPIC_COMMENTS = 3
NEUTRAL_RATING = 3.0


@dataclass
class TopicUnit:
    """Bir konunun analiz için ham verisi."""

    topic: str
    # Konuya özel puanlar: boyut -> puan listesi
    ratings: dict[str, list[int]] = field(default_factory=dict)
    # Ders geneli puanlar (ogretim, is_yuku): aynı dersin tüm konularında ortak
    general: dict[str, list[int]] = field(default_factory=dict)
    topic_sentiments: list[str] = field(default_factory=list)
    course_sentiments: list[str] = field(default_factory=list)
    # Bu konuyu "en çok zorlandığım konular" arasında seçenlerin oranı
    hardest_rate: float = 0.0
    # Sınav zorluk algısı, 1 (çok kolay) - 5 (çok zor)
    difficulty: list[int] = field(default_factory=list)
    n_responses: int = 0
    # Önceki dönemde aynı konunun ortalama puanı (yoksa None)
    prev_topic_mean: float | None = None


def _mean(values, default=NEUTRAL_RATING):
    return sum(values) / len(values) if values else default


def _std(values):
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / (len(values) - 1))


def topic_ratings(unit: TopicUnit) -> list[int]:
    return [r for dim in TOPIC_DIMENSIONS for r in unit.ratings.get(dim, [])]


def topic_mean(unit: TopicUnit) -> float:
    return _mean(topic_ratings(unit))


def negative_ratio(sentiments: list[str]) -> float:
    if not sentiments:
        return 0.0
    return sum(1 for s in sentiments if s == "olumsuz") / len(sentiments)


def compute_features(unit: TopicUnit) -> dict[str, float]:
    all_topic = topic_ratings(unit)
    sentiments = (
        unit.topic_sentiments
        if len(unit.topic_sentiments) >= MIN_TOPIC_COMMENTS
        else unit.course_sentiments
    )
    current_mean = _mean(all_topic)

    return {
        "mean_icerik": _mean(unit.ratings.get("icerik", [])),
        "mean_sinav": _mean(unit.ratings.get("sinav", [])),
        "mean_materyal": _mean(unit.ratings.get("materyal", [])),
        "mean_ogretim": _mean(unit.general.get("ogretim", [])),
        "mean_is_yuku": _mean(unit.general.get("is_yuku", [])),
        "topic_std": _std(all_topic),
        "low_ratio": (sum(1 for r in all_topic if r <= 2) / len(all_topic)) if all_topic else 0.0,
        "neg_comment_ratio": negative_ratio(sentiments),
        "hardest_rate": unit.hardest_rate,
        "difficulty_mean": _mean(unit.difficulty),
        "trend": 0.0 if unit.prev_topic_mean is None else current_mean - unit.prev_topic_mean,
        "n_responses": float(unit.n_responses),
    }


def _fold(text: str) -> str:
    """Türkçe karakter ve büyük/küçük harf farkını yok sayarak karşılaştırma için."""
    table = str.maketrans("İIıŞşĞğÜüÖöÇç", "iiissgguuoocc")
    return text.translate(table).lower()


def attribute_comment(text: str, topics: list[str]) -> list[str]:
    """Yorumda adı geçen konuları döner (yorum → konu eşlemesi)."""
    folded = _fold(text)
    return [t for t in topics if _fold(t) in folded]
