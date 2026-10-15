from app.pipeline.builder import build_topic_units, parse_term
from app.pipeline.features import FEATURE_NAMES, attribute_comment, compute_features
from app.pipeline.preprocess import fold, normalize, stem, tokenize


def test_fold_unifies_turkish_and_ascii():
    assert fold("ANLAŞILMADI İyi") == fold("anlasilmadi iyi") == "anlasilmadi iyi"


def test_stem_keeps_negation():
    # "-ma" olumsuzluk eki kırpılmamalı
    assert stem("anlasilmadi") == "anlasilma"
    assert stem("slaytlari") == "slayt"


def test_tokenize_drops_stopwords():
    tokens = tokenize("Bence bu konu çok iyi anlatıldı ve slaytlar güzeldi")
    assert "bence" not in tokens and "ve" not in tokens
    assert "slayt" in tokens


def test_normalize_is_plain_folded_text():
    assert normalize("Sınav, ÇOK zordu!") == "sinav cok zordu"


def test_attribute_comment_ignores_case_and_diacritics():
    topics = ["Dinamik programlama", "Graf algoritmaları"]
    assert attribute_comment("graf algoritmalari hic anlasilmadi", topics) == ["Graf algoritmaları"]


QUESTIONS = [
    {"id": "a", "type": "rating", "topic": "T1", "dimension": "icerik", "options": []},
    {"id": "b", "type": "rating", "topic": "T1", "dimension": "sinav", "options": []},
    {"id": "c", "type": "rating", "topic": "", "dimension": "ogretim", "options": []},
    {"id": "d", "type": "radio", "topic": "", "dimension": "sinav",
     "options": ["Çok kolay", "Kolay", "Orta", "Zor", "Çok zor"]},
    {"id": "e", "type": "checkbox", "topic": "", "dimension": "icerik", "options": ["T1", "T2"]},
    {"id": "f", "type": "text", "topic": "", "dimension": "", "options": []},
    # Konusu dersin listesinde olmayan soru yok sayılmalı
    {"id": "g", "type": "rating", "topic": "Bilinmeyen", "dimension": "icerik", "options": []},
]
RESPONSES = [
    {"answers": {"a": 1, "b": 2, "c": 4, "d": "Çok zor", "e": ["T1"], "f": "T1 hiç anlaşılmadı", "g": 5}},
    {"answers": {"a": 3, "b": "geçersiz", "c": 5, "d": "Orta", "e": ["T1", "T2"]}},
]


def test_parse_term_maps_questions():
    term = parse_term(["T1", "T2"], QUESTIONS, RESPONSES)
    assert term.ratings[("T1", "icerik")] == [1, 3]
    assert term.ratings[("T1", "sinav")] == [2]  # geçersiz değer atlandı
    assert term.ratings[("", "ogretim")] == [4, 5]
    assert term.difficulty == [5, 3]
    assert term.hardest_counts == {"T1": 2, "T2": 1}
    assert term.comments == ["T1 hiç anlaşılmadı"]
    assert ("Bilinmeyen", "icerik") not in term.ratings
    assert term.matrix.shape == (2, 3)


def test_features_from_payload():
    term = parse_term(["T1", "T2"], QUESTIONS, RESPONSES)
    units = build_topic_units(term, ["olumsuz"])
    t1 = compute_features(units[0])
    assert list(t1) == FEATURE_NAMES
    assert t1["mean_icerik"] == 2.0
    assert t1["hardest_rate"] == 1.0
    assert t1["difficulty_mean"] == 4.0
    assert t1["low_ratio"] == 2 / 3
    assert t1["neg_comment_ratio"] == 1.0  # konuya özel yorum az -> ders geneli kullanıldı
    # Hiç puanı olmayan konu nötr varsayılanla döner
    assert compute_features(units[1])["mean_icerik"] == 3.0
