"""Öğrenci segmentasyonu: puan vektörleri üzerinde KMeans + 2B PCA görselleştirme."""

from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

from app.config import RANDOM_STATE
from app.pipeline.preprocess import tr_capitalize

MIN_RESPONDENTS = 10
K_RANGE = range(2, 5)
# Grup ortalaması genel ortalamadan bu kadar saparsa isimlendirmede dikkate alınır
NAME_THRESHOLD = 0.25

DIMENSION_LABELS = {
    "icerik": "ders içeriği",
    "sinav": "sınav",
    "materyal": "ders materyali",
    "ogretim": "anlatım",
    "is_yuku": "iş yükü",
}


def _groups(columns: list[tuple[str, str]]) -> dict[str, list[int]]:
    """Sütunları anlamlı gruplara ayırır: her konu ve her ders geneli boyut."""
    groups: dict[str, list[int]] = {}
    for i, (topic, dim) in enumerate(columns):
        groups.setdefault(f"konu:{topic}" if topic else f"boyut:{dim}", []).append(i)
    return groups


def _group_label(key: str) -> str:
    kind, value = key.split(":", 1)
    return f"'{value}' konusunda" if kind == "konu" else f"{DIMENSION_LABELS.get(value, value)} konusunda"


def _complaint(key: str) -> str:
    # Konu için "zorlananlar", ders geneli boyut (anlatım, iş yükü) için "memnuniyetsiz olanlar"
    return "zorlananlar" if key.startswith("konu:") else "memnuniyetsiz olanlar"


def _name_cluster(deviations: dict[str, float]) -> str:
    values = list(deviations.values())
    if all(v > NAME_THRESHOLD for v in values):
        return "Genel olarak memnun"
    if all(v < -NAME_THRESHOLD for v in values):
        return "Genel olarak memnuniyetsiz"
    worst_key = min(deviations, key=deviations.get)
    if deviations[worst_key] < -NAME_THRESHOLD:
        return tr_capitalize(f"{_group_label(worst_key)} {_complaint(worst_key)}")
    best_key = max(deviations, key=deviations.get)
    if deviations[best_key] > NAME_THRESHOLD:
        return tr_capitalize(f"{_group_label(best_key)} memnun")
    return "Ortalama görüşte"


def segment_students(matrix: np.ndarray | None, columns: list[tuple[str, str]]) -> dict | None:
    if matrix is None or matrix.shape[0] < MIN_RESPONDENTS or matrix.shape[1] < 2:
        return None

    # Eksik cevaplar sütun ortalamasıyla doldurulur
    col_means = np.nanmean(matrix, axis=0)
    col_means = np.where(np.isnan(col_means), 3.0, col_means)
    X = np.where(np.isnan(matrix), col_means, matrix)
    if np.allclose(X.std(axis=0), 0):
        return None

    best = None
    for k in K_RANGE:
        if k >= X.shape[0]:
            break
        model = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE).fit(X)
        if len(set(model.labels_)) < 2:
            continue
        score = silhouette_score(X, model.labels_)
        if best is None or score > best[0]:
            best = (score, k, model)
    if best is None:
        return None

    score, k, model = best
    groups = _groups(columns)
    overall = {g: float(X[:, idx].mean()) for g, idx in groups.items()}

    clusters, used_names = [], {}
    for cid in range(k):
        members = X[model.labels_ == cid]
        profile = {g: round(float(members[:, idx].mean()), 2) for g, idx in groups.items()}
        name = _name_cluster({g: profile[g] - overall[g] for g in groups})
        used_names[name] = used_names.get(name, 0) + 1
        if used_names[name] > 1:
            name = f"{name} ({used_names[name]})"
        clusters.append({"id": cid, "name": name, "size": int(len(members)), "profile": profile})

    coords = PCA(n_components=2, random_state=RANDOM_STATE).fit_transform(X)
    points = [
        {"x": round(float(x), 3), "y": round(float(y), 3), "cluster": int(c)}
        for (x, y), c in zip(coords, model.labels_)
    ]
    clusters.sort(key=lambda c: c["size"], reverse=True)
    return {"k": k, "silhouette": round(float(score), 3), "clusters": clusters, "points": points}
