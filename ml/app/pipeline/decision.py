"""Müfredat iyileştirme karar modeli: eğitim, model seçimi ve açıklamalı tahmin."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import RANDOM_STATE
from app.pipeline.features import FEATURE_NAMES

LABELS = ["iyilestirme_gerekli", "izlenmeli", "gerek_yok"]
LABEL_TEXT = {
    "iyilestirme_gerekli": "İyileştirme gerekli",
    "izlenmeli": "İzlenmeli",
    "gerek_yok": "Gerek yok",
}
TOP_REASONS = 3
# Karar gerekçesi olarak anlamlı olmayan özellikler (modelde kullanılır, açıklamada gösterilmez)
NON_EXPLANATORY = {"n_responses"}

CANDIDATES = {
    "random_forest": RandomForestClassifier(
        n_estimators=300, min_samples_leaf=3, class_weight="balanced", random_state=RANDOM_STATE
    ),
    "logistic_regression": Pipeline(
        [
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE)),
        ]
    ),
}

# Özellik -> (gerekçe metni şablonu). {v}: bu konunun değeri, {m}: eğitim ortancası
REASON_TEMPLATES = {
    "mean_icerik": "İçerik/anlaşılırlık ortalaması {v:.1f}/5 (genel ortanca {m:.1f})",
    "mean_sinav": "Sınavın konuyu yansıtma ortalaması {v:.1f}/5 (genel ortanca {m:.1f})",
    "mean_materyal": "Ders materyali ortalaması {v:.1f}/5 (genel ortanca {m:.1f})",
    "mean_ogretim": "Ders geneli anlatım puanı {v:.1f}/5 (genel ortanca {m:.1f})",
    "mean_is_yuku": "İş yükü uygunluğu puanı {v:.1f}/5 (genel ortanca {m:.1f})",
    "topic_std": "Puanlardaki dağılım σ={v:.2f} (genel ortanca {m:.2f})",
    "low_ratio": "Düşük puan (1-2) oranı %{vp:.0f} (genel ortanca %{mp:.0f})",
    "neg_comment_ratio": "Olumsuz yorum oranı %{vp:.0f} (genel ortanca %{mp:.0f})",
    "hardest_rate": "Öğrencilerin %{vp:.0f}'i bu konuyu en çok zorlandığı konular arasında seçti (genel ortanca %{mp:.0f})",
    "difficulty_mean": "Sınav zorluk algısı {v:.1f}/5 (genel ortanca {m:.1f})",
    "trend": "Önceki döneme göre ortalama değişim {v:+.2f} puan",
    "n_responses": "Cevap sayısı {v:.0f}",
}


def train_decision_model(df: pd.DataFrame) -> tuple[dict, dict]:
    """Aday modelleri karşılaştırır, kazananı tüm veriyle eğitir.

    Dönüş: (model paketi, rapor metrikleri)
    """
    X, y = df[FEATURE_NAMES], df["label"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    cv_scores = {
        name: cross_val_score(clone(est), X_train, y_train, cv=cv, scoring="f1_macro")
        for name, est in CANDIDATES.items()
    }
    best_name = max(cv_scores, key=lambda n: cv_scores[n].mean())

    evaluated = clone(CANDIDATES[best_name]).fit(X_train, y_train)
    y_pred = evaluated.predict(X_test)
    perm = permutation_importance(
        evaluated, X_test, y_test, scoring="f1_macro", n_repeats=10, random_state=RANDOM_STATE
    )

    metrics = {
        "candidates": {
            n: {"cv_macro_f1_mean": round(float(s.mean()), 4), "cv_macro_f1_std": round(float(s.std()), 4)}
            for n, s in cv_scores.items()
        },
        "selected": best_name,
        "test_macro_f1": round(float(f1_score(y_test, y_pred, average="macro")), 4),
        "test_accuracy": round(float((y_pred == y_test).mean()), 4),
        "confusion_matrix": {
            "labels": LABELS,
            "matrix": confusion_matrix(y_test, y_pred, labels=LABELS).tolist(),
        },
        "classification_report": classification_report(y_test, y_pred, labels=LABELS, output_dict=True),
        "permutation_importance": sorted(
            (
                {"feature": f, "mean": round(float(m), 4), "std": round(float(s), 4)}
                for f, m, s in zip(FEATURE_NAMES, perm.importances_mean, perm.importances_std)
            ),
            key=lambda r: r["mean"],
            reverse=True,
        ),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }

    final_model = clone(CANDIDATES[best_name]).fit(X, y)
    bundle = {
        "model": final_model,
        "model_name": best_name,
        "feature_names": FEATURE_NAMES,
        "medians": {f: float(X[f].median()) for f in FEATURE_NAMES},
    }
    return bundle, metrics


def _reason_text(feature: str, value: float, median: float) -> str:
    template = REASON_TEMPLATES.get(feature, feature + ": {v:.2f}")
    return template.format(v=value, m=median, vp=value * 100, mp=median * 100)


def predict_with_reasons(bundle: dict, features: list[dict[str, float]]) -> list[dict]:
    """Her satır için karar, sınıf olasılıkları ve en etkili gerekçeler.

    Açıklama (yerel pertürbasyon): her özellik eğitim ortancasıyla değiştirilir,
    tahmin edilen sınıfın olasılığındaki düşüş o özelliğin katkısı sayılır.
    """
    if not features:
        return []
    model, names, medians = bundle["model"], bundle["feature_names"], bundle["medians"]
    X = pd.DataFrame(features, columns=names)
    classes = list(model.classes_)
    proba = model.predict_proba(X)

    results = []
    for i in range(len(X)):
        row = X.iloc[[i]]
        pred_idx = int(np.argmax(proba[i]))
        base = proba[i][pred_idx]

        perturbed = pd.concat([row] * len(names), ignore_index=True)
        for j, f in enumerate(names):
            perturbed.loc[j, f] = medians[f]
        impacts = base - model.predict_proba(perturbed)[:, pred_idx]

        reasons = [
            {
                "feature": names[j],
                "text": _reason_text(names[j], float(row.iloc[0][names[j]]), medians[names[j]]),
                "impact": round(float(impacts[j]), 3),
            }
            for j in np.argsort(impacts)[::-1]
            if impacts[j] > 0.005 and names[j] not in NON_EXPLANATORY
        ][:TOP_REASONS]
        results.append(
            {
                "decision": classes[pred_idx],
                "probabilities": {c: round(float(p), 3) for c, p in zip(classes, proba[i])},
                "reasons": reasons,
            }
        )
    return results
