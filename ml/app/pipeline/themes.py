"""Yorumlarda tekrar eden temaları bulur: TF-IDF + NMF (konu modelleme)."""

from __future__ import annotations

import math
from collections import Counter

import numpy as np
from sklearn.decomposition import NMF
from sklearn.feature_extraction.text import TfidfVectorizer

from app.config import RANDOM_STATE
from app.pipeline.preprocess import display_words, tokenize

MIN_COMMENTS = 10
MAX_THEMES = 5
KEYWORDS_PER_THEME = 6
EXAMPLES_PER_THEME = 3


def _add_keyword(keywords: list[str], term: str) -> None:
    """Tekrarı önler: "hızlı" varken "hızlı geçildi" gelirse onunla değiştirir,
    "hızlı geçildi" varken "geçildi" gelirse atlar."""
    words = set(term.split())
    for i, existing in enumerate(keywords):
        existing_words = set(existing.split())
        if words <= existing_words:
            return
        if existing_words <= words:
            keywords[i] = term
            # Değişiklik sonrası oluşabilecek kopyaları temizle
            seen = []
            for k in keywords:
                if k not in seen:
                    seen.append(k)
            keywords[:] = seen
            return
    keywords.append(term)


def extract_themes(texts: list[str], sentiments: list[str]) -> list[dict]:
    if len(texts) < MIN_COMMENTS:
        return []

    vectorizer = TfidfVectorizer(tokenizer=tokenize, lowercase=False, token_pattern=None,
                                 ngram_range=(1, 2), min_df=2, max_df=0.6)
    try:
        matrix = vectorizer.fit_transform(texts)
    except ValueError:  # min_df sonrası hiç kelime kalmadıysa
        return []
    if matrix.shape[1] < 4:
        return []

    k = max(2, min(MAX_THEMES, round(math.sqrt(len(texts) / 4)), matrix.shape[1] - 1))
    nmf = NMF(n_components=k, init="nndsvda", random_state=RANDOM_STATE, max_iter=500)
    doc_topic = nmf.fit_transform(matrix)
    vocab = vectorizer.get_feature_names_out()
    readable = display_words(texts)

    assignments = doc_topic.argmax(axis=1)
    themes = []
    for theme_id in range(k):
        members = np.where((assignments == theme_id) & (doc_topic.max(axis=1) > 0))[0]
        if len(members) == 0:
            continue

        keywords: list[str] = []
        for idx in nmf.components_[theme_id].argsort()[::-1]:
            _add_keyword(keywords, " ".join(readable.get(part, part) for part in vocab[idx].split()))
            if len(keywords) == KEYWORDS_PER_THEME:
                break

        # Temayı en iyi temsil eden yorumlar örnek olarak seçilir
        best = members[np.argsort(doc_topic[members, theme_id])[::-1]]
        counts = Counter(sentiments[i] for i in members)
        themes.append(
            {
                "id": theme_id,
                "keywords": keywords,
                "size": int(len(members)),
                "dominant_sentiment": counts.most_common(1)[0][0],
                "sentiment_counts": dict(counts),
                "examples": [texts[i] for i in best[:EXAMPLES_PER_THEME]],
            }
        )

    themes.sort(key=lambda t: t["size"], reverse=True)
    return themes
