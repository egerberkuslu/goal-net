---
title: "Replay Formatı ve Otomatik Anlar"
type: tech-spec
status: active
related: ["[[physics-constants]]"]
---

# Replay

## Format (input-only)
{ version, constantsHash, seed, mapPreset, roomSettings,
  players[], ticks: [tick → inputs bitmask+yön] }
- Determinizm sayesinde oynatma = core'u aynı inputlarla koşturmak.
- Boyut: bit-packed input → dakikada birkaç KB.

## Versiyonlama
- constantsHash uyuşmazsa: AÇIK RET ("bu replay eski fizik
  sürümüne ait") — sessiz desync ASLA gösterilmez.

## Seek / hızlı sarma
- Her 600 tick'te (10s) keyframe snapshot; seek = en yakın
  keyframe + ara tickleri hızlı simüle.
- Desync tespiti: tick checksum'ları kayıtla karşılaştırılır.

## Paylaşım
- Binary → deflate → base64 URL (kısa maçlar) veya backend'e kaydet
  + kısa ID (uzun maçlar; URL limiti).

## Otomatik "en iyi 3 an"
- Event skorları: gol +100, kurtarış +70, direk/near-miss +50,
  uzak şut +30; son 60 sn çarpanı ×1.5.
- En yüksek 3 olayın [tick-300, tick+180] aralığı klip olarak
  işaretlenir; oynatıcı bu aralıklara atlar.
- Near-miss flag'i core'da üretilir (top direk/kaleci çok yakın geçti).
