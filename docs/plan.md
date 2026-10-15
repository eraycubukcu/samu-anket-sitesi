# Plan: Anket Sistemini "Veriye Dayalı Müfredat İyileştirme Platformu"na Dönüştürmek


## 1. Bağlam

Mevcut proje öğrencilerden ders/sınav değerlendirme anketi topluyor ve admin'e soru bazında basit istatistikler (ortalama, seçenek dağılımı), Excel ve PDF export sunuyor. Ancak:

- Veriler **tek tek anketler** olarak duruyor. Hangi derse, hangi döneme ya da hangi müfredat konusuna ait oldukları bilinmiyor (`Survey` modelinde ders bilgisi yok).
- Açık uçlu cevaplar yalnızca liste olarak gösteriliyor, yorumlanmıyor.
- "Bu derste neyi değiştirmeliyiz?" sorusuna sistem cevap vermiyor.

**Hedef:** BTK kursunun bitirme projesi olarak, toplanan geri bildirimleri işleyip **"Bu dersin müfredatında iyileştirme yapılmalı mı, yapılmalıysa hangi konularda?"** sorusuna makine öğrenmesiyle gerekçeli bir cevap veren bir modül eklemek. Bunu yaparken kursta öğrenilen Claude Code tekniklerini (plan modu, CLAUDE.md, spec-driven development, subagent'lar, skill'ler, MCP ile deploy, CronCreate, start.bat) projenin geliştirme sürecinde görünür şekilde kullanmak.

**Verilen kararlar:**
- ML kısmı **ayrı bir Python servisi** olacak (FastAPI + scikit-learn).
- Metin analizi **klasik NLP** ile yapılacak (LLM/Claude API yok).
- Gerçek veri olmadığı için **sentetik veri üreticisi** yazılacak.

---

## 2. Önerilen Özellikler

### 2.1 Temel veri modeli genişletmesi (ML'in ön şartı)
Analiz yapabilmek için anketlerin "neye ait olduğunu" bilmemiz gerekiyor.

- **Yeni `Course` modeli** (`server/models/Course.js`): `code` (ör. BIL301), `name`, `department`, `term` (ör. 2026-Güz), `instructor`, `topics: [String]` (müfredat konuları: "Veri yapıları", "Graf algoritmaları"…).
- **`Survey.course`**: `Course`'a referans (eski anketler için opsiyonel).
- **`Question.topic`**: Sorunun ilgili olduğu müfredat konusu (dersin `topics` listesinden seçilir).
- **`Question.dimension`**: Sorunun ölçtüğü boyut. Sabit liste: `icerik`, `ogretim`, `materyal`, `sinav`, `is_yuku`.
- Admin anket formuna (`AdminSurveyFormPage.tsx`) ders seçimi, soru bazında konu ve boyut seçimi eklenir. Yeni bir admin sayfası "Dersler" ile ders CRUD'u yapılır.
- `ALLOWED_SURVEY_FIELDS` listesi (`server/controllers/surveyController.js`) yeni alanlarla güncellenir.

### 2.2 ML Özellik 1: Müfredat İyileştirme Karar Modeli (sınıflandırma) ⭐ ana özellik
Her **ders × müfredat konusu** için bir karar üretir: **"İyileştirme gerekli" / "İzlenmeli" / "Gerek yok"**, olasılık değeriyle birlikte (ör. %82).

- **Girdi özellikleri (feature'lar):** boyut bazında ortalama puanlar, puanların varyansı, düşük puan (1-2) oranı, olumsuz yorum oranı (Özellik 2'den gelir), katılım oranı, önceki döneme göre değişim (trend), sınav zorluk algısı.
- **Model:** `RandomForestClassifier`, karşılaştırma için `LogisticRegression` de eğitilir. Hangi modelin seçildiği ve neden, raporda gösterilir.
- **Açıklanabilirlik:** Her karar için kararı en çok etkileyen 3 gerekçe gösterilir (permutation importance ve özellik katkıları). Örnek: *"Graf algoritmaları: sınav boyutu ortalaması 2.1/5, olumsuz yorum oranı %64, geçen döneme göre -0.8 düşüş."*
- **Etiketler:** Sentetik veride gizli bir kural ve gürültü ile üretilir. Bu yöntem sunumda açıkça anlatılmalı (bkz. Risk 1).

### 2.3 ML Özellik 2: Türkçe yorum analizi (klasik NLP)
- **Duygu analizi:** TF-IDF (kelime ve karakter n-gram) + `LogisticRegression`. Sentetik olarak etiketlenmiş Türkçe yorumlarla eğitilir. Çıktı: olumlu / nötr / olumsuz.
- **Ön işleme:** Küçük harfe çevirme (Türkçe `İ/ı` dikkatli), noktalama temizliği, Türkçe stopword listesi. Kök bulma için basit sonek kırpma; zemberek gibi ağır bir bağımlılık eklenmez.
- **Tema çıkarımı:** TF-IDF + `NMF` ile tekrar eden şikayet ve övgü temaları bulunur, her temanın anahtar kelimeleri ve örnek yorumları gösterilir. Örnek: *"Tema 3: slayt, kaynak, eksik, kitap → materyal yetersizliği"*.

### 2.4 ML Özellik 3: Öğrenci segmentasyonu (kümeleme)
- Anonimleştirilmiş cevap vektörleri üzerinde `KMeans`, k değeri silhouette skoruyla seçilir.
- Segmentler otomatik isimlendirilir. Örnekler: "Genel memnun", "Sınavdan şikayetçi", "Materyal eksikliği yaşayan".
- 2 boyutlu PCA dağılım grafiğiyle gösterilir.

### 2.5 İstatistiksel trend ve anomali tespiti
- Aynı dersin dönemler arası karşılaştırması: ortalamalardaki değişim ve basit anlamlılık testi (Mann-Whitney U).
- Z-skor ile anomali tespiti, ör. *"Bu dönem materyal puanı tarihsel ortalamanın 2σ altında"*.

### 2.6 Admin "Analiz" ekranı (frontend)
Yeni sayfa: `/admin/dersler/:id/analiz`
- **Karar kartı:** Ders genelinde ve konu bazında karar rozetleri, olasılıklar ve gerekçeler.
- **Konu × boyut ısı haritası** (ortalama puan).
- Duygu dağılımı, tema listesi (anahtar kelimeler ve örnek yorumlar), segment grafiği, dönem trend çizgisi.
- "Analizi yenile" butonu ve son analiz zamanı.
- **"Müfredat İyileştirme Raporu" PDF'i:** Mevcut `html2canvas-pro` + `jspdf` akışı (`AdminSurveyResultsPage.tsx`) yeniden kullanılır.
- Grafikler için mevcut `QuestionBarChart` (`client/src/components/admin/QuestionBarChart.tsx`) deseni izlenir.

---

## 3. Mimari

```
client (React)  ──►  server (Express, Node)  ──►  ml (FastAPI, Python)
                         │  anonim veri gönderir     │  model.joblib
                         ▼                           ▼
                      MongoDB  ◄── AnalysisReport (sonuç önbelleği)
```

- **`ml/`** (yeni, üçüncü proje): FastAPI uygulaması.
  - `POST /analyze`: Ders verisini alır; karar, duygu, tema, segment ve trend sonuçlarını döner.
  - `POST /train`: Modeli yeniden eğitir.
  - `GET /health`
  - Yapı: `ml/app/main.py`, `ml/app/pipeline/` (preprocess, sentiment, topics, clustering, decision), `ml/models/*.joblib`, `ml/data/generate_synthetic.py`, `ml/notebooks/` (EDA ve model karşılaştırma, sunum için).
- **Node tarafı:**
  - Yeni `analysisController.js` + `analysisRoute.js` (`requireAdmin`).
  - Veriyi Mongo'dan toplar ve **kimlik bilgisini çıkararak** (user id hash'lenir, ad ve e-posta asla gönderilmez) ML servisine iletir.
  - Sonucu yeni `AnalysisReport` modelinde saklar, böylece her sayfa açılışında yeniden hesaplanmaz.
- **Servisler arası güvenlik:** `ML_SERVICE_URL` + `ML_SERVICE_TOKEN` env değişkenleri. ML servisi sadece bu token'la gelen istekleri kabul eder.
- **Gizlilik (KVKK):** Bir dersin cevap sayısı 5'in altındaysa analiz gösterilmez (küçük gruplarda kimlik tahmin edilmesin). Excel export'taki anonimleştirme yaklaşımı burada da uygulanır.

---

## 4. Sentetik Veri

- **`ml/data/generate_synthetic.py`:**
  - Ders, konu, öğrenci ve cevap verisi üretir.
  - Bazı ders × konu çiftlerine bilerek "sorunlu" profiller atar (ör. düşük sınav puanı + olumsuz yorum).
  - Türkçe yorumları şablon + eş anlamlı kelime havuzlarından üretir (olumlu / nötr / olumsuz etiketli).
  - Çıktılar: eğitim CSV'leri (`decision_train.csv`, `comments_labeled.csv`).
- **`server/scripts/seedDemoData.js`** (`npm run seed-demo`): Aynı mantıkla MongoDB'yi demo verisiyle doldurur (3 dönem, ~8 ders, ~400 öğrenci). Mevcut `seedAdmin.js` yapısı örnek alınır. Yalnızca `demo` ile işaretlenmiş kayıtları silip yeniden oluşturur.

---

## 5. Fonksiyonel / Fonksiyonel Olmayan Gereksinimler (kurs konusu)

| Fonksiyonel | Fonksiyonel olmayan |
|---|---|
| Ders ve müfredat konusu yönetimi | Analiz yanıt süresi < 5 sn (önbellekli < 300 ms) |
| Ders × konu bazında iyileştirme kararı | KVKK: anonimleştirme, min. 5 cevap eşiği |
| Yorum duygu ve tema analizi | Servisler arası token doğrulaması |
| Öğrenci segmentasyonu, trend ve anomali | Model sürümleme ve eğitim tarihinin loglanması |
| Müfredat iyileştirme raporu (PDF) | Tek komutla çalıştırma (`start.bat`) |

---

## 6. Uygulama Fazları

Her faz `btk-egitim` branch'inde ayrı commit(ler) olarak ilerler. Her fazdan önce **plan modu**na geçilir ve `docs/specs/` altına bir spec dosyası yazılır (spec-driven development).

| Faz | İçerik | Çıktı |
|---|---|---|
| **0. Hazırlık** | `start.bat` (server + client + ml'yi 3 terminalde açar), `CLAUDE.md` güncellemesi, `docs/specs/` klasörü | Tek tıkla çalışan ortam |
| **1. Veri modeli** | `Course` modeli, `Survey.course`, `Question.topic/dimension`, Dersler sayfası, anket formu güncellemesi | Anketler derse ve konuya bağlı |
| **2. Sentetik veri** | `generate_synthetic.py`, `seedDemoData.js` | Demo DB ve eğitim CSV'leri |
| **3. ML servisi** | FastAPI iskeleti, ön işleme, duygu, tema, kümeleme, karar modeli, `/train`, notebook ile model karşılaştırma | Eğitilmiş modeller ve metrik raporu |
| **4. Entegrasyon** | `analysisController`, `AnalysisReport`, token, anonimleştirme, min-N kontrolü | `GET/POST /api/analysis/course/:id` |
| **5. Analiz ekranı** | Karar kartı, ısı haritası, temalar, segment ve trend grafikleri, PDF raporu | Admin analiz sayfası |
| **6. Deploy ve sunum** | Client → Vercel (Vercel MCP ile), server + ml → Render/Railway, README ve ekran görüntüleri | Canlı demo linki |

---

## 7. Kursta Öğrenilenlerin Projede Kullanımı

Sunumda "bu projeyi nasıl geliştirdim" kısmı için:

- **Plan modu + plan.md:** Bu doküman ve her faz öncesi plan.
- **/init → CLAUDE.md:** Zaten oluşturuldu, her fazda güncellenecek.
- **Spec-driven development:** `docs/specs/faz-N-*.md`. Kod yazılmadan önce gereksinimler ve kabul kriterleri yazılır.
- **Subagent'lar / agent teams:** Faz 3 ve 5 paralel ilerletilebilir (bir agent ML pipeline'ı, bir agent frontend'i yazar). Ortak sözleşme olarak `/analyze` JSON şeması spec'te önceden sabitlenir.
- **Skill:** Proje skill'i `.claude/skills/demo-veri-yenile/`. Sentetik veriyi üretir, DB'yi doldurur, modeli yeniden eğitir. Tekrar eden iş skill'e dönüşür, token tasarrufu sağlanır.
- **MCP:** Vercel MCP ile frontend canlıya alınır.
- **CronCreate / /schedule:** Fazları zamanlı görevler olarak tanımlamak. Ayrıca "her dönem sonunda modeli yeniden eğit" senaryosu gösterilebilir.
- **İterasyon ve /code-review:** Her faz sonunda kod incelemesi; AI çıktısı doğrulanmadan kabul edilmez.
- **Prompt teknikleri:** Spec'lerde few-shot (örnek JSON çıktıları) ve role prompting kullanımı.
- **start.bat:** Kurs notundaki örneğin birebir uygulaması.

---

## 8. Riskler ve Dürüstlük Notları

1. **Sentetik veriyle eğitilen model, kuralı geri öğrenir.** Sunumda "model gerçek veride doğrulanmadı; gerçek veri geldikçe `/train` ile yeniden eğitilecek şekilde tasarlandı" denmeli. Notebook'ta gürültü seviyesine göre başarı grafiği gösterilebilir.
2. **Türkçe klasik NLP sınırlı.** Ironi ve olumsuzluk ekleri ("anlaşılmadı" gibi) zorlayıcı; karakter n-gram bunu kısmen çözer.
3. **Üç servis = daha karmaşık deploy.** `start.bat` ve README ile kurulum basit tutulur. ML servisi kapalıyken admin paneli çalışmaya devam eder, yalnızca analiz sayfası "servis erişilemiyor" gösterir.
4. Karar modeli bir **öneri sistemidir**, nihai karar öğretim üyesinindir. Bu not arayüzde de yer alır.

---

## 9. Doğrulama

- **ML:** `pytest` ile pipeline birim testleri (ön işleme, şema). Notebook'ta train/test ayrımıyla accuracy, F1 ve confusion matrix. Sorunlu atanan ders × konu çiftlerinin "İyileştirme gerekli" çıktığının kontrolü.
- **Entegrasyon:** `npm run seed-demo` → `start.bat` → admin girişi → bir ders → "Analiz" → karar kartı, grafikler ve PDF çıktısının üretildiğini tarayıcıda görmek.
- **Gizlilik:** ML servisine giden payload loglanıp içinde e-posta veya ad olmadığı kontrol edilir. 5'ten az cevaplı derste analiz gizlenir.
- **Kalite:** `client` için `npm run build` + `npm run lint`, her faz sonunda `/code-review`.
