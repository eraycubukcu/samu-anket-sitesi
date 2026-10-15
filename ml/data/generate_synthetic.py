"""Sentetik ders değerlendirme verisi üretir.

Çıktılar (ml/data/generated/):
  demo_dataset.json     -> server/scripts/seedDemoData.js bunu MongoDB'ye yükler
  decision_train.csv    -> müfredat iyileştirme karar modeli eğitim verisi
  comments_labeled.csv  -> duygu analizi eğitim verisi
  ground_truth.csv      -> demo derslerin gizli etiketleri (doğrulama için)

Kullanım (ml/ klasöründen):
  python data/generate_synthetic.py --seed 42
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ML_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_DIR))

from app.pipeline.features import (  # noqa: E402
    FEATURE_NAMES,
    GENERAL_DIMENSIONS,
    TOPIC_DIMENSIONS,
    TopicUnit,
    attribute_comment,
    compute_features,
    topic_mean,
)

OUT_DIR = ML_DIR / "data" / "generated"
LABELS = ("iyilestirme_gerekli", "izlenmeli", "gerek_yok")
TR_TZ = timezone(timedelta(hours=3))

# ---------------------------------------------------------------------------
# Ders kataloğu
# ---------------------------------------------------------------------------

COURSES = [
    ("BIL101", "Programlamaya Giriş", "Bilgisayar Mühendisliği", "Dr. Öğr. Üyesi Ayşe Yılmaz",
     ["Değişkenler ve veri tipleri", "Koşullar ve döngüler", "Fonksiyonlar", "Diziler"]),
    ("BIL203", "Veri Yapıları", "Bilgisayar Mühendisliği", "Doç. Dr. Mehmet Kaya",
     ["Bağlı listeler", "Yığın ve kuyruk", "Ağaç yapıları", "Graf algoritmaları"]),
    ("BIL301", "Algoritma Analizi", "Bilgisayar Mühendisliği", "Prof. Dr. Ali Demir",
     ["Zaman karmaşıklığı", "Böl ve yönet", "Dinamik programlama", "Açgözlü algoritmalar"]),
    ("BIL305", "Veritabanı Sistemleri", "Bilgisayar Mühendisliği", "Dr. Öğr. Üyesi Zeynep Çelik",
     ["İlişkisel model", "SQL sorguları", "Normalizasyon", "İşlem yönetimi"]),
    ("BIL307", "İşletim Sistemleri", "Bilgisayar Mühendisliği", "Doç. Dr. Hasan Öztürk",
     ["Süreç yönetimi", "İş parçacıkları", "Bellek yönetimi", "Dosya sistemleri"]),
    ("BIL311", "Bilgisayar Ağları", "Bilgisayar Mühendisliği", "Dr. Öğr. Üyesi Elif Arslan",
     ["OSI modeli", "TCP/IP", "Yönlendirme", "Ağ güvenliği"]),
    ("BIL401", "Yapay Zeka", "Bilgisayar Mühendisliği", "Prof. Dr. Burak Şahin",
     ["Arama algoritmaları", "Bilgi gösterimi", "Makine öğrenmesine giriş", "Sinir ağları"]),
    ("MAT201", "Lineer Cebir", "Matematik", "Doç. Dr. Selin Aydın",
     ["Matrisler", "Determinantlar", "Vektör uzayları", "Özdeğerler"]),
]

# (dönem, sınav tarihi). Hepsi geçmişte: anketler kapanmış, sonuçlar analiz edilebilir.
TERMS = [
    ("2025-Bahar", datetime(2025, 6, 10, 10, 0, tzinfo=TR_TZ)),
    ("2025-Güz", datetime(2026, 1, 14, 10, 0, tzinfo=TR_TZ)),
    ("2026-Bahar", datetime(2026, 6, 12, 10, 0, tzinfo=TR_TZ)),
]

# Demo hikâyesi için bilinçli sorunlar: (ders, konu) -> {boyut: latent kalite}.
# İlk dönemden itibaren uygulanır, sonraki dönemlerde drift ile değişebilir.
DEMO_PROBLEMS = {
    ("BIL301", "Dinamik programlama"): {"sinav": 1.8, "icerik": 2.4},
    ("BIL203", "Graf algoritmaları"): {"icerik": 2.6, "materyal": 2.5},
    ("BIL305", "Normalizasyon"): {"materyal": 1.9},
    ("BIL401", "Sinir ağları"): {"icerik": 2.3, "sinav": 2.6},
    ("MAT201", "Özdeğerler"): {"icerik": 2.5, "sinav": 2.2, "materyal": 2.6},
}
# Ders bazında dönemler arası kayma (negatif = kötüleşiyor)
DEMO_DRIFT = {"BIL203": -0.35, "BIL305": 0.0, "BIL101": 0.25, "BIL401": -0.2, "BIL311": 0.3}

FIRST_NAMES = [
    "Ahmet", "Mehmet", "Mustafa", "Emre", "Can", "Burak", "Murat", "Oğuz", "Kerem", "Yusuf",
    "Ali", "Hakan", "Deniz", "Berk", "Eren", "Furkan", "Onur", "Serkan", "Tolga", "Umut",
    "Ayşe", "Fatma", "Zeynep", "Elif", "Merve", "Büşra", "Esra", "Selin", "Ece", "Gizem",
    "İrem", "Melis", "Nazlı", "Seda", "Tuğba", "Yağmur", "Cansu", "Derya", "Ebru", "Şeyma",
]
LAST_NAMES = [
    "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın",
    "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan",
    "Şimşek", "Polat", "Korkmaz", "Erdoğan", "Güneş", "Aksoy", "Tekin", "Bulut", "Uçar",
]

# ---------------------------------------------------------------------------
# Yorum şablonları
# ---------------------------------------------------------------------------

TEMPLATES = {
    "olumsuz": {
        "icerik": [
            "{topic} konusu hiç anlaşılmadı",
            "{topic} çok hızlı geçildi, anlayamadım",
            "{topic} kısmında kafam çok karıştı",
            "{topic} anlatımı yetersizdi, örnek çok azdı",
            "{topic} konusunu derste kavrayamadık",
            "{topic} bence gereğinden fazla teorik kaldı, uygulama yoktu",
        ],
        "sinav": [
            "sınavdaki {topic} soruları derste işlenenden çok farklıydı",
            "{topic} ile ilgili sınav soruları aşırı zordu",
            "{topic} sorularına hazırlıklı değildik, benzer örnek çözülmedi",
            "sınavda {topic} sorularının süresi yetmedi",
            "{topic} sorulari adil degildi",
        ],
        "materyal": [
            "{topic} için kaynak bulamadık, slaytlar yetersizdi",
            "{topic} slaytları eksikti ve karışıktı",
            "{topic} konusunda ders notu yoktu",
            "{topic} için önerilen kitap anlaşılır değildi",
        ],
        "ogretim": [
            "hoca konuları çok hızlı anlattı",
            "derste soru sormaya fırsat verilmedi",
            "anlatım çok monoton ve sıkıcıydı",
            "derslere hazırlıksız gelindiğini düşünüyorum",
        ],
        "is_yuku": [
            "ödevler çok fazlaydı, yetiştiremedik",
            "haftalık iş yükü çok ağırdı",
            "proje ve ödev teslimleri üst üste geldi, çok yorucuydu",
        ],
    },
    "olumlu": {
        "icerik": [
            "{topic} konusu çok güzel anlatıldı",
            "{topic} kısmını rahatça anladım",
            "{topic} örneklerle iyi pekiştirildi",
            "{topic} dersin en verimli kısmıydı",
        ],
        "sinav": [
            "sınavdaki {topic} soruları derste işlenenlere uygundu",
            "{topic} soruları adil ve öğreticiydi",
            "{topic} sorulari beklentime uygundu",
        ],
        "materyal": [
            "{topic} slaytları çok faydalıydı",
            "{topic} için verilen kaynaklar yeterliydi",
            "{topic} ders notları çok düzenliydi",
        ],
        "ogretim": [
            "hocanın anlatımı çok akıcıydı",
            "hoca sorulara her zaman sabırla cevap verdi",
            "dersler keyifli ve verimli geçti",
        ],
        "is_yuku": [
            "iş yükü dengeliydi",
            "ödevler konuyu pekiştirmek için yeterli düzeydeydi",
        ],
    },
    "notr": {
        "icerik": [
            "{topic} konusu fena değildi ama biraz daha örnek olabilirdi",
            "{topic} orta seviyedeydi",
            "{topic} anlaşılırdı, bazı yerleri hızlı geçildi",
        ],
        "sinav": [
            "{topic} soruları ne kolay ne zordu",
            "sınavda {topic} kısmı beklediğim gibiydi",
        ],
        "materyal": [
            "{topic} için ek kaynak önerilse iyi olur",
            "{topic} slaytları idare ederdi",
        ],
        "ogretim": ["genel olarak idare ederdi", "anlatım normaldi"],
        "is_yuku": ["iş yükü normaldi", "ödev sayısı ortalamaydı"],
    },
}
PREFIXES = ["", "", "", "Açıkçası ", "Bence ", "Kısaca ", "Genel olarak "]
SUFFIXES = ["", "", "", ".", ". Teşekkürler.", ". Lütfen dikkate alın.", "!"]


def asciify(text: str) -> str:
    """Bazı öğrenciler Türkçe karakter kullanmadan yazar (gerçekçilik için)."""
    return text.translate(str.maketrans("ıİşŞğĞüÜöÖçÇ", "iIsSgGuUoOcC"))


def make_comment(rng: np.random.Generator, sentiment: str, dim: str, topic: str | None) -> str:
    pool = TEMPLATES[sentiment][dim]
    text = pool[rng.integers(len(pool))].format(topic=topic or "")
    text = PREFIXES[rng.integers(len(PREFIXES))] + text + SUFFIXES[rng.integers(len(SUFFIXES))]
    text = text[0].upper() + text[1:]
    if rng.random() < 0.1:
        text = asciify(text)
    if rng.random() < 0.15:
        text = text.lower()
    return text


# ---------------------------------------------------------------------------
# Simülasyon
# ---------------------------------------------------------------------------

DIFFICULTY_OPTIONS = ["Çok kolay", "Kolay", "Orta", "Zor", "Çok zor"]


def clip_rating(x: float) -> int:
    return int(min(5, max(1, round(x))))


def simulate_course_term(rng, topics, latent_topic, latent_general, n_students):
    """Bir ders-dönem için öğrenci cevaplarını simüle eder.

    latent_topic: {konu: {boyut: kalite}}, latent_general: {boyut: kalite}
    Dönüş: öğrenci başına kayıt listesi.
    """
    sinav_mean = np.mean([latent_topic[t]["sinav"] for t in topics])
    records = []
    for _ in range(n_students):
        bias = rng.normal(0, 0.45)
        ratings = {
            (t, d): clip_rating(latent_topic[t][d] + bias + rng.normal(0, 0.8))
            for t in topics
            for d in TOPIC_DIMENSIONS
        }
        general = {
            d: clip_rating(latent_general[d] + bias + rng.normal(0, 0.8)) for d in GENERAL_DIMENSIONS
        }
        difficulty = clip_rating(3 + (3.2 - sinav_mean) * 1.2 - bias * 0.5 + rng.normal(0, 0.8))

        hardest = [t for t in topics if ratings[(t, "icerik")] <= 2]
        if not hardest and rng.random() < 0.3:
            hardest = [min(topics, key=lambda t: ratings[(t, "icerik")])]

        comment = None
        if rng.random() < 0.55:
            items = [((t, d), r) for (t, d), r in ratings.items()]
            items += [((None, d), r) for d, r in general.items()]
            # Öğrenci ya en çok şikâyet ettiği ya da en beğendiği şey hakkında yazar.
            # Şikâyetler 2 kat ağırlıklı: memnuniyetsiz öğrenci yorum yazmaya daha yatkın.
            negatives = [x for x in items if x[1] <= 2]
            positives = [x for x in items if x[1] >= 4]
            weight_neg, weight_pos = 2 * len(negatives), len(positives)
            roll = rng.random()
            if (weight_neg or weight_pos) and rng.random() > 0.15:
                if roll < weight_neg / (weight_neg + weight_pos):
                    (topic, dim), _ = min(negatives, key=lambda x: x[1] + rng.random() * 0.5)
                    sentiment = "olumsuz"
                else:
                    (topic, dim), _ = max(positives, key=lambda x: x[1] + rng.random() * 0.5)
                    sentiment = "olumlu"
            else:
                sentiment = "notr"
                topic = topics[rng.integers(len(topics))]
                dim = TOPIC_DIMENSIONS[rng.integers(len(TOPIC_DIMENSIONS))]
            comment = (make_comment(rng, sentiment, dim, topic), sentiment)

        records.append(
            {
                "ratings": ratings,
                "general": general,
                "difficulty": difficulty,
                "hardest": hardest,
                "comment": comment,
            }
        )
    return records


def build_units(records, topics, prev_means=None):
    """Simüle kayıtlardan konu bazında TopicUnit listesi üretir."""
    prev_means = prev_means or {}
    course_sentiments = [r["comment"][1] for r in records if r["comment"]]
    units = []
    for t in topics:
        topic_sentiments = [
            r["comment"][1]
            for r in records
            if r["comment"] and t in attribute_comment(r["comment"][0], topics)
        ]
        units.append(
            TopicUnit(
                topic=t,
                ratings={d: [r["ratings"][(t, d)] for r in records] for d in TOPIC_DIMENSIONS},
                general={d: [r["general"][d] for r in records] for d in GENERAL_DIMENSIONS},
                topic_sentiments=topic_sentiments,
                course_sentiments=course_sentiments,
                hardest_rate=sum(1 for r in records if t in r["hardest"]) / len(records),
                difficulty=[r["difficulty"] for r in records],
                n_responses=len(records),
                prev_topic_mean=prev_means.get(t),
            )
        )
    return units


def true_label(rng, latent_topic_dims, latent_general, noise=0.08):
    """Gizli kural: etiket gözlenen puanlardan değil, latent kaliteden hesaplanır."""
    dims = [latent_topic_dims[d] for d in TOPIC_DIMENSIONS]
    score = 0.8 * np.mean(dims) + 0.2 * np.mean(list(latent_general.values()))
    weakest = min(dims)
    if score < 2.9 or weakest < 2.4:
        idx = 0
    elif score < 3.5:
        idx = 1
    else:
        idx = 2
    # Etiket gürültüsü (varsayılan %8): komşu sınıfa kaydır
    if noise and rng.random() < noise:
        idx = 1 if idx != 1 else (0 if rng.random() < 0.5 else 2)
    return LABELS[idx]


def random_latents(rng, topics):
    latent_topic = {t: {d: rng.uniform(2.0, 4.9) for d in TOPIC_DIMENSIONS} for t in topics}
    latent_general = {d: rng.uniform(2.2, 4.7) for d in GENERAL_DIMENSIONS}
    return latent_topic, latent_general


def drift_latents(rng, latent_topic, latent_general, drift):
    clamp = lambda x: float(min(4.9, max(1.3, x)))  # noqa: E731
    new_topic = {
        t: {d: clamp(v + drift + rng.normal(0, 0.25)) for d, v in dims.items()}
        for t, dims in latent_topic.items()
    }
    new_general = {d: clamp(v + drift * 0.5 + rng.normal(0, 0.2)) for d, v in latent_general.items()}
    return new_topic, new_general


# ---------------------------------------------------------------------------
# Eğitim havuzu (karar modeli için)
# ---------------------------------------------------------------------------


def generate_training_pool(rng, n_courses):
    rows = []
    for i in range(n_courses):
        topics = [f"Konu {i}-{k}" for k in range(4)]
        prev_topic, prev_general = random_latents(rng, topics)
        latent_topic, latent_general = drift_latents(
            rng, prev_topic, prev_general, rng.normal(0, 0.35)
        )
        has_prev = rng.random() < 0.7
        prev_means = None
        if has_prev:
            prev_records = simulate_course_term(
                rng, topics, prev_topic, prev_general, int(rng.integers(15, 70))
            )
            prev_means = {u.topic: topic_mean(u) for u in build_units(prev_records, topics)}

        records = simulate_course_term(rng, topics, latent_topic, latent_general, int(rng.integers(15, 70)))
        for unit in build_units(records, topics, prev_means):
            feats = compute_features(unit)
            feats["label"] = true_label(rng, latent_topic[unit.topic], latent_general)
            rows.append(feats)
    return rows


# ---------------------------------------------------------------------------
# Demo veri seti (MongoDB'ye yüklenecek)
# ---------------------------------------------------------------------------


def survey_questions(topics):
    """Anket şablonu. Her soru: key, metin, tip, seçenekler, konu, boyut."""
    qs = []
    for ti, t in enumerate(topics):
        qs.append((f"t{ti}_icerik", f"{t} konusu derste anlaşılır şekilde işlendi.", "rating", [], t, "icerik"))
        qs.append((f"t{ti}_sinav", f"Sınavdaki {t} soruları derste işlenenleri yansıttı.", "rating", [], t, "sinav"))
        qs.append((f"t{ti}_materyal", f"{t} için sağlanan ders materyali yeterliydi.", "rating", [], t, "materyal"))
    qs.append(("g_ogretim", "Öğretim üyesinin anlatımı açık ve anlaşılırdı.", "rating", [], "", "ogretim"))
    qs.append(("g_is_yuku", "Dersin iş yükü (ödev, proje, okuma) uygundu.", "rating", [], "", "is_yuku"))
    qs.append(("g_zorluk", "Sınavın zorluk seviyesini nasıl değerlendirirsiniz?", "radio", DIFFICULTY_OPTIONS, "", "sinav"))
    qs.append(("g_zor_konular", "En çok zorlandığınız konular hangileriydi?", "checkbox", list(topics), "", "icerik"))
    qs.append(("g_yorum", "Ders hakkındaki görüş ve önerileriniz", "text", [], "", ""))
    return [
        {
            "key": k,
            "questionText": text,
            "questionType": qtype,
            "options": opts,
            # Puanlama ve tek seçim zorunlu; çoklu seçim ve yorum opsiyonel
            "required": qtype in ("rating", "radio"),
            "topic": topic,
            "dimension": dim,
        }
        for k, text, qtype, opts, topic, dim in qs
    ]


def record_to_answers(record, topics):
    answers = []
    for ti, t in enumerate(topics):
        for d in TOPIC_DIMENSIONS:
            answers.append({"questionKey": f"t{ti}_{d}", "answer": record["ratings"][(t, d)]})
    answers.append({"questionKey": "g_ogretim", "answer": record["general"]["ogretim"]})
    answers.append({"questionKey": "g_is_yuku", "answer": record["general"]["is_yuku"]})
    answers.append({"questionKey": "g_zorluk", "answer": DIFFICULTY_OPTIONS[record["difficulty"] - 1]})
    if record["hardest"]:
        answers.append({"questionKey": "g_zor_konular", "answer": record["hardest"]})
    if record["comment"]:
        answers.append({"questionKey": "g_yorum", "answer": record["comment"][0]})
    return answers


def generate_demo(rng, n_students):
    students = []
    used = set()
    for i in range(n_students):
        while True:
            name = (FIRST_NAMES[rng.integers(len(FIRST_NAMES))], LAST_NAMES[rng.integers(len(LAST_NAMES))])
            if name not in used or len(used) >= len(FIRST_NAMES) * len(LAST_NAMES):
                used.add(name)
                break
        students.append({"key": f"s{i:03d}", "firstName": name[0], "lastName": name[1]})

    courses, surveys, responses, truth, comments = [], [], [], [], []

    for code, name, dept, instructor, topics in COURSES:
        latent_topic, latent_general = random_latents(rng, topics)
        # Demo sorunlu olmayan konular biraz daha iyi başlasın ki hikâye net olsun
        for t in topics:
            for d in TOPIC_DIMENSIONS:
                latent_topic[t][d] = max(latent_topic[t][d], 3.0)
            latent_topic[t].update(DEMO_PROBLEMS.get((code, t), {}))

        prev_means = None
        for term_idx, (term, exam_date) in enumerate(TERMS):
            if term_idx > 0:
                latent_topic, latent_general = drift_latents(
                    rng, latent_topic, latent_general, DEMO_DRIFT.get(code, 0.0)
                )
                # Sorunlu konular kendiliğinden düzelmesin
                for (c, t), dims in DEMO_PROBLEMS.items():
                    if c == code:
                        for d, v in dims.items():
                            latent_topic[t][d] = min(latent_topic[t][d], v + 0.3)

            course_key = f"{code}-{term}"
            courses.append(
                {"key": course_key, "code": code, "name": name, "department": dept,
                 "term": term, "instructor": instructor, "topics": topics}
            )

            n = int(rng.integers(25, 61))
            records = simulate_course_term(rng, topics, latent_topic, latent_general, n)
            chosen = rng.choice(n_students, size=n, replace=False)

            survey_key = f"survey-{course_key}"
            surveys.append(
                {
                    "key": survey_key,
                    "courseKey": course_key,
                    "title": f"{code} {name} - {term} Final Değerlendirmesi",
                    "description": f"{name} dersi {term} dönemi final sınavı sonrası değerlendirme anketi.",
                    "examDate": exam_date.isoformat(),
                    "questions": survey_questions(topics),
                }
            )
            for rec, s_idx in zip(records, chosen):
                created = exam_date + timedelta(hours=2, minutes=int(rng.integers(0, 600)))
                responses.append(
                    {
                        "surveyKey": survey_key,
                        "studentKey": students[s_idx]["key"],
                        "createdAt": created.isoformat(),
                        "answers": record_to_answers(rec, topics),
                    }
                )
                if rec["comment"]:
                    comments.append(rec["comment"])

            units = build_units(records, topics, prev_means)
            for unit in units:
                truth.append(
                    {"code": code, "term": term, "topic": unit.topic,
                     "label": true_label(rng, latent_topic[unit.topic], latent_general, noise=0),
                     **{f"latent_{d}": round(latent_topic[unit.topic][d], 2) for d in TOPIC_DIMENSIONS}}
                )
            prev_means = {u.topic: topic_mean(u) for u in units}

    dataset = {
        "students": students,
        "courses": courses,
        "surveys": surveys,
        "responses": responses,
    }
    return dataset, truth, comments


def generate_comment_pool(rng, n):
    """Duygu modeli için ek etiketli yorumlar (demo verisinden bağımsız konu isimleriyle)."""
    all_topics = [t for *_, topics in COURSES for t in topics]
    out = []
    for _ in range(n):
        sentiment = ("olumlu", "notr", "olumsuz")[rng.integers(3)]
        dims = list(TEMPLATES[sentiment].keys())
        dim = dims[rng.integers(len(dims))]
        out.append((make_comment(rng, sentiment, dim, all_topics[rng.integers(len(all_topics))]), sentiment))
    return out


def write_csv(path, rows, fieldnames):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    # Windows konsolunda Türkçe karakterler bozulmasın
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--students", type=int, default=400)
    parser.add_argument("--train-courses", type=int, default=450, help="Eğitim havuzundaki simüle ders sayısı (×4 konu)")
    parser.add_argument("--extra-comments", type=int, default=3000)
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    dataset, truth, demo_comments = generate_demo(rng, args.students)
    with open(OUT_DIR / "demo_dataset.json", "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=1)
    write_csv(OUT_DIR / "ground_truth.csv", truth, list(truth[0].keys()))

    train_rows = generate_training_pool(rng, args.train_courses)
    for row in train_rows:
        for k in FEATURE_NAMES:
            row[k] = round(row[k], 4)
    write_csv(OUT_DIR / "decision_train.csv", train_rows, FEATURE_NAMES + ["label"])

    comment_rows = [{"text": t, "label": s} for t, s in demo_comments + generate_comment_pool(rng, args.extra_comments)]
    write_csv(OUT_DIR / "comments_labeled.csv", comment_rows, ["text", "label"])

    label_counts = {lbl: sum(1 for r in train_rows if r["label"] == lbl) for lbl in LABELS}
    demo_counts = {lbl: sum(1 for r in truth if r["label"] == lbl) for lbl in LABELS}
    print(f"Demo: {len(dataset['courses'])} ders-dönem, {len(dataset['surveys'])} anket, "
          f"{len(dataset['responses'])} cevap, {len(dataset['students'])} öğrenci")
    print(f"Demo etiket dağılımı: {demo_counts}")
    print(f"Eğitim: {len(train_rows)} satır, etiket dağılımı: {label_counts}")
    print(f"Yorum: {len(comment_rows)} etiketli yorum")
    print(f"Çıktı klasörü: {OUT_DIR}")


if __name__ == "__main__":
    main()
