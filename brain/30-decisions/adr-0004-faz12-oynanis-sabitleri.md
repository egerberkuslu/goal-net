---
title: "ADR-0004 Faz 1.2 Oynanış Sabitleri ve constantsHash Bump"
type: adr
status: accepted
date: 2026-08-08
related: ["[[physics-constants]]", "[[gameplay-core]]", "[[goalkeeper]]", "[[adr-0003-sayi-temsili]]"]
---

## Bağlam

Faz 1.2 matris satırları #7 (dribbling), #8 (şut şarjı), #9 (falso), #10 (slide
tackle) ve #11 (kaleci) `packages/core/` içine deterministik olarak indi. Bu
mekaniklerin hiçbiri Faz 1.1'de var olan sabitlerle ifade edilemiyordu: şarj
eğrisi, falso katsayısı, tackle pencereleri, ceza sahası ve kaleci sayaçları
yeni sayılar ister.

Faz 1.1'de KİLİTLENEN sabitlerin **hiçbiri değişmedi**. Ancak `constantsHash`
tüm tabloyu kapsadığı için yeni anahtar eklemek de hash'i kaydırır, ve state
layout'u genişlediği için `STATE_VERSION` da artmak zorundaydı.

| | önce | sonra |
|---|---|---|
| `constantsHash` | `fd1b55e2` | `7f502ae2` |
| `STATE_VERSION` | 1 | 2 |
| `PLAYER_STRIDE` | 8 | 22 |
| `HDR_LEN` | 12 | 20 |
| zincir digest'i (gate senaryosu) | `cce47120` | `5b7752f4` |

## Karar

### 1. Kilitli sabitler korundu, yeni blok eklendi

`PLAYER_ACCEL`, `PLAYER_DAMPING`, `BALL_DAMPING`, `KICK_IMPULSE`, `KICK_RANGE`,
yarıçaplar, bCoef'ler, saha ölçüleri — hepsi bit-bit aynı. Eklenen blok
tamamen yeni mekaniklere ait; eski davranışı değiştiren tek satır yok
(Faz 1.1 uygunluk testlerinin 4'ü de aynen geçiyor: terminal hız 2.4, vuruş
impulse EKLİYOR, duvar sekmesi, disk ayrılma hızı).

### 2. Kontrol yarıçapı türetilmiş bir sayı, serbest bir tuning parametresi değil

`CONTROL_RADIUS = PLAYER_RADIUS + BALL_RADIUS + KICK_RANGE = 29`. Gerekçe
yapısal: "kontrolde" sayılan bir top, düzeltici dokunuşun ERİŞEBİLDİĞİ bir top
olmalı; iki tanım ayrışırsa bot "topum bende" deyip vuramadığı bir topa bakar.

Kabul kriterinin bu sabitle karşılanması bir tesadüf değil ama bir şans:
grid'de 26→40 arası tarandı, 29 tam bandın ortasına (6 dokunuş) düşüyor.

| control radius | 10 m'deki dokunuş | ort. mesafe |
|---|---|---|
| 26 | 10 | 26.1 |
| 28 | 7 | 27.6 |
| **29 (kilitli)** | **6** | **28.3** |
| 32 | 5 | 30.3 |
| 40 | 4 | 34.9 |

### 3. "10 m" saha uzunluğundan türetildi

`UNITS_PER_METRE = 23.3333` (840 birim / 36 m). 36 m, renderer'ın çizdiği
arenanın uzunluğu (`packages/client/src/core/constants.js`: `PITCH_HALF_L = 18`).
Alternatif eşleme kale genişliğinden türetilirdi (110 birim / 7.32 m = 15.03),
bu 10 m'yi 150 birime indirir ve kabul kriterini KOLAYLAŞTIRIRDI. Zor olan
seçildi: 233.33 birim.

### 4. Düzeltici dokunuş, şarjın alt sınırı DEĞİL — ayrı bir impulse

En pahalı karar bu. `gameplay-core.md` iki şey söylüyor: şarj gücü
`0.3x + 0.7x·t^1.5`, ve CMU yakın kontrol deseninde "küçük düzeltici kick".
Bunları aynı düğmeye bağlamayı denedik ve ölçtük — çalışmıyor:

`0.3 × KICK_IMPULSE = 1.5`; sönümü 0.99 olan bir top bu impulse ile 148 birim
yol gider, yani kontrol yarıçapının beş katı. Ölçüm (aynı dribbler, aynı
senaryolar):

| düzeltici dokunuş | zigzag ort. mesafe | zigzag kontrol % | maks. mesafe |
|---|---|---|---|
| 0.3x şarj tap'i (1.5) | 41.6 | 21% | 60.0 |
| yok (sadece gövde teması) | 28.0 | 63% | 31.5 |
| **`TOUCH_IMPULSE` (0.35)** | **28.6** | **60%** | **34.0** |

Yani 0.3x tap bir PAS'tır, dribbling dokunuşu değil. Bu yüzden core'a dokuzuncu
bir buton (`BTN.TOUCH`) ve `TOUCH_IMPULSE = 0.35` (tam vuruşun ~%7'si) eklendi,
`TOUCH_COOLDOWN_TICKS = 6` ile sınırlandı.

Yapışma riski yok ve bu test edilerek gösterildi: düğme sürekli basılı
tutulduğunda top hızlanır, oyuncunun terminal hızını (2.4) geçer ve kaçar —
180 tick boyunca temas yalnızca 4 tick, ortalama mesafe 28.82. Mıknatıs,
yapışma veya otomatik pas core'da hiçbir yerde YOK; "still player asla topu
çekmez" ayrı bir gate kontrolü.

### 5. Ceza sahası oranları 3D sahadan alındı

`PENALTY_HALF_X = 128` (genişliğin %64'ü), `PENALTY_DEPTH = 105`
(yarı-uzunluğun %25'i) — client'taki `BOX_HALF_W/PITCH_HALF_W` ve
`BOX_DEPTH/PITCH_HALF_L` oranlarının aynısı. FIFA oranları (kale genişliğinin
5.5 katı) bu Haxball-orantılı sahada saha genişliğini aşıyordu.

### 6. Kaleci rolü yalnızca `createWorld`'de yazılır

ADR-0001'in doğrudan sonucu: core, maç içi rol değiştiren HİÇBİR API sunmuyor.
`P_ROLE` `resetKickoff`'tan sağ çıkar (gol sonrası da), böylece "gol atıldı,
kaleci sıfırlandı" sınıfı hatalar imkânsız.

### 7. Falso tek skaler, kozmetik Magnus ayrı

`HDR_BALL_CURVE` topun tamamındaki tek spin state'i. Her tick
`v += CURVE_ACCEL · perp(v) · curve`, sonra `curve *= CURVE_DAMPING`. Bu bir
DÖNDÜRME'dir, enerji katmaz (ölçüm: 60 tick sonra hız oranı %1.2 içinde).
Yer pası (`BTN.KICK`) curve'ü sıfırlar ve aftertouch penceresi AÇMAZ; şarjlı
şut ve kaleci ayak degajı açar.

## Kanıt

`node packages/core/test/run.mjs` — 118 kontrol, hepsi GEÇTİ.
`node packages/core/test/tuning.mjs` — ölçüm tablosu.

| Kabul kriteri | Hedef | Ölçüm |
|---|---|---|
| #7 10 m'de dokunuş | 5-8 | **6** (ort. mesafe 28.33, 0 top kaybı) |
| #7 zigzag / 180° dönüş | top kaybı yok | 0 / 0 (kontrol %60 / %48) |
| #8 şarj eğrisi | 0.3x→1x, 100-800 ms | 0.3000 / 0.4964 / 1.0000, sapma < 1e-3 |
| #8 input buffer | 4-6 tick | 5 |
| #10 tackle pencereleri | X + 2X | 12 + 24 tick |
| #10 başarı oranı | %40-55 | **%47.2** (177/375) |
| #10 takım arkadaşı | etkisiz | 0 event, 0 hız değişimi |
| #11 tutma sayacı | 180-240 tick | 210, zorunlu degaj tam sayaçta |
| #11 whiff kilidi | ~60 tick | 60, süre boyunca ivmelenme yok |
| #11 grief kilidi | gol sayılmaz | gol yok, top kalecinin elinde, sayaç tazelendi |

Determinizm korundu: aynı process'te iki koşu, kaydedilmiş input kodlarının
politikasız tekrarı, taze child process ve tick 1234'teki
serialize/deserialize dikişi — dördü de tick-tick özdeş. Senaryo artık her
mekaniği geziyor (gol 1, kick 57, shot 5, touch 188, tackle 19, catch 3,
release 3, save 2, whiff 5) ve gate bunu ayrıca kontrol ediyor.

Statik denetim aynen geçiyor: `Math.random`, `Date`, `performance`, DOM ve
`Math.sin/cos/pow/sqrt/...` yok; paket dışına import yok.

## Sonuçlar

+ Beş matris satırı tek deterministik state'te, host otoriter (dalış, tackle
  ve grief kilidi kararları core'da kesinleşiyor — Rematch'in dive-rollback
  dersi).
+ `controlAdvice` core'dan ihraç edildiği için bot, client ve tuning harness'ı
  aynı yakın-kontrol sorusunu aynı tamsayılarla soruyor.
+ Tuning harness sabitleri yeniden ölçülebilir kılıyor; bantlar hatırlanan
  değil, üretilen sayılar.
− `constantsHash` kaydı: Faz 1.1 replay'leri ve snapshot'ları artık açıkça
  reddediliyor. Kasıtlı; sessiz desync'ten iyi.
− `STATE_VERSION` 2: v1 snapshot'ları reddediliyor.
− `PLAYER_STRIDE` 8→22: full snapshot 4 oyuncu için 512 B'a çıktı; net paketi
  ölçtü, 16 KB tavanının çok altında (16 oyuncu 1616 B).
− Dokuzuncu buton (`BTN.TOUCH`): `packages/net` INPUT mesajı hâlâ tek `kick`
  bit'i taşıyor; wire formatının `buttons` int32'sine geçmesi gerekiyor.

## Alternatifler

**Düzeltici dokunuşu 0.3x şarj tap'ine bağlamak** — ölçüldü, reddedildi
(bkz. §4 tablosu). **Kontrol yarıçapını serbest tuning parametresi yapmak** —
reddedildi, vuruş menzilinden ayrışması bot mantığını bozar. **Dinamik kaleci**
— ADR-0001'de zaten reddedilmişti. **Tam Magnus (ω×v) core'da** — reddedildi,
`gameplay-core.md` kozmetik katmana bırakıyor; core tek skalerle yetiniyor.
