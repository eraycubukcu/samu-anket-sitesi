"""Analiz isteğindeki ham anket verisini analiz yapılarına dönüştürür.

Soru yorumlama kuralları için bkz. docs/specs/faz-3-ml-servisi.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.pipeline.features import GENERAL_DIMENSIONS, TOPIC_DIMENSIONS, TopicUnit, attribute_comment

DIFFICULTY_OPTION_COUNT = 5


@dataclass
class TermData:
    """Bir dönemin ayrıştırılmış verisi."""

    topics: list[str]
    n_responses: int
    # (konu, boyut) -> puanlar; konu "" ise ders geneli
    ratings: dict[tuple[str, str], list[int]] = field(default_factory=dict)
    difficulty: list[int] = field(default_factory=list)
    hardest_counts: dict[str, int] = field(default_factory=dict)
    comments: list[str] = field(default_factory=list)
    # Öğrenci × puanlama sorusu matrisi (eksik cevap = NaN) ve sütun bilgileri
    matrix: np.ndarray | None = None
    columns: list[tuple[str, str]] = field(default_factory=list)

    def topic_ratings(self, topic: str) -> dict[str, list[int]]:
        return {d: self.ratings.get((topic, d), []) for d in TOPIC_DIMENSIONS}

    def general_ratings(self) -> dict[str, list[int]]:
        return {d: self.ratings.get(("", d), []) for d in GENERAL_DIMENSIONS}

    def dimension_means(self) -> dict[str, float]:
        out = {}
        for d in TOPIC_DIMENSIONS + GENERAL_DIMENSIONS:
            values = [r for (_, dim), rs in self.ratings.items() if dim == d for r in rs]
            if values:
                out[d] = round(float(np.mean(values)), 2)
        return out

    def overall_mean(self) -> float | None:
        values = [r for rs in self.ratings.values() for r in rs]
        return round(float(np.mean(values)), 2) if values else None


def _as_int_rating(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if 1 <= number <= 5 else None


def parse_term(topics: list[str], questions: list[dict], responses: list[dict]) -> TermData:
    topic_set = set(topics)
    data = TermData(topics=topics, n_responses=len(responses))

    rating_qs, difficulty_qs, hardest_qs, text_qs = [], [], [], []
    for q in questions:
        qtype, topic, dim = q["type"], q.get("topic") or "", q.get("dimension") or ""
        if qtype == "rating":
            if dim in TOPIC_DIMENSIONS and topic in topic_set:
                rating_qs.append((q["id"], (topic, dim)))
            elif dim in GENERAL_DIMENSIONS:
                rating_qs.append((q["id"], ("", dim)))
        elif qtype == "radio" and dim == "sinav" and not topic and len(q.get("options", [])) == DIFFICULTY_OPTION_COUNT:
            difficulty_qs.append(q)
        elif qtype == "checkbox" and q.get("options") and set(q["options"]) <= topic_set:
            hardest_qs.append(q["id"])
        elif qtype == "text":
            text_qs.append(q["id"])

    data.columns = [key for _, key in rating_qs]
    matrix = np.full((len(responses), len(rating_qs)), np.nan)

    for row, response in enumerate(responses):
        answers = response.get("answers", {})
        for col, (qid, key) in enumerate(rating_qs):
            rating = _as_int_rating(answers.get(qid))
            if rating is not None:
                data.ratings.setdefault(key, []).append(rating)
                matrix[row, col] = rating
        for q in difficulty_qs:
            value = answers.get(q["id"])
            if value in q["options"]:
                data.difficulty.append(q["options"].index(value) + 1)
        chosen = set()
        for qid in hardest_qs:
            value = answers.get(qid)
            if isinstance(value, list):
                chosen.update(v for v in value if v in topic_set)
        for t in chosen:
            data.hardest_counts[t] = data.hardest_counts.get(t, 0) + 1
        for qid in text_qs:
            value = answers.get(qid)
            if isinstance(value, str) and value.strip():
                data.comments.append(value.strip())

    data.matrix = matrix
    return data


def build_topic_units(
    term: TermData,
    sentiments: list[str],
    previous: TermData | None = None,
) -> list[TopicUnit]:
    """Her konu için TopicUnit üretir. `sentiments`, term.comments ile aynı sırada olmalı."""
    comment_topics = [attribute_comment(c, term.topics) for c in term.comments]
    units = []
    for topic in term.topics:
        prev_mean = None
        if previous is not None:
            prev_values = [r for rs in previous.topic_ratings(topic).values() for r in rs]
            prev_mean = float(np.mean(prev_values)) if prev_values else None
        units.append(
            TopicUnit(
                topic=topic,
                ratings=term.topic_ratings(topic),
                general=term.general_ratings(),
                topic_sentiments=[s for s, ts in zip(sentiments, comment_topics) if topic in ts],
                course_sentiments=list(sentiments),
                hardest_rate=term.hardest_counts.get(topic, 0) / term.n_responses if term.n_responses else 0.0,
                difficulty=term.difficulty,
                n_responses=term.n_responses,
                prev_topic_mean=prev_mean,
            )
        )
    return units
