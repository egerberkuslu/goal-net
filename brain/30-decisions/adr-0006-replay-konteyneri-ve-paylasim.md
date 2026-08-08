---
title: "ADR-0006 Replay Konteyneri, Keyframe Aralığı ve Paylaşım Yolu"
type: adr
status: accepted
date: 2026-08-08
related: ["[[replay-format]]", "[[adr-0003-sayi-temsili]]", "[[adr-0005-mac-ayarlari-ve-saha-presetleri]]"]
---

## Bağlam

Faz 1.7b matris satırları #30 (tam maç replay'i), #31 (replay paylaşımı) ve
#32 (otomatik "en iyi 3 an") tek bir dosya biçimine bağlanıyor.
[replay-format.md](../20-tech-spec/replay-format.md) input-only bir replay,
600 tick'lik keyframe'ler, deflate+base64 paylaşım ve olay skorlarıyla klip
seçimi istiyor; geriye üç somut soru kalıyor: konteyner tam olarak hangi
baytlar, keyframe'ler dosyada mı durmalı, ve bir maç URL'e sığar mı.

Ölçüm için 60 saniyelik senaryolu bir bot maçı (2v2, bir kaleci, zor/kolay)
`packages/replay/test/run.mjs` içinde kayda alındı; sayılar oradan.

## Karar

**Konteyner sabit 64 baytlık header + roster + TLV bölümleri + 8 baytlık
trailer'dır; keyframe'ler dosyada AMA opsiyoneldir; paylaşımın varsayılan
yolu kısa ID'dir, URL yalnızca klip boyu replay'ler içindir.**

### 1. Header iki hash'i de taşır, uyuşmazlık AÇIK RET

`constantsHash` (aynı build miyiz) ve `settingsHash` (aynı oda muyuz)
ADR-0005'teki ayrımla birebir aynı. `decode()` ikisini de doğrular ve
`ReplayError` fırlatır; kod stabildir (`constants-hash`, `settings-hash`,
`roster`, `corrupt`, `truncated`, ...). "Best effort oynat" yolu YOKTUR.
Roster header'da hem bayt olarak hem de keyframe state'inin içinde durur;
ikisi çelişirse ret — yoksa takım baytını çeviren biri skoru başkasının
üstüne yazdırırdı.

Trailer'daki fnv1a bütün baytları kapsar, yani kesilmiş/bozulmuş bir dosya
yarım yüklenmez, `corrupt` ile düşer.

### 2. Input akışı: oyuncu başına delta + RLE

Tick başına input iki Q16.16 eksen + 9 bitlik buton maskesi = ham 10 bayt.
Akış oyuncu başına ayrı tutulur; her kayıt `ctrl` baytı + (gerekiyorsa) run
varint'i + değişen alanların zigzag varint delta'sıdır. `ctrl` bit3 "run > 1"
demektir: her tick yön değiştiren bir bot run baytı hiç ödemez, tuşu 40 tick
basılı tutan insan 40 tick için bir tane öder.

Ölçüm (3 dakika = 10800 tick):

| kayıt | ham | kodlanmış | keyframe'siz | + deflate |
|---|---|---|---|---|
| 4 oyuncu, bot | 421.9 kB | 176.6 kB | 167.8 kB | 120.5 kB |
| 6 oyuncu, bot | 632.8 kB | 230.9 kB | 219.1 kB | 154.9 kB |
| 2 oyuncu, tuş basılı (insan profili) | 70.3 kB | 2.9 kB | 1.0 kB | 0.3 kB |

Bot maçı en kötü durumdur: scripted politika her tick sürekli değişen bir
yön vektörü üretir, yani sıkıştırılacak tekrar yoktur. İnsan girişi 8 yöne
oturduğu için spec'in "dakikada birkaç KB" hedefi gerçek maçlarda tutuyor;
bot maçları için tutmuyor ve bu kabul edildi (bot maçı zaten host'ta yeniden
üretilebilir).

### 3. Keyframe aralığı 600 tick (10 s), ama keyframe VERİ DEĞİL İNDEKStir

`serialize()` snapshot'ı 4 oyuncuda 496 bayt. Üç dakikalık maçta:

| aralık | keyframe | boyut | en kötü seek |
|---|---|---|---|
| 300 t | 37 | 18.4 kB | 299 adım |
| **600 t** | **19** | **9.4 kB** | **599 adım** |
| 1800 t | 7 | 3.5 kB | 1799 adım |

600 seçildi çünkü 599 adım ölçülen ~1.4 ms — bir frame'in çok altında, yani
daha sık keyframe kullanıcının hissedeceği bir şey satın almıyor. Keyframe'ler
input'lardan yeniden üretilebilir olduğu için paylaşım yolunda atılır;
`player.js` ileri oynarken indeksi kendisi doldurur, maliyeti ilk geri
seek'te bir ileri geçiştir.

### 4. Paylaşım: varsayılan kısa ID, URL sadece klip için

base64 3 baytı 4 karaktere çevirir; güvenli URL tavanı 2000 karakter, yani
~1.4 kB sıkıştırılmış replay. Üç dakikalık bot maçı base64'te 164 kB,
10 saniyelik bot klibi bile 11.8 kB. Dolayısıyla:

- `toUrl()` sığmayan bir replay için link ÜRETMEZ, `{ ok: false, reason:
  'too-long' }` döner — yarısı kesilmiş bir link paylaşmaktansa reddeder.
- `publish(container, store)` içerik adresli 16 haneli ID üretir (iki farklı
  seed'li fnv1a) ve `store` arayüzüne yazar (`put/get/has`). Sunucu bunu
  dizin, S3 ya da tablo üstünde uygular; paket taşımayı bilmez.
- İnsan girişli kısa klipler (0.3 kB) URL'e rahat sığar, o yol duruyor.

Sıkıştırma bağımlılık eklemeden yapılır: Node'da `node:zlib`
(`deflateRawSync`), tarayıcıda `CompressionStream('deflate-raw')`. İkisi de
ham DEFLATE, yani Chrome'da sıkıştırılan replay Node'da açılır.

### 5. Woodwork core'da değil, kayıtta türetilir

Core direkleri statik disk olarak çözüyor ve bir olay üretmiyor. Fizik
tarafına dokunmak `constantsHash`'i riske atacağı için direk çarpması
recorder'da türetiliyor: top direk temas menzilinde ve radyal hızı
yaklaşmadan uzaklaşmaya döndüyse woodwork. Tamsayı aritmetiği (fxHypot,
nokta çarpımları), yani iki host aynı işareti koyar. Yarım saniyelik debounce
top direkte sekerken üst üste işaret koymayı engelliyor.

### 6. Klip seçimi: goller her zaman girer

Skorlar spec'ten (gol 100, kurtarış 70, direk 50, uzak şut 30, son 60 sn
×1.5). Sıralama önce bütün golleri alır, sonra kalan slotları örtüşmeyen en
yüksek skorlularla doldurur; iki gol aynı pencereyi paylaşırsa pencere orta
noktadan bölünür, gol düşürülmez. Sebep: geç bir kurtarış 105 puanla erken
bir golü geçer, ama golü atlayan bir özet yanlıştır. "Son 60 saniye" maç
saatine göre ölçülür, kaydın uzunluğuna göre değil.

## Sonuçlar

+ Replay = header + input; oynatma core'un kendisi, ayrı bir "replay motoru"
  yok, dolayısıyla desync mümkün değil (zincir digest'i doğruluyor).
+ Eski/başka build'e ait replay sessizce oynanamaz.
+ Keyframe'ler atılabildiği için paylaşım boyutu ile seek maliyeti ayrı ayrı
  ayarlanabiliyor.
− Bot maçları büyük: 3 dakika ≈ 120 kB sıkıştırılmış. URL yolu pratikte
  yalnızca insan girişli kısa klipler için.
− Woodwork bir sezgisel; core bir gün gerçek olayı yayarsa recorder'daki
  türetme kaldırılmalı.

## Alternatifler (reddedilenler)

- **Tick başına checksum'ı dosyada tutmak:** 4 bayt/tick, 3 dakikada 43 kB,
  yalnızca hata ayıklama değeri için. Varsayılan tek kelimelik zincir
  digest'i + keyframe checksum'ları; tam zincir `checksums: 'full'` ile
  opsiyonel.
- **State kaydetmek (top/oyuncu pozisyonları):** determinizm varken saf
  israf, ayrıca replay'i "izleyicinin katılmadığı" bir kayda dönüştürürdü.
- **Eksenleri kayıplı sıkıştırmak (8 bit):** simülasyonu değiştirir, replay
  artık aynı maç olmaz.
- **Her replay'e rastgele bir ID:** aynı maçın iki kopyası iki nesne olurdu;
  içerik adresli ID tekilleştiriyor. Tahmin edilemez link isteyen sunucu
  kendi rastgele alias'ını bu ID'ye gösterir.
