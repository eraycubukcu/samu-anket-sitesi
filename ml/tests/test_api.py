import pytest
from fastapi.testclient import TestClient

from app.config import DECISION_MODEL_PATH
from app.main import app

AUTH = {"X-ML-Token": "test-token"}

# Faz 2'de bilerek sorunlu bırakılan konular (docs/specs/faz-2-sentetik-veri.md)
PLANTED_PROBLEMS = [
    ("BIL301", "Dinamik programlama"),
    ("BIL305", "Normalizasyon"),
    ("MAT201", "Özdeğerler"),
    ("BIL401", "Sinir ağları"),
    ("BIL203", "Graf algoritmaları"),
]

client = TestClient(app)
requires_model = pytest.mark.skipif(
    not DECISION_MODEL_PATH.exists(), reason="Model yok: python -m app.train"
)


def test_health_is_public():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.parametrize("headers", [{}, {"X-ML-Token": "yanlis"}])
def test_analyze_requires_token(headers):
    res = client.post("/analyze", json={"course": {"code": "X"}, "questions": [], "responses": []}, headers=headers)
    assert res.status_code == 401


@requires_model
def test_insufficient_data_hides_analysis():
    payload = {
        "course": {"code": "X", "term": "t", "topics": ["A"]},
        "questions": [{"id": "q", "type": "rating", "topic": "A", "dimension": "icerik"}],
        "responses": [{"answers": {"q": 1}}] * 4,
    }
    res = client.post("/analyze", json=payload, headers=AUTH)
    assert res.status_code == 200
    assert res.json() == {"insufficient_data": True, "n_responses": 4, "min_responses": 5}


@requires_model
@pytest.mark.parametrize("code,topic", PLANTED_PROBLEMS)
def test_planted_problems_are_flagged(build_payload, code, topic):
    res = client.post("/analyze", json=build_payload(code, "2026-Bahar"), headers=AUTH)
    assert res.status_code == 200
    body = res.json()
    result = next(t for t in body["topics"] if t["topic"] == topic)
    assert result["decision"] == "iyilestirme_gerekli", result
    assert topic in body["overall"]["flagged_topics"]
    assert result["reasons"], "karar gerekçesiz olmamalı"


@requires_model
def test_full_analysis_shape(build_payload):
    body = client.post("/analyze", json=build_payload("BIL301", "2026-Bahar"), headers=AUTH).json()
    assert body["insufficient_data"] is False
    assert len(body["topics"]) == 4
    for t in body["topics"]:
        assert abs(sum(t["probabilities"].values()) - 1) < 0.01
    assert sum(body["sentiment"]["counts"].values()) == body["sentiment"]["total"] > 0
    assert body["themes"] and all(th["keywords"] for th in body["themes"])
    assert body["segments"]["k"] >= 2
    assert len(body["segments"]["points"]) == body["n_responses"]
    assert [t["term"] for t in body["trend"]["terms"]] == ["2025-Bahar", "2025-Güz", "2026-Bahar"]
    assert body["trend"]["topic_changes"]
    assert body["model"]["decision_model"] in ("random_forest", "logistic_regression")


@requires_model
def test_first_term_has_no_trend(build_payload):
    body = client.post("/analyze", json=build_payload("BIL101", "2025-Bahar"), headers=AUTH).json()
    assert body["trend"]["topic_changes"] == []
    assert len(body["trend"]["terms"]) == 1
