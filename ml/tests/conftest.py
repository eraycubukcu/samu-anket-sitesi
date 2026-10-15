import json
import os
import sys
from pathlib import Path

import pytest

ML_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_DIR))
os.environ.setdefault("ML_SERVICE_TOKEN", "test-token")

DEMO_PATH = ML_DIR / "data" / "generated" / "demo_dataset.json"
TERM_ORDER = ["2025-Bahar", "2025-Güz", "2026-Bahar"]


@pytest.fixture(scope="session")
def demo_dataset():
    if not DEMO_PATH.exists():
        pytest.skip("Demo veri seti yok: python data/generate_synthetic.py --seed 42")
    return json.loads(DEMO_PATH.read_text(encoding="utf-8"))


def _term_payload(dataset, code, term):
    """Bir ders-dönemin anketini /analyze formatına çevirir (Faz 4'te Node'un yapacağı iş)."""
    course = next(c for c in dataset["courses"] if c["code"] == code and c["term"] == term)
    survey = next(s for s in dataset["surveys"] if s["courseKey"] == course["key"])
    questions = [
        {"id": q["key"], "type": q["questionType"], "topic": q["topic"],
         "dimension": q["dimension"], "options": q["options"]}
        for q in survey["questions"]
    ]
    responses = [
        {"respondent": r["studentKey"], "answers": {a["questionKey"]: a["answer"] for a in r["answers"]}}
        for r in dataset["responses"]
        if r["surveyKey"] == survey["key"]
    ]
    return course, questions, responses


def _dimension_means(questions, responses):
    by_dim = {}
    qdim = {q["id"]: q["dimension"] for q in questions if q["type"] == "rating"}
    for r in responses:
        for qid, value in r["answers"].items():
            if qid in qdim:
                by_dim.setdefault(qdim[qid], []).append(value)
    return {d: sum(v) / len(v) for d, v in by_dim.items()}


@pytest.fixture(scope="session")
def build_payload(demo_dataset):
    def _build(code, term):
        course, questions, responses = _term_payload(demo_dataset, code, term)
        previous = [
            {"term": t, "questions": q, "responses": r}
            for t in TERM_ORDER[: TERM_ORDER.index(term)]
            for _, q, r in [_term_payload(demo_dataset, code, t)]
        ]
        benchmarks = {}
        for other in demo_dataset["courses"]:
            if other["term"] == term and other["code"] != code:
                _, oq, orr = _term_payload(demo_dataset, other["code"], term)
                for d, m in _dimension_means(oq, orr).items():
                    benchmarks.setdefault(d, []).append(m)
        return {
            "course": {"code": code, "name": course["name"], "term": term, "topics": course["topics"]},
            "questions": questions,
            "responses": responses,
            "previous_terms": previous,
            "benchmarks": benchmarks,
        }

    return _build
