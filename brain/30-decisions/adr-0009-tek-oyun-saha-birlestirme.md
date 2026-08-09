# ADR-0009 — Tek oyun: arenanın sahası ana oyunun sahası oluyor

- **Tarih:** 2026-08-09
- **Durum:** Kabul edildi
- **Karar veren:** Kullanıcı ("ayrı kalmasın, ikisinin iyi özelliklerini
  birleştirelim"), uygulama koordinatör
- **Etkilediği:** `packages/core/src/constants.js` (fizik tablosu),
  `constantsHash`, bot fixture'ı, replay fixture'ı, matris

## Bağlam

Repoda iki oyun vardı ve kullanıcı ikisinin neden bu kadar farklı hissettirdiğini
sordu. Ölçüldüğünde sebep tek bir satır değildi, sahanın kendisiydi:

| | `/` (yayındaki oyun) | `/arena.html` (önceki) |
|---|---|---|
| saha | 22 × 36 m | 17.14 × 36 m |
| kale | 7.32 m (FIFA) | 4.71 m |
| ceza sahası | 14 × 4.5 m | 11 × 4.5 m |

Aynı çim, aynı ışık, aynı file — ama saha 5 metre dar ve kale 2.6 metre küçük
olunca başka bir oyun oluyor. Arena görüntü katmanı ne kadar düzeltilirse
düzeltilsin bu fark kapanmıyordu.

Uzun eksen (840 birim = 36 m) zaten doğruydu; yalnızca kısa eksen ve kale ağzı
yanlıştı. `brain/20-tech-spec/physics-constants.md` bu tablo için "Değişiklik =
ADR + constantsHash" diyor; bu ADR o değişikliktir.

## Karar

Arena asıl oyun olur ve ana oyunun sahasına taşınır. Değişen sabitler
(23.333 birim/metre ölçeğinde):

| sabit | eski | yeni | metre |
|---|---|---|---|
| `PITCH_HALF_X` | 200 | **257** | 11.01 m (ana oyun 11) |
| `GOAL_HALF_X` | 55 | **85** | 3.64 m (FIFA 3.66) |
| `PENALTY_HALF_X` | 128 | **163** | 6.99 m (ana oyun 7) |
| `TACKLE_REACH` | 12 | **20** | aşağıya bakınız |
| `PITCH_HALF_Z` | 420 | 420 | 18 m — değişmedi |
| `PENALTY_DEPTH` | 105 | 105 | 4.5 m — değişmedi |

Disk boyutları (oyuncu 15, top 10 birim) DEĞİŞMEDİ. Onlar sahanın değil oyunun
tuning'i: kick menzili, kontrol yarıçapı ve dripling hissi o üçlüye bağlı.

`constantsHash`: `7f502ae2` → `6c3972cb`.

## Ölçülen sonuçlar

Genişletme iki gerçek şeyi bozdu; ikisi de tahminle değil A/B ile bulundu.

**1. Slayt (tackle) başarısı %47.2 → %18.4.** Tasarım bandı %40-55. Aynı ölçüm
eski sahaya geri alınca %47.2'ye dönüyor, yani eski oranın önemli kısmı yan
çizginin hücumcuyu köşeye sıkıştırmasıymış — mekaniğin kendisi değil. Gerçek
genişlikte kaçan hücumcuyu yakalamak için `TACKLE_REACH` 12 → 20 yapıldı;
%47.2'ye dönüyor ve 20-24 arası plato, yani bıçak sırtı bir değer değil.

**2. Scripted botlar 60 saniyede gol atamaz oldu.** Bu bir gerileme değil: 22 m
sahada 4 kişiyle bir dakika golsüz geçmesi normal futbol. Arenanın kendi bot
politikası hâlâ gol atıyor (2v2 → 2-0, 4v4 → 1-0). Replay fixture'ı highlight
çıkarabilmek için gole muhtaç olduğundan kadrosu 4 → 6 yapıldı.

Değişen fixture'lar: `packages/bots/test/fixtures/onnx-actions.json` yeniden
üretildi (özellikler saha köşegenine göre normalize ediliyor).

## Alternatifler

- **Diskleri de küçültmek** (oyuncu 15 → 8, top 10 → 4; ana oyunun 0.35/0.15 m
  değerleri). Reddedildi: kick menzili, kontrol yarıçapı, dripling ve bot
  ayarlarının tamamı yeniden ayarlanırdı. Görsel taraf zaten ana oyunun
  oranlarında çiziliyor; çarpışma diski "kişisel alan" olarak kalıyor.
- **Arenayı bırakıp ana oyunla devam etmek.** Reddedildi: deterministik
  çekirdek, host-otorite netcode, lobi, modlar ve bot arayüzü float fiziğe
  sonradan takılamaz.
- **İkisini ayrı tutmak.** Kullanıcı açıkça reddetti.

## Sonuç

Bundan sonra tek bir saha var. Kalan birleştirme işi ayrı: animasyon katmanının
bağlanması (matris #14-#16, `brain/00-index.md` sonundaki nota bakınız) ve
`/` girişinin arenaya devredilmesi.
