---
title: "ADR-0005 Maç Ayarları, Saha Preset'leri ve State Header'ı"
type: adr
status: accepted
date: 2026-08-08
related: ["[[modes-rules]]", "[[physics-constants]]", "[[adr-0001-sabit-kaleci]]", "[[adr-0004-faz12-oynanis-sabitleri]]"]
---

## Bağlam

Faz 1.7a matris satırları #26 (golden goal), #27 (mercy rule), #28 (saha
preset'leri K/O/B) ve #29 (oda ayarları senkronu, host canonical) core'a
indirildi. Dördü de tek bir soruya bağlanıyor: **bir maçın hangi ayarlarla
oynandığı nerede yazar?**

Faz 1.2 core'unda saha ölçüleri `CONSTANTS` tablosundaydı
(`PITCH_HALF_X`, `PITCH_HALF_Z`, `GOAL_HALF_X`, `PENALTY_*`, `SPAWN_*`) ve
`constantsHash`'in içine giriyordu. Üç preset istendiği anda bu yer yanlış:
preset değiştirmek `constantsHash`'i kaydırırdı, yani "küçük sahada oynayan
peer" ile "orta sahada oynayan peer" birbirine *farklı bir fizik build'i* gibi
görünürdü. Oysa ikisi de aynı kodu çalıştırıyor, sadece aynı odada değiller.

Ayrıca golden goal, mercy ve süre/skor limiti maç içinde okunması gereken
değerler. Bunlar yalnızca JS tarafında bir nesnede dursaydı `serialize()` onları
kaybederdi ve snapshot'tan devam eden bir client farklı kurallarla oynardı.

## Karar

**Preset ve tüm oda ayarları `constantsHash`'e DEĞİL, state header'ına yazılır;
kimlikleri ayrı bir `settingsHash` taşır. Fizik tablosu hiç değişmedi.**

### 1. İki ayrı hash, iki ayrı soru

| Hash | Soru | Uyuşmazlık anlamı |
|---|---|---|
| `constantsHash` | "aynı build miyiz?" | kod uyumsuz, bağlantı kabul edilemez |
| `settingsHash` | "aynı maç mıyız?" | kod aynı, oda farklı |

Preset bir fizik sabiti değil bir **maç ayarı**. Onu `constantsHash`'e koymak
iki farklı hatayı aynı kutuya atmak olurdu. Bu yüzden:

- `CONSTANTS` tablosu bit-bit korundu → `constantsHash` **`7f502ae2`
  (değişmedi)**. Eski replay'ler fizik açısından hâlâ geçerli.
- Preset tablosu yeni `packages/core/src/matchRules.js` içinde; orta preset,
  kilitli `CONSTANTS` geometrisinin ta kendisi (test bunu bit-bit doğruluyor).

### 2. Ayarlar state header'ında, çünkü snapshot kendini anlatmalı

Header 20 → 32 word'e çıktı; 17..23 arası ayarlar:

| slot | alan |
|---|---|
| 17 | `pitchPreset` (1..3, **asla 0**) |
| 18 | `settingsHash` düşük 32 bit |
| 19 | `durationTicks` (0 = süresiz) |
| 20 | `scoreLimit` (0 = yok) |
| 21 | `ruleFlags` (golden goal / mercy / kaleci bitleri) |
| 22 | `matchState` (0 devam, 1 golden goal, 2 bitti) |
| 23 | `endReason` |

Preset kodu **1 tabanlı**: sıfırlanmış bir buffer geçerli bir preset'e değil,
açık bir hataya karşılık gelir. `deserialize` önce ayar word'lerini doğrular,
sonra 18. word'ün onların hash'i olduğunu kontrol eder; tek bir word'ün
kurcalanması yakalanır. `deserialize(snap, { settings })` çağrısı ise client'ın
doğrulama noktası: büyük sahada alınmış bir snapshot küçük saha client'ında
**reddedilir**, yeniden ölçeklenmez. Sessiz yeniden ölçekleme oyuncuları
duvarın dışına koyar ve olmayan goller yazar.

Bedeli: `STATE_VERSION` 2 → 3, zincir digest'i `5b7752f4` → **`df22bbc1`**.
Faz 1.2 snapshot'ları açıkça reddediliyor — kasıtlı.

### 3. Preset'ler tek bir üniform ölçek

| preset | saha (birim) | kale ağzı | ceza sahası | kickoff z | guard z |
|---|---|---|---|---|---|
| küçük (3/4) | 300 x 630 | 82.5 | 192 x 78.75 | ±75 | ±299.25 |
| **orta (1/1, kilitli)** | **400 x 840** | **110** | **256 x 105** | **±100** | **±399** |
| büyük (5/4) | 500 x 1050 | 137.5 | 320 x 131.25 | ±125 | ±498.75 |

Her uzunluk aynı 3/4 ve 5/4 çarpanıyla ölçekleniyor ve ölçek **tam sayı
bölünebilir** (Q16.16 ham değerlerin hepsi 4'e tam bölünüyor); yuvarlama yok,
port'ta sapma yok. Oranlar (kale/genişlik, ceza sahası/yarı saha, kickoff/kale
çizgisi) üç preset'te birebir aynı, yani hiçbir preset bir tarafa avantaj
vermiyor: fark yalnızca mutlak boyut ve o da iki takım için simetrik.

Ölçeklenmeyenler bilinçli: oyuncu/top yarıçapı, vuruş menzili ve bütün süreler
KİLİTLİ kalıyor. Küçük saha dar hissettiriyor çünkü oyuncular *göreli olarak*
büyük, oyuncular değiştiği için değil. `UNITS_PER_METRE` de sabit: küçük saha
27 m, orta 36 m, büyük 45 m uzunluğunda gerçek bir saha.

### 4. Kurallar core'da kesinleşir, host otoriter yapı gereği

`step()` golü işledikten sonra tek bir blokta karar veriyor. Aynı tick'te birden
fazla kural sağlanırsa öncelik: **mercy > golden goal > skor limiti**. Mercy önce
çünkü dört gol farkı tablodaki en sert gerçek; golden goal skor limitinden önce
çünkü golden goal periyodunda limit zaten aşılmış oluyor ve bir insanın vereceği
sebep "altın gol".

Tam süre kontrolü gollerden **sonra** yapılıyor: son tick'te atılan bir
beraberlik golü hâlâ golden goal periyodunu açabiliyor.

Maç bittiğinde dünya **donuyor**: fizik durur, olay üretilmez, ama tick sayacı
ilerlemeye devam eder — `packages/net`'in delta ve ack makinesi tick indeksli ve
durursa tıkanır. Yeniden başlatmak yeni bir dünyadır, bu dünyanın mutasyonu
değil.

`mercyRule` KAPALI iken hiçbir fark maçı bitirmiyor (6-0 test ediliyor);
`goldenGoal` KAPALI iken beraberlik beraberlik olarak kapanıyor.

### 5. `normaliseSettings` toplam bir fonksiyon, `strict` ise gürültülü

Tek canonical `MatchSettings`: `durationSeconds`, `scoreLimit`, `pitch`,
`goldenGoal`, `mercyRule`, `keepers`. Varsayılan: `180 / 3 / orta / kapalı /
açık / açık` → `settingsHash` **`a168d11e`**.

- **lenient (varsayılan)**: telden gelen hiçbir şey exception atmaz; kullanılamaz
  her alan kendi varsayılanına düşer. Host'un lobi isteğine yaptığı budur.
- **strict**: aynı kontroller, ama değiştirmek zorunda kaldığı ilk şeyde
  `SettingsError` (+ tam issue listesi) fırlatır. Client'ın host'tan gelene
  yaptığı budur: anlamadığı bir ayar word'ü sessiz bir yerel yorum değil, açık
  bir ret olmalı.

Alias tablosu `Object.create(null)` üzerine kuruldu; telden gelen `__proto__`,
`constructor` veya `toString` miras alınmış bir fonksiyona değil "bilinmiyor"a
çözülüyor.

`keepers: false` maç başlangıcında bütün kaleci rollerini siliyor. ADR-0001'in
izin verdiği tek biçim bu: rol yalnızca `createWorld`'de yazılır, maç içinde
değişmez.

## Kanıt

`node packages/core/test/run.mjs` — **182 kontrol, hepsi GEÇTİ** (Faz 1.2
kapanışında 117 idi). `packages/net` ve `packages/bots` kapıları da yeşil.

| Kabul kriteri | Ölçüm |
|---|---|
| #28 her preset tutarlı arena | kale kutunun içinde, kutu sahanın içinde, en küçükte bile tersine dönme yok |
| #28 12 oyunculu kickoff | üç preset'te de merkezde, simetrik, duvarların içinde |
| #28 aynı göreli şut | üç preset, iki kale = 6/6 gol |
| #26 golden goal KAPALI | tam sürede berabere biter, kazanan yok |
| #26 golden goal AÇIK, berabere | maç bitmez, golden goal fazı açılır, ilk gol bitirir |
| #26 golden goal AÇIK, önde | normal tam süre galibiyeti, faz açılmaz |
| #27 mercy AÇIK | 3 farkta devam, 4 farkta biter (5-1 dahil: fark okunuyor, skor değil) |
| #27 mercy KAPALI | 6-0'da bile maç sürüyor |
| #29 doğrulama | 60+ düşmanca değer varsayılana düşüyor, strict modda hepsi ret |
| #29 `settingsHash` | altı ayarın her biri hash'i değiştiriyor; anahtar sırası değiştirmiyor |
| #29 snapshot reddi | büyük saha snapshot'ı küçük saha client'ında `settings-mismatch` |
| determinizm | iki koşu + taze child process + golden goal içinde serialize/deserialize dikişi: dördü de özdeş |

## Sonuçlar

+ Dört matris satırı tek deterministik state'te; "maç bitti" kararı core'da,
  yani client hiçbir zaman kendi maçını bitiremiyor.
+ `constantsHash` yerinde kaldı: preset değiştirmek fizik build'ini
  değiştirmiyor, replay'lerin fizik kimliği bozulmuyor.
+ Snapshot kendini anlatıyor: header'daki ayarlar + hash'i, tek word'lük bir
  kurcalamayı bile yakalıyor.
+ `encodeSettings`/`decodeSettings` altı Int32 word: `packages/net` kendi
  ayar formatını icat etmek zorunda değil.
− `STATE_VERSION` 2 → 3 ve zincir digest'i `5b7752f4` → `df22bbc1`: Faz 1.2
  snapshot'ları reddediliyor.
− Header 20 → 32 word: tam snapshot oyuncu başına değil maç başına 48 B büyüdü
  (4 oyuncu için 448 → 496 B), 16 KB tavanının hâlâ çok altında; `packages/net`
  kapısı ölçtü ve geçti.
− `packages/bots/src/layout.js` saha ölçülerini hâlâ `CONSTANTS`'tan okuyor,
  yani orta preset'e sabitlenmiş durumda. Bot preset farkındalığı ayrı bir iş
  (`pitchOf(world)` çağrısına geçmeli).
− `packages/net` henüz ayarları yaymıyor; API hazır, iki çağrı yeri aşağıda.

## `packages/net` için gereken iki çağrı yeri

1. **Host** — `createHostSession`, `settings` seçeneğini alıp
   `createWorld({ players, settings })`'e geçirmeli; lobi kanalında (ordered +
   reliable) `encodeSettings(settings)` (6 word) yayınlanmalı: peer katılırken
   ve her ayar değişikliğinde. Host canonical: client'ın talebi bir öneridir,
   yayınlanan word'ler gerçektir.
2. **Client** — `createClientSession`, lobi mesajından `decodeSettings(words)`
   ile ayarları çıkarmalı (hatalı payload `SettingsError` atar, join başarısız
   olur), dünyayı aynı ayarlarla kurmalı ve snapshot uygularken
   `deserialize(state, { settings })` çağırmalı. Uyuşmazlık = açık ret.

## Alternatifler

**Preset'i `constantsHash`'e koymak** — reddedildi: aynı build'i çalıştıran iki
peer'in birbirine uyumsuz kod gibi görünmesine yol açar ve "fizik değişti" ile
"oda değişti" hatalarını ayırt edilemez kılar.

**Ayarları yalnızca JS nesnesinde tutmak, state'e yazmamak** — reddedildi:
`serialize()` onları kaybeder, snapshot'tan devam eden client farklı kurallarla
oynar ve bunu kimse fark etmez.

**Preset'i client'ta ölçekleyip core'u tek sahada bırakmak** — reddedildi:
gol/duvar/ceza sahası kararları core'da veriliyor; görsel ölçek ile fiziksel
saha ayrışırsa gol çizgisi çizilen yerde olmaz.

**Yarıçapları ve vuruş menzilini de ölçeklemek** — reddedildi: KİLİTLİ sabitler
ve doğrulanmış oynanış bandları (dribbling dokunuş sayısı, tackle başarı oranı)
o sayılara bağlı; preset başına yeniden ölçülmeleri gerekirdi.

**Mercy farkını oda ayarı yapmak** — reddedildi, kapsam kilitli:
`modes-rules.md` "4 gol farkta" diyor. `MERCY_GOAL_DIFF` tek bir yerde duruyor,
v2'de ayar olmak isterse tek satırlık iş.
