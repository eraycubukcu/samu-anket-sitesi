"""Karar ve duygu modellerini eğitir, metrikleri ve raporu yazar.

Kullanım (ml/ klasöründen):  python -m app.train
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

from app.config import (
    DATA_DIR,
    DECISION_MODEL_PATH,
    METRICS_PATH,
    MODELS_DIR,
    RANDOM_STATE,
    REPORTS_DIR,
    SENTIMENT_MODEL_PATH,
)
from app.pipeline.decision import LABEL_TEXT, LABELS, train_decision_model
from app.pipeline.sentiment import build_sentiment_pipeline

# Şablonlarda geçmeyen, elle yazılmış yorumlar. Sentetik veride duygu modelinin
# başarısı yapay olarak yüksek çıkar; bu set gerçek hayata ne kadar genelleştiğini
# kabaca gösterir.
HANDWRITTEN = [
    ("Hocanın anlattığı hiçbir şey kafama girmedi, çok kötü bir dönemdi", "olumsuz"),
    ("Final sınavı derste gördüklerimizle alakasızdı", "olumsuz"),
    ("Kaynak kitap yoktu, internetten kendimiz bulmaya çalıştık", "olumsuz"),
    ("Laboratuvar saatleri yetersiz kaldı, uygulama yapamadık", "olumsuz"),
    ("Proje teslim tarihleri çok sıkışıktı, uyku uyuyamadık", "olumsuz"),
    ("Ders gerçekten çok öğreticiydi, emeği geçenlere teşekkürler", "olumlu"),
    ("Hoca konuları örneklerle açıkladığı için rahat anladım", "olumlu"),
    ("Sınav adildi, çalışan herkes geçebilirdi", "olumlu"),
    ("Paylaşılan notlar çok derli topluydu, işimi kolaylaştırdı", "olumlu"),
    ("Bu dönem aldığım en keyifli dersti", "olumlu"),
    ("Ders ortalama geçti, özel bir yorumum yok", "notr"),
    ("Bazı haftalar iyiydi bazı haftalar sıkıcıydı", "notr"),
    ("Konular normal hızda işlendi", "notr"),
    ("Sınav beklediğim zorluktaydı", "notr"),
    ("Ek kaynak verilirse daha iyi olabilir", "notr"),
]


def _pct(x: float) -> str:
    return f"%{x * 100:.1f}"


def train_sentiment(df: pd.DataFrame) -> tuple[object, dict]:
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["label"], test_size=0.2, stratify=df["label"], random_state=RANDOM_STATE
    )
    evaluated = build_sentiment_pipeline().fit(X_train, y_train)
    y_pred = evaluated.predict(X_test)

    hw_text, hw_label = zip(*HANDWRITTEN)
    hw_pred = evaluated.predict(list(hw_text))

    metrics = {
        "test_accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "test_macro_f1": round(float(f1_score(y_test, y_pred, average="macro")), 4),
        "handwritten_accuracy": round(float(accuracy_score(hw_label, hw_pred)), 4),
        "handwritten_examples": [
            {"text": t, "label": lbl, "predicted": str(p)} for t, lbl, p in zip(hw_text, hw_label, hw_pred)
        ],
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }
    final = build_sentiment_pipeline().fit(df["text"], df["label"])
    return final, metrics


def write_report(metrics: dict) -> None:
    d, s = metrics["decision"], metrics["sentiment"]
    cm_labels = d["confusion_matrix"]["labels"]
    lines = [
        "# Model Raporu",
        "",
        f"Eğitim zamanı: {metrics['version']}  ",
        "Veri: `ml/data/generated/` (sentetik, `data/generate_synthetic.py --seed 42`)",
        "",
        "> **Not:** Modeller sentetik veriyle eğitildi. Etiketler, gözlenen puanlardan değil, simülasyondaki gizli "
        "kalite değerlerinden ve %8 gürültüyle üretildi. Bu yüzden skorlar, modelin gözlenen veriden gizli durumu "
        "ne kadar iyi tahmin ettiğini gösterir. Gerçek öğrenci verisinde ayrıca doğrulanmalıdır.",
        "",
        "## 1. Müfredat iyileştirme karar modeli",
        "",
        "### Model karşılaştırması (eğitim setinde 5 katlı CV, macro-F1)",
        "",
        "| Model | Ortalama | Std |",
        "|---|---|---|",
        *[
            f"| {name}{' ✅' if name == d['selected'] else ''} | {c['cv_macro_f1_mean']:.3f} | {c['cv_macro_f1_std']:.3f} |"
            for name, c in d["candidates"].items()
        ],
        "",
        f"Seçilen model: **{d['selected']}**. Test seti ({d['n_test']} satır): macro-F1 **{d['test_macro_f1']:.3f}**, "
        f"doğruluk **{_pct(d['test_accuracy'])}**.",
        "",
        "### Karışıklık matrisi (satır: gerçek, sütun: tahmin)",
        "",
        "| | " + " | ".join(LABEL_TEXT[label] for label in cm_labels) + " |",
        "|---|" + "---|" * len(cm_labels),
        *[
            f"| **{LABEL_TEXT[label]}** | " + " | ".join(str(v) for v in row) + " |"
            for label, row in zip(cm_labels, d["confusion_matrix"]["matrix"])
        ],
        "",
        "### Sınıf bazında",
        "",
        "| Sınıf | Precision | Recall | F1 |",
        "|---|---|---|---|",
        *[
            f"| {LABEL_TEXT[label]} | {d['classification_report'][label]['precision']:.3f} | "
            f"{d['classification_report'][label]['recall']:.3f} | {d['classification_report'][label]['f1-score']:.3f} |"
            for label in LABELS
        ],
        "",
        "### Özellik önemi (test setinde permutation importance, macro-F1 düşüşü)",
        "",
        "| Özellik | Önem | Std |",
        "|---|---|---|",
        *[f"| `{p['feature']}` | {p['mean']:.4f} | {p['std']:.4f} |" for p in d["permutation_importance"]],
        "",
        "## 2. Yorum duygu analizi",
        "",
        f"- Sentetik test seti ({s['n_test']} yorum): doğruluk **{_pct(s['test_accuracy'])}**, "
        f"macro-F1 **{s['test_macro_f1']:.3f}**",
        f"- Elle yazılmış, şablonlarda olmayan {len(s['handwritten_examples'])} yorum: doğruluk "
        f"**{_pct(s['handwritten_accuracy'])}**",
        "",
        "Sentetik test seti, eğitimdeki şablonlardan üretildiği için skor iyimserdir. Elle yazılmış set, gerçek "
        "yorumlara genellemenin daha dürüst bir göstergesidir.",
        "",
        "| Yorum | Gerçek | Tahmin |",
        "|---|---|---|",
        *[
            f"| {e['text']} | {e['label']} | {e['predicted']}{'' if e['label'] == e['predicted'] else ' ❌'} |"
            for e in s["handwritten_examples"]
        ],
        "",
    ]
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "model_raporu.md").write_text("\n".join(lines), encoding="utf-8")


def train_all() -> dict:
    decision_csv, comments_csv = DATA_DIR / "decision_train.csv", DATA_DIR / "comments_labeled.csv"
    if not decision_csv.exists() or not comments_csv.exists():
        raise FileNotFoundError(
            f"Eğitim verisi bulunamadı ({DATA_DIR}). Önce: python data/generate_synthetic.py --seed 42"
        )

    version = datetime.now(timezone.utc).isoformat(timespec="seconds")
    decision_bundle, decision_metrics = train_decision_model(pd.read_csv(decision_csv))
    sentiment_model, sentiment_metrics = train_sentiment(pd.read_csv(comments_csv))

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({**decision_bundle, "version": version}, DECISION_MODEL_PATH)
    joblib.dump({"model": sentiment_model, "version": version}, SENTIMENT_MODEL_PATH)

    metrics = {"version": version, "decision": decision_metrics, "sentiment": sentiment_metrics}
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(metrics)
    return metrics


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    m = train_all()
    d, s = m["decision"], m["sentiment"]
    print(f"Karar modeli: {d['selected']}  test macro-F1={d['test_macro_f1']:.3f}  doğruluk={d['test_accuracy']:.3f}")
    for name, c in d["candidates"].items():
        print(f"  CV {name}: {c['cv_macro_f1_mean']:.3f} ± {c['cv_macro_f1_std']:.3f}")
    print(f"Duygu modeli: sentetik test doğruluk={s['test_accuracy']:.3f}  elle yazılmış={s['handwritten_accuracy']:.3f}")
    print(f"Rapor: {REPORTS_DIR / 'model_raporu.md'}")


if __name__ == "__main__":
    main()
