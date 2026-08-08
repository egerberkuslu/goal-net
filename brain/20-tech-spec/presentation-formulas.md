---
title: "Sunum Formülleri — Tansiyon, xG-lite, MVP"
type: tech-spec
status: active
updated: 2026-08-08
---

# Sunum katmanının üç formülü

Faz 1.7d, matris #38-#41. Kod: `packages/client/src/arena/present/`.
Test: `npm run test:present` (158 kontrol).

Üçü de **saf, deterministik ve kozmetik**. Hiçbiri `packages/core`'a
yazmaz, hiçbirinin çıktısı oyunun kurallarına girmez. Katmanı tamamen
silsen maç bit bit aynı oynanır — sunum katmanının tanımı budur.

---

## 1. Tansiyon (#39) — `present/tension.js`

Skor, saat, top konumu ve topa sahip olma dengesinden tek bir sayı: `[0,1]`.

### Bileşenler (hepsi zaten `[0,1]`)

| Bileşen | Tanım | Gerekçe |
|---|---|---|
| `closeness` | `1 / (1 + |skor0 − skor1|)` | Beraberlik 1, tek fark 0.5, iki fark 0.333. Hiperbolik, çünkü seyircinin hissettiği fark "berabere → bir gol"dür; dört ile beş gol arası değil. |
| `urgency` | `1 − kalanSaniye / toplamSaniye` | Saatte doğrusal. Altın gol devresinde sabit 1: her saniyesi son saniyedir. |
| `territory` | `|topZ| / halfZ` | Core 2B, uzun eksen z. Topun bir kaleye ne kadar yakın olduğu. |
| `balance` | `1 − |sahip0 − sahip1|` | Çekişmeli maç gergindir; tek taraflı antrenman değildir. |

### Birleşim

```
T = 0.45 · closeness · (0.4 + 0.6 · urgency)
  + 0.25 · urgency
  + 0.20 · territory
  + 0.10 · balance
```

Ağırlıklar bilerek 1'e toplanıyor: dört bileşen de 1 iken
`0.45 + 0.25 + 0.20 + 0.10 = 1` çıkar, hepsi 0 iken 0 çıkar. Yani clamp
formülü kurtarmıyor, sadece bozuk girdiye karşı duruyor.

`closeness` ham değil `(0.4 + 0.6 · urgency)` ile çarpılıyor: ilk dakikada
0-0 ile son dakikada 0-0 aynı olay değil. Skor tablosu ancak düzeltecek
zaman kalmadığında korkutucu olur. `0.4` tabanı, erken beraberliği "ölü"
göstermemek için.

**Altın gol**: ayrı bir dal değil, `T = max(T, 0.85)` tabanı. Böylece ani
ölümde bile değer top konumuyla oynamaya devam eder.

**Determinizm**: IEEE double aritmetiği, sonra `1e-4`'e yuvarlama. Aynı
girdi her makinede aynı sayıyı verir; bir replay anlatım parçasını birebir
tekrar üretir.

**Monotonluk** (testle sabitlendi):

- skor farkı ↑ → T ↓
- kalan süre ↓ → T ↑
- top kaleye yaklaştıkça → T ↑
- topa sahip olma dengelendikçe → T ↑

### Tüketiciler

- **Kalabalık** (atmosfer agent'ı): `createTensionMeter().subscribe(fn)`.
  Yarı ömrü 0.6 s olan üstel yumuşatma — tribün adım adım değil, dalga
  dalga yükselir. Atmosfer katmanı `present/` içinden yalnız bu kancayı
  görür; `present/` de `atmos/` içinden hiçbir şey görmez.
- **Anlatım yoğunluğu**: `commentaryGapMs(T)` = 3200 ms (T=0) → 900 ms
  (T=1), doğrusal.
- **Replik seçimi**: her replik bir tansiyon penceresi taşır
  (`goal_plain` [0, 0.55], `goal_hot` [0.55, 1]).

### Bantlar

`sakin` < 0.34 ≤ `orta` < 0.67 ≤ `coskulu` — kalabalık döngüsü crossfade'i
için.

---

## 2. xG-lite (#41) — `present/xg.js`

Bir şutun gole dönme olasılığı. Beş özellikli lojistik regresyon; her
yayınlanmış xG modelinin şekli budur. "Lite" olmasının sebebi
katsayıların elimizde olmayan şut verisine fit edilmesi değil, bu arenaya
elle ayarlanmış olmasıdır — bu yüzden tamamı burada yazılı ve tek yerden
yeniden ayarlanabilir.

```
xG = 1 / (1 + e^(−z))

z = −3.20                 sabit terim
    − 0.055 · d           kale ağzının merkezine uzaklık, metre
    + 5.00  · θ           kale ağzının gördüğü açı, radyan
    − 1.20  · press       en yakın rakip baskısı, [0,1]
    − 2.60  · cover       kalecinin şut hattını kapaması, [0,1]
    + 0.60  · power       şut şarjı, [0,1]
```

### Katsayı gerekçeleri

- `−0.055/m` küçük, çünkü mesafe bilgisinin çoğunu zaten θ taşıyor
  (geri çekildikçe daralır). Bu terim aynı açıdaki iki şutu ayırır.
- `+5.00/rad` baskın terim: golcünün pozisyonla satın aldığı şey kale
  genişliğidir.
- `−2.60` tek en büyük negatif; kaleci, mutlaka geçilmesi gereken tek
  vücuttur, bu yüzden baskıdan büyük.
- `+0.60` bilerek ölçülü: bu core'da güç hız satın alır, isabet değil.

### Özellikler

- `d` = şut noktasından kale merkezine `(0, ±halfZ)` uzaklık.
- `θ` = iki direğe giden vektörler arasındaki açı:
  `θ = acos((a·b)/(|a||b|))`, direkler `(±goalHalfX, ±halfZ)`.
  Kale çizgisinin arkasında θ = 0 → xG = 0.
- `press` = `clamp01(1 − enYakınRakipMesafe / 4 m)`. Kaleciler hariç.
- `cover` = `clamp01(1 − dik_mesafe / (goalHalfX + playerR)) · clamp01(along)`
  — `along`, kalecinin şut→kale doğrusu üzerindeki izdüşümü; şutörün
  arkasındaki kaleci (along ≤ 0) hiçbir şeyi kapatmaz.
- `power` = şarj / `CHARGE_MAX_TICKS`.

### Çalışılmış örnekler

`goalHalfX = 2.357 m`, `halfZ = 18 m` (orta preset, metre).

| # | Şut | d | θ | cover | güç | z | xG |
|---|---|---|---|---|---|---|---|
| A | (0, 16) boş kale | 2.000 | 1.7344 | 0 | 0.5 | +5.6620 | **0.9965** |
| B | (0, 12) temiz | 6.000 | 0.7487 | 0 | 0.8 | +0.6935 | **0.6667** |
| C | B + kaleci çizgide | 6.000 | 0.7487 | 1.0 | 0.8 | −1.9065 | **0.1294** |
| D | (0, 0) orta saha | 18.000 | 0.2604 | 0.944 | 1.0 | −4.7436 | **0.0086** |
| E | (8, 17) dar açı | 8.062 | 0.0791 | 0 | 0.5 | −2.9479 | **0.0498** |

Örnek B'nin açılımı:
`−3.20 − 0.055·6 + 5·0.7487 + 0.6·0.8 = −3.20 − 0.33 + 3.7435 + 0.48 = 0.6935`,
`1/(1+e^−0.6935) = 0.6667`.

Çıktı `1e-4`'e yuvarlanır. Testte beşi de sabittir; katsayı değişirse
test kırılır, sessizce kaymaz.

---

## 3. MVP (#41) — `present/stats.js`

Ekranda ismin yanında basılan ağırlıklı toplam. Denetlenemeyen puan,
güvenilmeyen puandır.

```
MVP = 3.00 · gol
    + 2.00 · asist
    + 2.00 · kurtarış
    + 1.50 · xG
    + 1.00 · kazanılan top
    + 0.50 · isabetli şut
    + 0.15 · pas
    − 0.75 · faul
    − 2.00 · kendi kalesine
```

| Ağırlık | Gerekçe |
|---|---|
| gol 3 | Skor tablosunu değiştiren tek eylem; hiçbir orta saha temizliği bunu geçmemeli. |
| asist 2 | Golü hazırlayan pas golün üçte ikisi. Takım arkadaşının yarattığı maçın MVP'si golcü olmasın diye. |
| kurtarış 2 | Kurtarış, engellenmiş goldür. Golle simetrik, eksi üçte bir: kaleci golcüden daha çok pozisyonla karşılaşır. |
| xG 1.5 | İyi pozisyona girmeyi, bitiriş dışarı gitse de ödüllendirir; tek şanslı 30 metrelik golün beş net pozisyon yaratan golcüyü geçmesini engeller. Golden asla büyük olamayacak kadar küçük (gol 3 + kendi xG'si ≤ 1.5). |
| top kazanma 1 | Temiz bir müdahale golün üçte biri. |
| isabet 0.5 | Kaleciyi çalıştıran deneme. |
| pas 0.15 | Hacim işi, bilerek sıfıra yakın: yüz pas ≈ 1.5 gol, doğru orantı bu. |
| faul −0.75 | İyi bir maçı silmeyecek kadar ucuz, fark edilecek kadar gerçek. |
| kendi kalesine −2 | Kendi kalesine gol, takım için golün iyi olduğundan daha kötüdür. |

**Eşitlik bozma** (deterministik): puan → gol → xG → düşük oyuncu indeksi.
Asla yineleme sırası.

### İstatistik satırlarının tanımı

Hepsi core'un kendi olay akışından + tick başına bir `readState()`
örneğinden türetilir; kaydedici dünyaya yazmaz, adım attırmaz, tahmin
etmez. Aynı `(olaylar, durum)` dizisi aynı tabloyu verir — "kaydedilmiş
maç verisinden deterministik" ifadesinin anlamı budur, MVP dahil.

| Satır | Tanım |
|---|---|
| Şut | Ayaktan gole doğru ≥ 6 m/s hızla çıkan `kick` veya `shot` |
| İsabetli şut | O şutun kale ağzına ulaşması, kurtarılması, tutulması veya girmesi |
| Gol | core `goal` olayı, son dokunana yazılır |
| Kurtarış | `keeper-save`, artı canlı bir şutu durduran `keeper-catch` |
| Top kazanma | `won: true` olan `tackle` |
| Pas | Bu oyuncunun dokunuşundan sonra 3 s içinde takım arkadaşının dokunması |
| Direk | Türetilmiş: top, direğin kendi yarıçapı içindeyken hız yönünü tersine çevirir (core'da direk olayı yok) |
| Topa sahip olma | Son dokunuşun o takıma ait olduğu tick sayısı |
| Faul | Arena kural setinde faul yok; sayaç, faulü olan bir mod aynı ekranı kullanabilsin diye duruyor |

---

## Nerede yaşıyor

```
packages/client/src/arena/present/
  lines.js      29 replik × TR/EN, öncelik, cooldown, süre, tansiyon penceresi
  manifest.js   replik id + dil -> dosya (klip manifesti), doğrulama, kayıt fişi
  clips.js      Web Audio çalar + null çalar; ducking kancası
  commentary.js yönetmen: seçim, öncelik, kesme, cooldown, yoğunluk, kuyruk
  bus.js        core olayları + durum -> futbol olayları (+ kontra, dominans, baskı)
  tension.js    bu belgenin 1. bölümü
  xg.js         bu belgenin 2. bölümü
  stats.js      kaydedici + MVP (3. bölüm)
  screen.js     maç sonu ekranı (DOM)
  stadium.js    varyant tabloları, oda seçimi, cihaz sezgileri (three'siz)
  sky.js        varyantı canlı sahneye uygulayan tek three dosyası
  index.js      attachPresentation() — tek montaj noktası
  tools/make-clips.mjs   placeholder klip üreteci
```
