"""Analiz orkestrasyonu: istek -> karar, duygu, tema, segment, trend, anomali."""

from __future__ import annotations

from collections import Counter

from app.config import MIN_RESPONSES
from app.pipeline.builder import parse_term
from app.pipeline.builder import build_topic_units
from app.pipeline.decision import LABEL_TEXT, predict_with_reasons
from app.pipeline.features import SENTIMENTS, compute_features
from app.pipeline.segments import segment_students
from app.pipeline.sentiment import predict_sentiments
from app.pipeline.themes import extract_themes
from app.pipeline.trend import detect_anomalies, term_trend, topic_changes
from app.schemas import AnalyzeRequest


def _dump(items) -> list[dict]:
    return [i.model_dump() for i in items]


def _overall(topic_results: list[dict]) -> dict:
    flagged = [t["topic"] for t in topic_results if t["decision"] == "iyilestirme_gerekli"]
    watch = [t["topic"] for t in topic_results if t["decision"] == "izlenmeli"]
    max_prob = max((t["probabilities"].get("iyilestirme_gerekli", 0.0) for t in topic_results), default=0.0)

    if flagged:
        decision = "iyilestirme_gerekli"
        summary = f"{len(flagged)} konuda müfredat iyileştirmesi öneriliyor: {', '.join(flagged)}."
    elif watch:
        decision = "izlenmeli"
        summary = f"Acil iyileştirme gerekmiyor; {len(watch)} konu izlenmeli: {', '.join(watch)}."
    else:
        decision = "gerek_yok"
        summary = "Geri bildirimler müfredatta değişiklik gerektiren bir sorun göstermiyor."

    return {
        "decision": decision,
        "decision_text": LABEL_TEXT[decision],
        "max_improvement_probability": round(max_prob, 3),
        "flagged_topics": flagged,
        "watch_topics": watch,
        "summary": summary,
    }


def run_analysis(req: AnalyzeRequest, decision_bundle: dict, sentiment_bundle: dict) -> dict:
    n = len(req.responses)
    if n < MIN_RESPONSES:
        return {"insufficient_data": True, "n_responses": n, "min_responses": MIN_RESPONSES}

    topics = req.course.topics
    current = parse_term(topics, _dump(req.questions), _dump(req.responses))
    history = [(p.term, parse_term(topics, _dump(p.questions), _dump(p.responses))) for p in req.previous_terms]
    previous = history[-1][1] if history else None

    sentiments = predict_sentiments(sentiment_bundle["model"], current.comments)
    units = build_topic_units(current, sentiments, previous)
    features = [compute_features(u) for u in units]
    predictions = predict_with_reasons(decision_bundle, features)

    topic_results = []
    for unit, feats, pred in zip(units, features, predictions):
        topic_results.append(
            {
                "topic": unit.topic,
                **pred,
                "decision_text": LABEL_TEXT[pred["decision"]],
                "dimension_means": {
                    d: round(feats[f"mean_{d}"], 2) for d in ("icerik", "sinav", "materyal") if unit.ratings.get(d)
                },
                "features": {k: round(v, 4) for k, v in feats.items()},
            }
        )

    counts = Counter(sentiments)
    return {
        "insufficient_data": False,
        "n_responses": n,
        "course": req.course.model_dump(),
        "model": {
            "version": decision_bundle.get("version"),
            "decision_model": decision_bundle.get("model_name"),
        },
        "overall": _overall(topic_results),
        "topics": topic_results,
        "sentiment": {"total": len(sentiments), "counts": {s: counts.get(s, 0) for s in SENTIMENTS}},
        "themes": extract_themes(current.comments, sentiments),
        "segments": segment_students(current.matrix, current.columns),
        "trend": {
            "terms": term_trend(history + [(req.course.term, current)]),
            "topic_changes": topic_changes(current, previous),
        },
        "anomalies": detect_anomalies(current, req.benchmarks),
    }
