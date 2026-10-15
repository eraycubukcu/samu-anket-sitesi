# Faz 5 — Admin Analiz Ekranı

İlgili plan: [`docs/plan.md`](../plan.md) §2.6. Veri: `GET/POST /api/analysis/courses/:id` ([Faz 4](faz-4-entegrasyon.md)), ML cevap yapısı: [Faz 3](faz-3-ml-servisi.md)

## Sayfa: `/admin/dersler/:id/analiz`
Dersler tablosundaki işlem menüsünden ("Analiz") açılır.

1. **Başlık:** Ders kodu, adı, dönemi, öğretim üyesi. "Analizi çalıştır/yenile" butonu, son analiz zamanı ve "PDF indir".
2. **Durum bildirimleri:**
   - Analiz yok → boş durum ve çalıştır butonu.
   - `stale` → "Analizden sonra yeni cevaplar geldi, yenileyin" uyarısı.
   - `insufficient_data` → KVKK açıklamasıyla bilgi kartı.
   - Servis hatası → API mesajı.
3. **Genel karar kartı:** Karar rozeti, özet cümle, en yüksek iyileştirme olasılığı, cevap sayısı.
4. **Konu kararları:** Her konu için karar rozeti, "iyileştirme olasılığı" çubuğu ve en fazla 3 gerekçe.
5. **Konu × boyut ısı haritası:** İçerik, sınav ve materyal ortalamaları. Her hücrede değer yazar.
6. **Yorumlar:**
   - Duygu dağılımı (yığılmış çubuk + legend + sayılar).
   - Tema kartları: anahtar kelimeler, baskın duygu, örnek yorumlar.
7. **Öğrenci segmentleri:** PCA dağılım grafiği, segment adları, kişi sayıları ve profil tablosu.
8. **Trend:** Dönem ortalaması çizgi grafiği. Konu değişimleri tablosu (Δ, p değeri, anlamlılık).
9. **Anomaliler:** Diğer derslere göre sapma listesi.
10. **Alt bilgi:** Model adı, sürümü ve test macro-F1 değeri. *"Bu bir karar destek önerisidir; nihai karar öğretim üyesi ve bölüme aittir."* notu.

## Görselleştirme kuralları (dataviz rehberi)
- **Karar = durum rengi:** iyileştirme gerekli = critical, izlenmeli = warning, gerek yok = good. Renk her zaman **ikon + etiketle** birlikte kullanılır.
- **Isı haritası ve duygu:** Iraksak skala, kırmızı (düşük/olumsuz) ↔ gri (3 puan / nötr) ↔ mavi (yüksek/olumlu). Hücre değerleri yazılı olduğu için renk tek başına anlam taşımaz.
- **Segmentler:** Kategorik ilk 3 renk (`--pairs all` doğrulamasından geçti) ve her segmente ayrı nokta şekli. ML servisi en fazla 3 segment üretir.
- **Koyu mod:** Tokenlar `.dark` için ayrıca tanımlıdır. PDF her zaman açık temayla üretilir (`.pdf-export-light`).
- **Etkileşim:** Grafik işaretlerinde hover ipucu var. Trend tek seri olduğu için legend yok, başlık seriyi adlandırır.

## Dersler sayfası değişiklikleri
- Son analiz kararı rozet olarak gösterilir (`GET /api/analysis/summary`).
- İşlem menüsüne "Analiz" eklenir.

## Kabul Kriterleri
1. BIL301 2026-Bahar sayfası tüm bölümleri gösterir; "Dinamik programlama" kırmızı/ikonlu "İyileştirme gerekli" rozetiyle çıkar.
2. Analizi olmayan derste boş durum, 5'ten az cevaplı derste KVKK bilgisi görünür.
3. Koyu ve açık temada okunur; PDF açık temayla iner.
4. `npm run build` ve `npm run lint` yeni hata vermez.
