# Faz 3 — ML Servisi (FastAPI + scikit-learn)

İlgili plan: [`docs/plan.md`](../plan.md) §2.2–2.5, §3

## Amaç
Bir dersin anket cevaplarını alıp şunları dönen bağımsız bir Python servisi:
- Konu bazında **müfredat iyileştirme kararı** (olasılık ve gerekçeleriyle)
- Yorum **duygu analizi**
- **Tema çıkarımı**
- **Öğrenci segmentleri**
- **Dönemler arası trend**
- Diğer derslere göre **anomaliler**

## Yapı
```
ml/app/
  main.py          FastAPI: /health, /analyze, /train
  config.py        yollar, env (ML_SERVICE_TOKEN)
  schemas.py       pydantic istek/cevap modelleri
  analyze.py       analiz orkestrasyonu
  train.py         python -m app.train -> models/*.joblib, models/metrics.json, reports/model_raporu.md
  pipeline/
    preprocess.py  Türkçe normalizasyon, stopword, basit sonek kırpma
    features.py    (Faz 2) TopicUnit -> özellikler
    builder.py     istek payload'u -> TopicUnit'ler ve öğrenci vektörleri
    sentiment.py   TF-IDF (kelime + karakter n-gram) + LogisticRegression
    themes.py      TF-IDF + NMF
    segments.py    KMeans (k = silhouette ile 2–3) + PCA
    decision.py    RandomForest vs LogisticRegression, yerel açıklama
    trend.py       Mann-Whitney U, z-skor anomali
```

## Kimlik doğrulama
- `ML_SERVICE_TOKEN` env değişkeni zorunludur; yoksa servis başlamaz.
- `/analyze` ve `/train`, `X-ML-Token` başlığı ister; yanlış veya eksikse 401.
- `/health` açıktır.

## `/analyze` sözleşmesi

### İstek
```json
{
  "course": { "code": "BIL301", "name": "Algoritma Analizi", "term": "2026-Bahar",
              "topics": ["Zaman karmaşıklığı", "Dinamik programlama"] },
  "questions": [
    { "id": "q1", "type": "rating",   "topic": "Dinamik programlama", "dimension": "sinav", "options": [] },
    { "id": "q2", "type": "radio",    "topic": "", "dimension": "sinav",
      "options": ["Çok kolay", "Kolay", "Orta", "Zor", "Çok zor"] },
    { "id": "q3", "type": "checkbox", "topic": "", "dimension": "icerik",
      "options": ["Zaman karmaşıklığı", "Dinamik programlama"] },
    { "id": "q4", "type": "text",     "topic": "", "dimension": "", "options": [] }
  ],
  "responses": [
    { "respondent": "a1b2c3", "answers": { "q1": 2, "q2": "Zor", "q3": ["Dinamik programlama"], "q4": "..." } }
  ],
  "previous_terms": [ { "term": "2025-Güz", "questions": [], "responses": [] } ],
  "benchmarks": { "materyal": [3.8, 4.1, 3.5] }
}
```

`respondent` Node tarafında hash'lenmiş bir kimliktir; ad ve e-posta asla gönderilmez. `previous_terms` eskiden yeniye sıralıdır ve opsiyoneldir. `benchmarks`, aynı dönemdeki diğer derslerin boyut ortalamalarıdır ve opsiyoneldir.

### Soru yorumlama kuralları
| Soru | Kullanım |
|---|---|
| `rating` + konu + boyut ∈ {icerik, sinav, materyal} | Konuya özel puan |
| `rating` + boyut ∈ {ogretim, is_yuku} | Ders geneli puan |
| `radio` + boyut `sinav` + konusuz + 5 seçenek | Sınav zorluk algısı (seçenek sırası 1–5) |
| `checkbox` + seçenekler dersin konuları | "En çok zorlanılan konu" oranı |
| `text` | Yorum: duygu, tema ve konu eşlemesi (konu adı geçiyorsa) |

### Cevap
```json
{
  "insufficient_data": false,
  "n_responses": 33,
  "model": { "version": "2026-10-15T...", "decision_model": "random_forest", "metrics": { "macro_f1": 0.78 } },
  "overall": { "decision": "iyilestirme_gerekli", "max_improvement_probability": 0.91,
               "flagged_topics": ["Dinamik programlama"], "summary": "..." },
  "topics": [ { "topic": "...", "decision": "...", "probabilities": { "iyilestirme_gerekli": 0.91, "izlenmeli": 0.07, "gerek_yok": 0.02 },
                "reasons": [ { "feature": "mean_sinav", "text": "Sınav uyumu ortalaması 1.9/5 (genel ortanca 3.4)", "impact": 0.21 } ],
                "dimension_means": { "icerik": 1.8, "sinav": 1.9, "materyal": 3.6 }, "features": {} } ],
  "sentiment": { "total": 18, "counts": { "olumlu": 3, "notr": 4, "olumsuz": 11 } },
  "themes": [ { "id": 0, "keywords": ["sınav", "zor", "dinamik"], "size": 7, "dominant_sentiment": "olumsuz", "examples": ["..."] } ],
  "segments": { "k": 3, "silhouette": 0.31, "clusters": [ { "id": 0, "name": "...", "size": 12, "profile": {} } ],
                "points": [ { "x": 0.1, "y": -1.2, "cluster": 0 } ] },
  "trend": { "terms": [ { "term": "2025-Güz", "mean": 3.4, "dimension_means": {} } ],
             "topic_changes": [ { "topic": "...", "previous_mean": 3.1, "mean": 2.4, "delta": -0.7, "p_value": 0.003, "significant": true } ] },
  "anomalies": [ { "dimension": "materyal", "value": 2.6, "benchmark_mean": 3.8, "z": -2.1, "text": "..." } ]
}
```
Cevap sayısı 5'in altındaysa yalnızca `{"insufficient_data": true, "n_responses": N}` döner (KVKK: küçük grupta kimlik tahmini engellenir).

## Açıklanabilirlik
Her konu kararı için yerel pertürbasyon kullanılır: her özellik eğitim verisinin ortancasıyla değiştirilir ve tahmin edilen sınıfın olasılığındaki düşüş ölçülür. En çok etki eden 3 özellik, Türkçe gerekçe metniyle döner. Global önem için test setinde permutation importance hesaplanıp rapora yazılır.

## Eğitim ve rapor
- `python -m app.train` (veya `POST /train`): `data/generated/*.csv` ile iki model eğitilir.
- **Karar modeli:** %20 test ayrılır. Eğitim kısmında 5 katlı CV ile RandomForest ve LogisticRegression macro-F1'e göre karşılaştırılır. Kazanan model test setinde raporlanır, sonra tüm veriyle yeniden eğitilir.
- **Duygu modeli:** Test setine ek olarak, şablonlarda olmayan, elle yazılmış küçük bir "gerçekçi yorum" seti üzerinde de ölçülür. Sentetik şablonlarda başarının yapay olarak yüksek çıkacağı raporda açıkça belirtilir.
- **Çıktılar:**
  - `models/decision.joblib`, `models/sentiment.joblib`: gitignore'da, yeniden üretilebilir.
  - `models/metrics.json`, `reports/model_raporu.md`: commit edilir.

## Kabul Kriterleri
1. `pytest` geçer: ön işleme, payload → özellik, auth (401), yetersiz veri, uçtan uca analiz.
2. Demo verisinde bilerek sorunlu bırakılan konular (BIL301 Dinamik programlama, BIL305 Normalizasyon, MAT201 Özdeğerler, BIL401 Sinir ağları, BIL203 Graf algoritmaları) 2026-Bahar döneminde `iyilestirme_gerekli` çıkar.
3. Karar modeli test macro-F1 ≥ 0.70.
4. `start.bat` ML servisini de açar; `GET /health` model sürümünü döner.
5. Model yoksa `/analyze` 503 döner ve nasıl eğitileceğini söyler.
