# Model Raporu

Eğitim zamanı: 2026-10-15T16:47:35+00:00  
Veri: `ml/data/generated/` (sentetik, `data/generate_synthetic.py --seed 42`)

> **Not:** Modeller sentetik veriyle eğitildi. Etiketler, gözlenen puanlardan değil, simülasyondaki gizli kalite değerlerinden ve %8 gürültüyle üretildi. Bu yüzden skorlar, modelin gözlenen veriden gizli durumu ne kadar iyi tahmin ettiğini gösterir. Gerçek öğrenci verisinde ayrıca doğrulanmalıdır.

## 1. Müfredat iyileştirme karar modeli

### Model karşılaştırması (eğitim setinde 5 katlı CV, macro-F1)

| Model | Ortalama | Std |
|---|---|---|
| random_forest ✅ | 0.790 | 0.013 |
| logistic_regression | 0.771 | 0.015 |

Seçilen model: **random_forest**. Test seti (360 satır): macro-F1 **0.777**, doğruluk **%80.6**.

### Karışıklık matrisi (satır: gerçek, sütun: tahmin)

| | İyileştirme gerekli | İzlenmeli | Gerek yok |
|---|---|---|---|
| **İyileştirme gerekli** | 116 | 11 | 3 |
| **İzlenmeli** | 24 | 49 | 19 |
| **Gerek yok** | 2 | 11 | 125 |

### Sınıf bazında

| Sınıf | Precision | Recall | F1 |
|---|---|---|---|
| İyileştirme gerekli | 0.817 | 0.892 | 0.853 |
| İzlenmeli | 0.690 | 0.533 | 0.601 |
| Gerek yok | 0.850 | 0.906 | 0.877 |

### Özellik önemi (test setinde permutation importance, macro-F1 düşüşü)

| Özellik | Önem | Std |
|---|---|---|
| `low_ratio` | 0.2091 | 0.0220 |
| `mean_materyal` | 0.0689 | 0.0092 |
| `mean_sinav` | 0.0538 | 0.0053 |
| `mean_icerik` | 0.0343 | 0.0101 |
| `mean_ogretim` | 0.0113 | 0.0049 |
| `mean_is_yuku` | 0.0098 | 0.0050 |
| `hardest_rate` | 0.0095 | 0.0076 |
| `topic_std` | 0.0088 | 0.0087 |
| `trend` | -0.0002 | 0.0052 |
| `neg_comment_ratio` | -0.0018 | 0.0055 |
| `difficulty_mean` | -0.0026 | 0.0018 |
| `n_responses` | -0.0032 | 0.0028 |

## 2. Yorum duygu analizi

- Sentetik test seti (705 yorum): doğruluk **%100.0**, macro-F1 **1.000**
- Elle yazılmış, şablonlarda olmayan 15 yorum: doğruluk **%73.3**

Sentetik test seti, eğitimdeki şablonlardan üretildiği için skor iyimserdir. Elle yazılmış set, gerçek yorumlara genellemenin daha dürüst bir göstergesidir.

| Yorum | Gerçek | Tahmin |
|---|---|---|
| Hocanın anlattığı hiçbir şey kafama girmedi, çok kötü bir dönemdi | olumsuz | olumsuz |
| Final sınavı derste gördüklerimizle alakasızdı | olumsuz | olumsuz |
| Kaynak kitap yoktu, internetten kendimiz bulmaya çalıştık | olumsuz | olumsuz |
| Laboratuvar saatleri yetersiz kaldı, uygulama yapamadık | olumsuz | olumsuz |
| Proje teslim tarihleri çok sıkışıktı, uyku uyuyamadık | olumsuz | olumsuz |
| Ders gerçekten çok öğreticiydi, emeği geçenlere teşekkürler | olumlu | olumlu |
| Hoca konuları örneklerle açıkladığı için rahat anladım | olumlu | olumlu |
| Sınav adildi, çalışan herkes geçebilirdi | olumlu | olumsuz ❌ |
| Paylaşılan notlar çok derli topluydu, işimi kolaylaştırdı | olumlu | olumsuz ❌ |
| Bu dönem aldığım en keyifli dersti | olumlu | olumlu |
| Ders ortalama geçti, özel bir yorumum yok | notr | olumlu ❌ |
| Bazı haftalar iyiydi bazı haftalar sıkıcıydı | notr | notr |
| Konular normal hızda işlendi | notr | olumsuz ❌ |
| Sınav beklediğim zorluktaydı | notr | notr |
| Ek kaynak verilirse daha iyi olabilir | notr | notr |
