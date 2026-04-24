# Finans Takip Masaustu Uygulamasi

Bu proje, ofis ici gelir-gider takibini Excel'den cikarmak icin hazirlanmis masaustu odakli bir MVP'dir.

## Teknoloji yığını

- Next.js + React + TypeScript
- Tailwind CSS
- shadcn/ui tarzinda yeniden kullanilabilir UI bilesenleri
- Recharts
- Express
- SQLite + Prisma
- Electron

## Ozellikler

- Turkce arayuz
- Yeni gelir/gider formu
- Aylik dashboard
- Islemler listesi, filtreleme, arama, duzenleme ve silme
- Aylik raporlar ve grafikler
- Kategori yonetimi
- Temel ayarlar
- Haftalik otomatik yerel yedekleme
- Elle `Yedek Al` islemi
- Yerel SQLite saklama
- Electron ile masaustu paketleme

## Gelistirme

1. Bagimliliklari yukleyin:

```bash
npm install
```

2. Prisma istemcisini ve veritabanini hazirlayin:

```bash
npm run prisma:generate
npm run prisma:seed
```

3. Gelistirme modunu baslatin:

```bash
npm run dev
```

Bu komut:

- Next.js arayuzunu `http://127.0.0.1:3000` adresinde
- Express API'yi `http://127.0.0.1:3001` adresinde

birlikte calistirir.

Electron gelistirme penceresini de acmak icin:

```bash
npm run dev:desktop
```

## Paketleme

1. Uretim derlemesini alin:

```bash
npm run build
```

2. Masaustu kurulum paketini uretin:

```bash
npm run dist
```

Paketler `release/` klasorunde olusur. Electron paketi Node.js gerektirmeden calisir.

## GitHub Actions ile Windows paketleme

Proje icinde hazir workflow:

- `.github/workflows/build-desktop.yml`

Kullanim:

1. Projeyi GitHub'a push edin.
2. GitHub repo icinde `Actions` sekmesine girin.
3. `Build Desktop App` workflow'unu secin.
4. `Run workflow` ile calistirin.
5. Islem bitince artifact olarak `finance-tracker-windows` paketini indirin.

Bu artifact icinde genelde sunlar bulunur:

- Windows kurulum dosyasi `.exe`
- `latest*.yml`
- varsa `.blockmap`

Not:

- Workflow su an `windows-latest` uzerinde Windows installer uretir.
- Kod imzalama ayarlanmadiysa Windows ilk acilista SmartScreen uyarisi gosterebilir.
- Uygulama ikonunu ozellestirmek icin `electron-builder` ayarlarina ayri `icon` dosyalari eklenmelidir.

## Veritabani

- Prisma dosyasi: `prisma/schema.prisma`
- Varsayilan gelistirme DB: `prisma/finance-tracker.db`
- Paketlenmis uygulamada DB: Electron `userData/data/finance-tracker.db`

## Sayfalar

- `/dashboard`
- `/yeni-islem`
- `/islemler`
- `/raporlar`
- `/kategoriler`
- `/ayarlar`

## Notlar

- Export yapisi aylik rapor ekraninda hazir tutuldu; PDF/Excel disa aktarma sonraki adim olarak eklenebilir.
- Varsayilan kategoriler seed ile otomatik eklenir: `Mutfak`, `Teknik`, `Maaşlar`, `Diğer`
- Ilk MVP'de giris sistemi yoktur; uygulama lokal kullanim senaryosu icin tasarlanmistir.
- Yedekler veritabani klasoru altindaki `backups/` dizinine kaydedilir ve son 5 yedek saklanir.
- Otomatik yedek araligi `Ayarlar` ekranindan degistirilebilir; uygulama acilista ve acik kaldigi surece periyodik kontrol yapar.
