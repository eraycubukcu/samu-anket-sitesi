---
name: demo-veri-yenile
description: Sentetik demo verisini yeniden üretir ve MongoDB'ye yükler (ml/data/generate_synthetic.py + npm run seed-demo). "Demo verisini yenile", "sentetik veriyi tekrar üret", "seed-demo çalıştır", "demo verisini sil" gibi isteklerde kullan.
---

# Demo verisini yenile

Bu proje gerçek öğrenci verisi yerine sentetik veriyle demo yapılır ve ML modelleri eğitilir. Ayrıntılar: `docs/specs/faz-2-sentetik-veri.md`.

## Adımlar

1. **Python ortamını kontrol et.** `ml/.venv` yoksa kur:
   ```bash
   cd ml && py -3.12 -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
   ```
2. **Veriyi üret** (`ml/` klasöründen). Kullanıcı farklı bir seed istemediyse 42 kullan:
   ```bash
   .venv/Scripts/python data/generate_synthetic.py --seed 42
   ```
   Çıktıdaki etiket dağılımında her sınıfın en az %15 olduğunu kontrol et.
3. **Veritabanına yükle** (`server/` klasöründen):
   ```bash
   npm run seed-demo
   ```
   - Sadece `isDemo: true` kayıtları silinip yeniden yüklenir; gerçek kayıtlara dokunulmaz.
   - Admin kullanıcısı yoksa önce `npm run seed` gerekir.
4. **Faz 3+ uygulandıysa** modeli yeniden eğit (ML servisi `/train` veya `ml/` altındaki eğitim komutu, bkz. `CLAUDE.md`).

## Sadece silmek için
```bash
cd server && npm run seed-demo -- --clean
```

## Kullanıcıya rapor et
Üretilen öğrenci, ders, anket ve cevap sayılarını ve etiket dağılımını kısa bir tabloyla bildir.
