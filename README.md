# Samsun Üniversitesi Anket Sistemi

Final vizeleri sonrası öğrencilerden ders/sınav değerlendirme anketi toplamak için geliştirilen web uygulaması. Adminler anket oluşturur, öğrenciler sadece `@samsun.edu.tr` uzantılı hesaplarıyla giriş yapıp anketleri cevaplar.

## Genel Mimari

Monorepo yapısında, birbirinden bağımsız iki proje:

```
samu-anket-web/
├── server/   # Express + MongoDB REST API
└── client/   # React + TypeScript SPA
```

İki farklı kimlik doğrulama akışı var:

- **Öğrenci**: [Clerk](https://clerk.com) üzerinden Google ile giriş. İlk girişte backend, Clerk'ten dönen e-posta `@samsun.edu.tr` ile bitmiyorsa hesabı reddeder.
- **Admin**: Klasik kullanıcı adı/şifre + JWT. Tek admin `scripts/seedAdmin.js` ile oluşturulur, sonrasında panelden şifre değiştirilebilir.

## Özellikler

### Öğrenci
- Google ile giriş (sadece samsun.edu.tr hesapları)
- O an aktif olan anketleri listeleme ve doldurma
- Anket süresi dolmadan önce kendi cevabını düzenleyebilme
- Geçmişte doldurduğu anketleri görüntüleme

### Admin
- Anket oluşturma / düzenleme / silme / kopyalama
- Dört soru tipi: metin, 1-5 puanlama, tek seçim, çoklu seçim (seçenek sayısı ve zorunluluk admin tarafından belirlenir)
- **Sınav tarihine göre otomatik zamanlama**: admin sadece sınav tarih/saatini girer, anket sınavdan 10 dakika önce otomatik açılır, sınav gününün (TR saatiyle) 23:59'unda otomatik kapanır — ertesi güne sarkmaz
- Anket kaydetmeden önce öğrenci görünümünde canlı önizleme
- Dashboard: toplam/aktif anket, toplam cevap, toplam öğrenci sayısı ve son anketler
- Sonuç sayfası: soru bazlı özet istatistik (ortalama, seçenek dağılımı)
- **Excel export**: öğrenci kimliği (ad/e-posta) anonimleştirilmiş cevap listesi + veri çubuklu (data bar) özet sayfası
- Şifre değiştirme

### Güvenlik
- Admin girişinde rate limiting, timing-safe şifre karşılaştırması
- Genel API rate limiting, `helmet`, `CORS` allowlist
- NoSQL injection ve mass-assignment koruması (izinli alan listeleri, tip kontrolleri)
- Anket silinince ilişkili cevaplar da transaction içinde silinir (yetim kayıt kalmaz)
- Öğrenci sadece aktif/kendi zaman penceresindeki anketleri görebilir, cevap düzenlerken sahiplik kontrolü yapılır

## Teknoloji

**Backend** — Node.js, Express 5, MongoDB + Mongoose, Clerk (`@clerk/express`), JWT, bcryptjs, `express-rate-limit`, `helmet`, `exceljs`.

**Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Base UI tabanlı), React Router, TanStack Query, Axios, `@clerk/clerk-react`, `next-themes` (açık/koyu/sistem tema), Sonner (toast).

## Kurulum

### 1. Backend (`server/`)

```bash
cd server
npm install
```

`server/.env` dosyası oluşturun:

```
PORT=5000
MONGO_URI=mongodb+srv://...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
JWT_SECRET=...
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
CLIENT_URL=http://localhost:5173
# Sadece gerçek bir reverse proxy (Render/Railway/nginx) arkasında deploy edilince:
# TRUST_PROXY=1
```

İlk admin kullanıcısını oluşturun (bir kereye mahsus):

```bash
npm run seed
```

Sunucuyu başlatın:

```bash
npm run dev     # nodemon ile
npm start       # production
```

### 2. Frontend (`client/`)

```bash
cd client
npm install
```

`client/.env` dosyası oluşturun:

```
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

> `VITE_CLERK_PUBLISHABLE_KEY` backend'deki `CLERK_PUBLISHABLE_KEY` ile aynı olmalı (public key, gizli değil).

```bash
npm run dev       # http://localhost:5173
npm run build     # production build
```

### Clerk Dashboard ayarları

- **Configure → SSO Connections**: Google bağlantısı etkin olmalı.
- **Configure → Restrictions**: Sign-up modu açık (Public) olmalı — domain filtresi Clerk'te değil, uygulama kodunda (`@samsun.edu.tr` kontrolü hem backend hem frontend'de) yapılıyor.

## Klasör Yapısı

```
server/
├── config/db.js              # MongoDB bağlantısı
├── controllers/               # İş mantığı (auth, admin, survey, response)
├── middlewares/auth.js        # requireAdmin / requireAuth (Clerk)
├── models/                    # User, Survey, Response (Mongoose)
├── routes/                    # Express router'ları
├── scripts/seedAdmin.js       # İlk admin oluşturma
├── utils/surveySchedule.js    # examDate → startDate/endDate hesaplama
└── index.js                   # App giriş noktası, güvenlik middleware'leri

client/src/
├── components/
│   ├── layout/                 # StudentLayout, AdminLayout (sidebar'lı)
│   ├── ui/                     # shadcn bileşenleri
│   └── admin/                  # SurveyPreviewDialog vb.
├── hooks/useStudentApi.ts      # Clerk token'lı axios instance
├── lib/api.ts                  # Admin axios instance + yardımcılar
├── pages/
│   ├── student/                # Giriş, anket listesi, cevaplama, geçmiş cevaplar
│   └── admin/                  # Login, dashboard, anket CRUD, sonuçlar, ayarlar
├── routes/                     # RequireAuth/RequireAdmin route guard'ları
└── types/index.ts              # Paylaşılan TypeScript tipleri
```

## API Uçları (özet)

| Yöntem | Yol | Kim | Açıklama |
| --- | --- | --- | --- |
| POST | `/api/admin/login` | herkes | Admin girişi |
| PUT | `/api/admin/password` | admin | Şifre değiştirme |
| GET | `/api/admin/stats` | admin | Dashboard istatistikleri |
| GET | `/api/surveys/active` | öğrenci | Aktif anketler |
| GET | `/api/surveys/student/:id` | öğrenci | Tek anket (sadece aktifse) |
| GET/POST/PUT/DELETE | `/api/surveys` | admin | Anket CRUD |
| POST | `/api/responses` | öğrenci | Cevap gönder |
| PUT | `/api/responses/:id` | öğrenci | Kendi cevabını güncelle |
| GET | `/api/responses/my` | öğrenci | Geçmiş cevaplarım |
| GET | `/api/responses/survey/:surveyId` | admin | Anket sonuçları |
| GET | `/api/responses/survey/:surveyId/export` | admin | Excel export |

## Notlar

- `@samsun.edu.tr` domain kısıtlaması hem backend (`middlewares/auth.js`) hem frontend'de (`routes/RequireStudent.tsx`) ayrı ayrı uygulanıyor — savunma derinliği için.
- Sınav saati hesaplamaları Türkiye saat dilimini (UTC+3, DST yok) sabit varsayar; frontend'den gönderilen `examDate` bu yüzden her zaman `+03:00` ofsetiyle gönderilir.
- Production'a çıkmadan önce gözden geçirilmesi gerekenler: `CLIENT_URL` gerçek domain ile ayarlanmalı, IP başına rate limit (kampüs ağı gibi paylaşımlı IP'ler için) tekrar değerlendirilmeli.
