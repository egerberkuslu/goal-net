---
title: "ADR-0003 Core Sayı Temsili (fixed-point vs float)"
type: adr
status: accepted
date: 2026-08-07
updated: 2026-08-08
related: ["[[physics-constants]]", "[[replay-format]]"]
---

## Bağlam

Saf JS float cross-platform bit-determinizmi garanti etmez; replay, P2P
doğrulama ve NumPy parity bit-özdeşlik ister. Somut sorun `Math.*`
transcendental fonksiyonlarıdır: ECMAScript spesifikasyonu `Math.sin`,
`Math.cos`, `Math.pow`, `Math.exp` vb. için "implementation-approximated"
der ve v8 / SpiderMonkey / JavaScriptCore gerçekten farklı bit üretir.
`+ - * /` ve `sqrt` IEEE-754 tarafından tam belirlenmiştir, ama mevcut core
(`src/core/`) float state + `Math.random` + `performance.now()` kullanıyor
(bkz. [INVENTORY](../40-progress/INVENTORY.md) "invariant çelişkileri" #5).

## Karar

Core matematiği **Q16.16 fixed-point** (Int32 üzerinde işaretli tamsayı)
yazılır. Faz 1.1'de sıfırdan `packages/core/` altında uygulandı ve kabul
testi geçti → **accepted**.

Uygulama kuralları:

- State'in tamamı tek bir `Int32Array` içinde yaşar; float state YOK.
- `fxFromNumber` / `fxToNumber` tek float sınırıdır: sabit tablosu yazımı,
  input quantisation ve render okuması. Tick içinde asla çağrılmaz.
- Çarpma/bölme 64-bit ara değerle yapılır; ara değerler 16-bit limb'lere
  bölünerek 2^53 altında tutulur, yani tam tamsayı aritmetiğidir. Sonuç
  BigInt referansıyla 30.000 rastgele çiftte bit-özdeş doğrulandı.
- `sqrt` / `hypot` basamak-basamak tamsayı karekök (Newton/`Math.sqrt`
  tohumu yok) → tam `floor(sqrt(x))`.
- `sin`/`cos` 16 iterasyonlu CORDIC + gömülü (literal) atan tablosu; tablo
  `Math.atan` ile üretilmez, kaynakta sabit yazılıdır. Simülasyon sıcak
  yolunda kullanılmıyor, sadece API tamlığı için var.
- Tüm operatörler taşmada wrap değil **saturate** eder; çarpma/bölme sıfıra
  doğru truncate eder (sönümlenen hız tam 0'a iner, son bitte salınmaz).

Aralık/çözünürlük: ±32768, adım 1/65536 ≈ 1.53e-5. Saha yarı boyu 420
birim, terminal hız 2.4 birim/tick → aralığın binde biri bile kullanılmıyor;
`fxHypot` 1024 birime kadar tam, üstünde bit kaybederek güvenli küçülüyor.

## Kanıt (Faz 1.1 kabul testi)

`node packages/core/test/run.mjs` — 58 kontrol, 3 ardışık koşuda 3/3 GEÇTİ,
çıktı byte-özdeş:

- 3000 tick'lik senaryo (4 oyuncu, 185 vuruş, 1 gol) aynı process içinde iki
  kez → checksum zinciri tick-tick özdeş.
- **Taze child process** (`node test/run.mjs --dump-trace`) → aynı zincir.
  Gizli modül-seviyesi state olmadığının kanıtı.
- `serialize` → `deserialize` → devam (tick 1234'te kesilerek) → kesintisiz
  koşunun zinciriyle özdeş.
- Kaydedilmiş input kodları tek başına oynatıldığında (politika döngü dışı)
  aynı zincir → replay formatı için yeterli.
- `constantsHash` = `fd1b55e2`, zincir digest'i = `cce47120`.
- Statik denetim: `packages/core/src/` içinde `Math.random`, `Date`,
  `performance`, `document`, `window` ve `Math.sin/cos/pow/sqrt/...` YOK;
  paket dışına import YOK.

Fizik uygunluğu aynı gate'te: terminal hız 2.40019 (analitik 2.40057, kilitli
2.4 ± 0.01), vuruş impulse EKLİYOR (duran topta +5, −3 hızla giden topta
+2), top damping > oyuncu damping, duvar sekmesi bCoef × gelen hız,
disk-disk ayrılma hızı bCoef × yaklaşma hızı.

## İkinci motor doğrulaması (koordinatör, 2026-08-08)

Kabul kriterinin "2 farklı cihaz/tarayıcı" ayağı kapatıldı: aynı 3000
tick'lik senaryo hem Node 20 (V8, sunucu tarafı) hem de Chromium'da
(tarayıcı, vite üzerinden ESM import) koşturuldu —
`packages/client/enginecheck.html` sayfası ile:

| Motor | constantsHash | zincir digest |
|---|---|---|
| Node 20 | `fd1b55e2` | `2132210153` |
| Chromium (Playwright) | `fd1b55e2` | `2132210153` |

Bit-özdeş. Kalan tek boşluk farklı bir JS motoru ailesi (SpiderMonkey /
JavaScriptCore, yani Firefox/Safari) — MANUAL-TESTS'e yazıldı; aynı sayfa
o tarayıcılarda açılıp `window.__parity` okunacak.

## Sonuçlar

+ Bit-özdeş replay/parity; MARL (NumPy) portu aynı tamsayı temsille yazılıp
  `--dump-trace` çıktısıyla tick-tick karşılaştırılabilir.
+ `constantsHash` sabit tablosunu kilitliyor; uyuşmayan snapshot/replay
  sessizce desync olmak yerine açıkça reddediliyor.
− Tuning ve okunabilirlik maliyeti: her ifade `fxMul(a, b)` biçiminde.
− Faz 1.2'de oynanış `src/core/` float dünyasından buraya taşınırken
  sabitler yeniden ölçülmek zorunda (float davranış birebir korunmuyor).
