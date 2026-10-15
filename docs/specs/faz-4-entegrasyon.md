# Faz 4 — Entegrasyon (Node ↔ ML servisi)

İlgili plan: [`docs/plan.md`](../plan.md) §3. ML sözleşmesi: [`faz-3-ml-servisi.md`](faz-3-ml-servisi.md)

## Amaç
Admin bir ders için analiz istediğinde Node backend'in şunları yapması:
1. Dersin anketlerini ve cevaplarını MongoDB'den toplamak.
2. Kimlik bilgilerini çıkarmak.
3. ML servisine göndermek.
4. Sonucu saklamak.

## Uç noktalar (tamamı `requireAdmin`)
| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/api/analysis/courses/:courseId` | Kayıtlı son analiz. `stale: true` ise veri analizden sonra değişmiş demektir. Analiz yoksa `report: null`. |
| POST | `/api/analysis/courses/:courseId` | Analizi yeniden çalıştırır, kaydeder ve döner. |
| GET | `/api/analysis/summary` | Her dersin son kararı (Dersler listesinde rozet için). |

## Payload oluşturma (`server/services/analysisPayload.js`)
- **Mevcut dönem:** Dersin (`Course`) tüm anketleri birleştirilir: sorular birleşir, cevaplar ayrı ayrı eklenir.
- **Önceki dönemler:** Aynı `code`'a sahip diğer `Course` kayıtları. Sıralama, anketlerinin en erken `examDate` değerine göre yapılır (dönem adı ayrıştırılmaz). Yalnızca mevcut dönemden önceki dönemler alınır.
- **Benchmark:** Aynı `term`'deki diğer derslerin boyut bazında ortalama puanları.
- **Kimlik:** `respondent = HMAC-SHA256(userId, JWT_SECRET)` ilk 16 karakter. Ad, e-posta ve Mongo `userId` asla gönderilmez.
- Cevap sayısı 5'in altındaysa ML servisi çağrılmaz; `insufficient_data` döner.

## Saklama (`AnalysisReport`)
- Ders başına tek kayıt (upsert).
- Alanlar: `course`, `result` (ML cevabı), `modelVersion`, `nResponses`, `fingerprint`, `createdBy`, `timestamps`.
- `fingerprint` = derse ait cevap sayısı + en son cevap güncelleme zamanı. GET'te yeniden hesaplanır; farklıysa `stale: true`.
- Ders silinince raporu da silinir.

## Hata davranışı
| Durum | Cevap |
|---|---|
| `ML_SERVICE_URL` / `ML_SERVICE_TOKEN` tanımsız | 503 "Analiz servisi yapılandırılmamış" (sunucunun geri kalanı çalışır) |
| ML servisine ulaşılamıyor veya zaman aşımı (60 sn) | 503 "Analiz servisine ulaşılamıyor" |
| ML 401 | 502 "Analiz servisi anahtarı hatalı" (yapılandırma hatası) |
| ML 503 (model yok) | 503 + ML'in mesajı |

## Kabul Kriterleri
1. Demo derste POST analizi çalışır, kaydedilir; GET aynı sonucu `stale: false` ile döner.
2. Payload'da e-posta, ad veya Mongo kullanıcı kimliği yoktur (otomatik kontrol).
3. 2026-Bahar BIL301 analizinde önceki 2 dönem trend'de görünür ve benchmark gönderilir.
4. ML servisi kapalıyken analiz 503 döner; diğer admin sayfaları etkilenmez.
5. Yeni bir cevap eklenince GET `stale: true` döner.
6. 5'ten az cevaplı derste ML çağrılmadan `insufficient_data` döner.
