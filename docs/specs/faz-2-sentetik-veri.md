# Faz 2 — Sentetik Veri

İlgili plan: [`docs/plan.md`](../plan.md) §4

## Amaç
Gerçek öğrenci verisi olmadığı için hem **demo arayüzünü dolduracak** hem de **ML modellerini eğitecek** gerçekçi sentetik veri üretmek. Tek doğruluk kaynağı Python üreticisidir; Node seed script'i onun çıktısını veritabanına yükler.

## Akış
```
ml/data/generate_synthetic.py  ──►  ml/data/generated/
                                      ├─ demo_dataset.json     (Node seed bunu yükler)
                                      ├─ decision_train.csv    (karar modeli eğitimi)
                                      ├─ comments_labeled.csv  (duygu modeli eğitimi)
                                      └─ ground_truth.csv      (demo derslerin gizli etiketleri, doğrulama için)
server/scripts/seedDemoData.js  ──►  MongoDB (isDemo: true işaretli kayıtlar)
```

## Simülasyon modeli
- Her **ders × dönem × konu** biriminin, her boyut için gizli (latent) bir kalite değeri vardır (1–5).
- Öğrenci puanı = latent kalite + öğrenci eğilimi + gürültü (1–5'e yuvarlanır).
- Dönemler arası latent kalite kayar: bazı dersler kötüleşir, bazıları iyileşir (trend analizi için).
- **Yorumlar:** Öğrencinin en düşük puan verdiği konu/boyut hakkında, puana uygun duyguda (olumlu/nötr/olumsuz) ve konunun adını geçirerek yazılır. Şablon + eş anlamlı havuzu kullanılır; olumsuzluk ekleri ("anlaşılmadı", "yeterli değildi") bilinçli olarak dahildir.
- **Etiket (gizli kural):** Latent kaliteden hesaplanır; gözlenen puanlardan değil. Ayrıca %8 etiket gürültüsü eklenir. Model gözlenen, gürültülü özelliklerden bu etiketi tahmin etmeye çalışır, bu yüzden %100 başarı beklenmez.
  - `iyilestirme_gerekli`: Konu skoru < 2.9 veya en zayıf boyut < 2.4
  - `izlenmeli`: Konu skoru < 3.5
  - `gerek_yok`: Diğer durumlar

## Anket şablonu (ders × dönem başına bir anket)
- Her konu için 3 puanlama sorusu: anlaşılırlık (`icerik`), sınavın konuyu yansıtması (`sinav`), materyal yeterliliği (`materyal`).
- Genel sorular:
  - Anlatım (`ogretim`, puanlama)
  - İş yükü (`is_yuku`, puanlama)
  - Sınav zorluk algısı (`sinav`, tek seçim)
  - "En çok zorlandığınız konular" (`icerik`, çoklu seçim; seçenekler = konular)
- Bir açık uçlu görüş sorusu.

## Özellikler (feature'lar)
`ml/app/pipeline/features.py`. Faz 3'te ML servisi de aynı fonksiyonu kullanır (eğitim ve tahmin aynı kodla hesaplanır):

`mean_icerik`, `mean_sinav`, `mean_materyal`, `mean_ogretim`, `mean_is_yuku`, `topic_std`, `low_ratio`, `neg_comment_ratio`, `hardest_rate`, `difficulty_mean`, `trend`, `n_responses`

## Demo veri boyutu
8 ders × 3 dönem (2025-Bahar, 2025-Güz, 2026-Bahar) = 24 anket, ~400 öğrenci, anket başına 25–60 cevap.

## Seed davranışı
- `npm run seed-demo`: Önce `isDemo: true` kayıtları siler, sonra yeniden yükler (tekrar çalıştırılabilir).
- `npm run seed-demo -- --clean`: Sadece demo kayıtları siler.
- Demo öğrenciler `demo.ogrenciNNN@samsun.edu.tr`, `clerkId: demo_NNN`. Gerçek bir Clerk hesabına karşılık gelmezler.
- Gerçek (demo olmayan) kayıtlara dokunulmaz.

## Kabul Kriterleri
1. `python data/generate_synthetic.py --seed 42` aynı girdiyle aynı çıktıyı üretir (deterministik).
2. Üretilen her cevap, backend'deki cevap doğrulama kurallarına uyar (rating 1–5 tam sayı, seçenekler listede).
3. `npm run seed-demo` iki kez üst üste çalıştırıldığında kayıt sayıları değişmez; `--clean` sonrası demo kayıt kalmaz.
4. Admin panelinde demo anketlerin sonuçları ve Dersler sayfası dolu görünür.
5. Eğitim verisinde üç sınıf da temsil edilir (her biri ≥ %15).
