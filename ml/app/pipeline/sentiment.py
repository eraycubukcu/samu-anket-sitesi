"""Türkçe yorum duygu analizi: TF-IDF (kelime + karakter n-gram) + LogisticRegression."""

from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

from app.config import RANDOM_STATE
from app.pipeline.preprocess import normalize


def build_sentiment_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "features",
                FeatureUnion(
                    [
                        ("word", TfidfVectorizer(preprocessor=normalize, ngram_range=(1, 2), min_df=2)),
                        # Karakter n-gram'ları Türkçe eklerini (ör. "-madı", "-siz") yakalar
                        ("char", TfidfVectorizer(preprocessor=normalize, analyzer="char_wb",
                                                 ngram_range=(2, 5), min_df=2, sublinear_tf=True)),
                    ]
                ),
            ),
            ("clf", LogisticRegression(max_iter=2000, C=4.0, random_state=RANDOM_STATE)),
        ]
    )


def predict_sentiments(model: Pipeline, texts: list[str]) -> list[str]:
    if not texts:
        return []
    return [str(label) for label in model.predict(texts)]
