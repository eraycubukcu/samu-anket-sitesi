# Faz 1 — Veri Modeli: Ders, Müfredat Konusu ve Soru Boyutu

İlgili plan: [`docs/plan.md`](../plan.md) §2.1

## Amaç
Anketleri bir derse, soruları da o dersin bir müfredat konusuna ve bir değerlendirme boyutuna bağlamak. ML analizi (Faz 3+) "ders × konu × boyut" kırılımında çalışacağı için bu faz ön şarttır.

## Gereksinimler

### Backend
- **`Course` modeli** (`server/models/Course.js`)
  - `code` (zorunlu, ör. `BIL301`, büyük harfe çevrilir), `name` (zorunlu), `department`, `term` (zorunlu, ör. `2026-Güz`), `instructor`, `topics: [String]` (en az 1), `createdBy`.
  - `(code, term)` benzersiz: aynı ders aynı dönemde iki kez açılamaz.
- **`Survey.course`**: `Course` referansı, opsiyonel (eski anketler bozulmasın).
- **`Question.topic`**: string, opsiyonel. Anketin dersi varsa, dersin `topics` listesindeki bir değer olmalı.
- **`Question.dimension`**: `icerik | ogretim | materyal | sinav | is_yuku`, opsiyonel.
- **`/api/courses`** (tamamı `requireAdmin`)
  - `GET /`: Dersler, anket sayılarıyla birlikte.
  - `GET /:id`
  - `POST /`
  - `PUT /:id`: Anketlerde kullanılan bir konu listeden çıkarılamaz.
  - `DELETE /:id`: Derse bağlı anket varsa silinemez (400).
- Mass-assignment: `ALLOWED_COURSE_FIELDS`, `ALLOWED_SURVEY_FIELDS`'a `course` eklenir. Tip kontrolleri yapılır (string / string[]).
- `GET /api/surveys` listesinde `course` populate edilir (`code name term`).

### Frontend
- **"Dersler" sayfası** (`/admin/dersler`): Tablo + oluştur/düzenle dialog'u. Konular satır satır girilir. Sil işlemi onay ister.
- **Anket formu:**
  - Ders seçimi (opsiyonel, "Ders yok" seçeneği).
  - Ders seçildiyse her soruda "Müfredat konusu" seçimi.
  - Her soruda "Değerlendirme boyutu" seçimi.
  - Ders değişince, yeni dersin konularında olmayan soru konuları temizlenir.
- **Anketler listesi:** Ders kodu sütunu.
- Sidebar'a "Dersler" menü öğesi.

## Kabul Kriterleri
1. Ders oluşturulabilir, düzenlenebilir ve silinebilir. Aynı kod + dönem ikinci kez eklenemez.
2. Derse bağlı anketi olan ders silinemez, anlaşılır bir hata mesajı görünür.
3. Anket formunda ders, konu ve boyut seçilip kaydedilir; düzenleme ekranında geri yüklenir.
4. Dersin konu listesinde olmayan bir konu API'ye gönderilirse 400 döner.
5. Ders bilgisi olmayan eski anketler eskisi gibi çalışır (öğrenci tarafı dahil).
6. `client`: `npm run build` ve `npm run lint` hatasız.

## Kapsam dışı
- Öğrenci arayüzünde ders, konu ve boyut gösterimi (öğrenciye görünmez).
- Analiz ve ML (Faz 3–5).
