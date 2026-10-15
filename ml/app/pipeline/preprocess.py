"""Türkçe yorumlar için hafif ön işleme (ağır NLP bağımlılığı olmadan)."""

from __future__ import annotations

import re
from collections import Counter

# Türkçe karakterleri ASCII'ye katlar: "anlaşılmadı" ve "anlasilmadi" aynı
# token'a düşsün (öğrencilerin bir kısmı Türkçe karakter kullanmıyor).
_FOLD = str.maketrans("İIıŞşĞğÜüÖöÇç", "iiissgguuoocc")
_TOKEN_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = {
    "ve", "ile", "bir", "bu", "su", "o", "da", "de", "ki", "mi", "mu", "ama", "fakat", "ancak",
    "icin", "gibi", "cok", "daha", "en", "her", "hep", "hic", "ne", "biraz", "bence", "acikcasi",
    "kisaca", "genel", "olarak", "tesekkurler", "lutfen", "dikkate", "alin", "ders", "dersin",
    "derste", "konu", "konusu", "konusunda", "kismi", "kisminda", "ilgili", "olan", "oldu",
    "olabilirdi", "idi", "ise", "sey", "seyler", "ben", "biz", "bana", "bize",
}

# Uzun eklerden kısalara doğru denenir. Olumsuzluk eki (-ma/-me) kırpılmaz ki
# "anlasilmadi" -> "anlasilma" olarak olumsuz anlamını korusun.
_SUFFIXES = sorted(
    {
        "larindan", "lerinden", "lari", "leri", "lar", "ler", "nin", "nun", "in", "un",
        "inda", "inde", "unda", "dan", "den", "tan", "ten", "da", "de", "ta", "te",
        "yi", "yu", "di", "du", "ti", "tu", "mis", "mus", "ydi", "ydu", "si", "su",
    },
    key=len,
    reverse=True,
)
_MIN_STEM = 4


def fold(text: str) -> str:
    return text.translate(_FOLD).lower()


def tr_capitalize(text: str) -> str:
    # str.capitalize() "iş" -> "Iş" yapar; Türkçede "İş" olmalı
    first = {"i": "İ", "ı": "I"}.get(text[:1], text[:1].upper())
    return first + text[1:]


def stem(token: str) -> str:
    for suffix in _SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= _MIN_STEM:
            return token[: -len(suffix)]
    return token


def tokenize(text: str) -> list[str]:
    """Katlanmış, stopword'süz, kökü bulunmuş token listesi."""
    return [stem(t) for t in _TOKEN_RE.findall(fold(text)) if t not in STOPWORDS and len(t) > 1]


def normalize(text: str) -> str:
    """Duygu modeli girdisi: katlanmış ve sadeleştirilmiş metin (stopword'ler korunur)."""
    return " ".join(_TOKEN_RE.findall(fold(text)))


def display_words(texts: list[str]) -> dict[str, str]:
    """Kök -> metinlerde en sık görülen orijinal kelime (temaları okunur göstermek için)."""
    by_stem: dict[str, Counter] = {}
    for text in texts:
        for word in re.findall(r"\w+", text.lower()):
            folded = fold(word)
            if folded in STOPWORDS or len(folded) <= 1:
                continue
            by_stem.setdefault(stem(folded), Counter())[word] += 1
    return {s: c.most_common(1)[0][0] for s, c in by_stem.items()}
