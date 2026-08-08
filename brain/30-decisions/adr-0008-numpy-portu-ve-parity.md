---
title: "ADR-0008 Core'un NumPy Portu ve Parity Rejimi"
type: adr
status: accepted
date: 2026-08-08
related: ["[[adr-0003-sayi-temsili]]", "[[adr-0005-mac-ayarlari-ve-saha-presetleri]]", "[[onnx-bots]]", "[[replay-format]]"]
---

## Bağlam

Matris #42: "NumPy port + parity — JS replay Python'da adım adım özdeş
(checksum)". Faz 2'nin eğitim hattı (MAPPO self-play, #43) Python'da koşacak,
ürettiği politika ise tarayıcıda JS core'un üstünde oynayacak. Bu iki motor
**aynı** simülasyon değilse eğitim boşa gider: ajan Python'daki fiziğe göre
optimal olur, tarayıcıda başka bir oyun oynar. Aynı sorun replay ve P2P desync
tespitinde de var — ikisi de ara state'leri karşılaştırıyor.

ADR-0003 core matematiğini Q16.16 fixed-point'e çekerek bu portun *mümkün*
olmasını sağladı. Bu ADR portun nasıl yazıldığını ve "parity" kelimesinin ne
anlama geldiğini kilitler.

## Karar

`python/haxball3d_sim/` JS core'un **transkripsiyonudur**, yeniden
uygulaması değil: JS spesifikasyon, Python port. Parity **bit-özdeşlik**tir;
hiçbir yerde tolerans yoktur ve kabul ölçütü **tam per-tick checksum
zinciri**dir, son state değil.

Uygulama kuralları:

1. **Layout el ile yazılmaz.** `python/layout.json`, `node
   python/tools/dump-layout.mjs` ile core/bots modüllerinden üretilir (header
   offsetleri, `FIELD`, `BTN`, `CONSTANTS`, saha preset'leri, gözlem spec'i, 18
   aksiyonluk tablo). Python tarafı yalnızca beklediği *şekli* doğrular
   (top ile oyuncunun x/z/vx/vz ön ekini paylaşması, stride genişliği,
   `STATE_VERSION == 3`); uymazsa import anında patlar, tick 1743'te değil.
   Tek istisna `world.js` içinde module-private olan üç bayrak
   (`FLAG_TOUCHING/TACKLE_HELD/DIVE_HELD` = 1/2/4); testte JS kaynağı grep'lenerek
   doğrulanır.
2. **fx.js birebir aynadır.** `fxMul`'ün 16-bit limb bölmesi Python'da
   *gerekli olmadığı halde* korunur: limb formu aynı zamanda truncation'ın
   nerede olduğunu belirler, yani sonucun parçasıdır. `fxDiv`'in JS'teki
   "double bölme + kalanla düzeltme" adımı Python'da tam `//` ile karşılanır
   (JS düzeltmesi zaten sonucu tamsayı-kesinliğine çekiyor). `isqrtInt`
   `math.isqrt`'e eşlenir ve fixture'la JS çıktısına karşı doğrulanır.
   `fxHypot`'un yarılama döngüsü ve sıfır kısayolları aynen taşınır.
3. **Float sınırı tek yerdedir.** `fxFromNumber` / `quantiseAxis` ECMAScript
   `Math.round` semantiğiyle (en yakın, eşitlikte +sonsuza) yazılır —
   `floor(x+0.5)` DEĞİL, çünkü 0.49999999999999994'te ayrışır.
4. **Vektörleştirme ancak sonuç değişmiyorsa.** Sadece oyuncu-bağımsız beş
   aşama numpy int64'e alındı: input ivmesi, entegrasyon, duvar sınırlama,
   dört direk, damping. Bunlar yalnız kendi oyuncusunun slotlarını yazar, yani
   JS'teki döngü sırası gözlemlenebilir değildir. Sıralı kalanlar: darbe
   aşamaları (hepsi TEK topa yazar, i'nin şutu i+1'in menzil testini etkiler),
   disk-disk çarpışmaları, tackle hitbox'ı, kaleci tutuş/dalış (ilk isabette
   `break`). "Sonuç değişmiyor" iddiası testte 3000 tick'lik zincirin iki modda
   karşılaştırılmasıyla kanıtlanır.
5. **Gözlem vektörü de porttur.** `observation.js` yalnız `+ - * /` ve
   `Math.sqrt` kullandığı için float64 aritmetiği iki tarafta da IEEE-754'e
   sabittir; Float32'ye daraltma her iki tarafta round-to-nearest-even'dır.
   Karşılaştırma ondalıkla değil **ham float32 bit deseni** ile yapılır.

## Kanıt (2026-08-08)

`python3 python/test_parity.py` → **68/68 GEÇTİ**, çıkış kodu 0.

| Ne | Sayı | Sonuç |
|---|---|---|
| `constantsHash` (Python'da tablodan yeniden hesaplandı) | — | `7f502ae2` = JS |
| Faz 1.2 senaryosu (4 oyuncu, 3000 tick) | 3001 per-tick checksum | tick-tick özdeş, zincir digest `df22bbc1` = JS |
| Aynı senaryo, vektörleştirilmiş mod | 3001 | skalerle ve JS ile özdeş |
| `golden-goal-kucuk` | 1201 tick | `a2465ad0`, final state kelime kelime özdeş |
| `mercy-buyuk-nokeepers` | 901 tick | `68dbb640` |
| `score-limit-orta` (6 oyuncu) | 701 tick | `fc9e6dfe` |
| `full-time-kucuk-1v1` | 501 tick | `b97b182b` |
| fixed-point op fixture'ları | 1233 tekli × 6 op, 4788 ikili × 7 op, 4788 normalize, 2466 isqrt, 41 CORDIC açısı | tamsayı olarak özdeş |
| FNV-1a (int dizisi + UTF-16 string) | 40 + 8 vaka | özdeş |
| Gözlem vektörü | 44 sahne × 100 özellik = 18800 | float32 bit deseni özdeş, 0 aralık ihlali |
| Determinizm | aynı process'te 2 koşu + taze process | aynı digest |
| Snapshot | tick 1234'te kesip devam | zincir kesintisiz |

**Harness kırılabiliyor mu?** `PLAYER_DAMPING`'e Python tarafında tek LSB hata
enjekte edildiğinde `parity.py` tick 3000'i değil **tick 1'i** ve tam alanı
raporluyor: `player[0].P_VZ  JS 195036  PY 195033  d=-3`, çıkış kodu 1. Yani
geçen test, geçmemeyi de biliyor.

Dört maç-sonu nedeni (full-time, score-limit, mercy, golden-goal), üç saha
preset'i ve kalecisiz mod bu zincirlerin içinde. Fixture'ları üreten node
script'leri tamsayı PRNG kullanır ve saat okumaz: JS değişmediyse yeniden
üretim byte-özdeş, yani `python/fixtures/` içindeki bir diff motorun kaydığı
anlamına gelir.

## Portta yakalanan iki tuzak (kayda geçsin)

İkisi de "Python'da doğal olan, JS'te olmayan" cinsinden ve ikisi de sessizce
yanlış sonuç veriyordu:

- `normaliseSettings` girdisini `isinstance(raw, dict)` ile denetlemek,
  fonksiyonun kendi döndürdüğü donmuş `MappingProxyType`'ı reddedip
  DEFAULT_SETTINGS'e düşürüyordu; JS'te `typeof frozenObject === 'object'`
  olduğu için böyle bir tuzak yok. Sonuç: varsayılan dışı her odada
  `settingsHash`, süre ve kural bayrakları yanlış → tick 0'da ayrışma.
  Düzeltme: `collections.abc.Mapping`.
- `Math.round`'u `floor(x+0.5)` sanmak. Testte `0.49999999999999994` vakası var.

**Q16.16 parity'de aynalanamayan bir JS işlemi bulunamadı.** ADR-0003'ün
"tolerans yok" şartı korunuyor; bir gün böyle bir köşe çıkarsa bu ADR
güncellenip satır BLOKE edilecek, tolerans eklenmeyecek.

## Sonuçlar

+ Python'da eğitilen politika, tarayıcıdaki fiziğin *aynısına* karşı eğitilmiş
  olur; sim-to-sim gap sıfır.
+ Eğitim koşusu da checksum üretir (`env.step` → `info["checksum"]`), yani bir
  eğitim maçı da replay gibi doğrulanabilir.
+ `constantsHash` iki tarafta da kontrol edildiği için, core sabitleri değişip
  fixture'lar yenilenmezse test kırmızıya döner — sessiz kayma imkânsız.
− İki motorun ikiz bakımı: `packages/core` her değiştiğinde `python/` de
  değişmeli ve fixture'lar yenilenmeli. Maliyet bilinçli kabul edildi; alternatifi
  (tek motor) aşağıda.
− Skaler mod Python'da yavaş (4 oyuncu, 3000 tick ≈ 0.42 s; vektörleştirilmiş
  mod bu ölçekte numpy çağrı maliyeti yüzünden ≈4x daha yavaş, 1.74 s — o mod
  hız için değil, "iki yazılış aynı mı" testi için var). Eğitim throughput'u için
  paralel env gerekecek (deney planı bunu bütçeliyor).

## Alternatifler (reddedilenler)

- **Port yerine JS core'u Node üzerinden çağırmak (IPC/embedding).** Parity
  bedava gelirdi ama her tick'te process sınırı geçmek MAPPO'nun ihtiyacı olan
  milyonlarca adımda kabul edilemez; ayrıca vektörleştirilmiş çoklu-env mümkün
  olmazdı.
- **Core'u WASM'a derleyip Python'dan yüklemek.** Determinizm açısından cazip,
  ama core JS ve WASM'a derlemek için önce başka bir dile taşınması gerekirdi —
  yani yine bir port, üstelik iki taraflı.
- **"Yaklaşık" bir Python simülatörü (float, hızlı).** Reddedildi: eğitim ile
  deploy arasındaki fark tam olarak bu projenin kaçındığı şey; ayrıca ADR-0003'ün
  gerekçesini geçersiz kılardı.
- **Toleranslı karşılaştırma (ör. 1 LSB).** Reddedildi. Tolerans, gerçek bir
  desync'i geçen bir teste çevirir; replay formatı ve P2P desync dedektörü için
  testsiz olmaktan kötüdür.
