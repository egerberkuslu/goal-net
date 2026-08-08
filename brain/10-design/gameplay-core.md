---
title: "Oynanış Çekirdeği — Dribbling, Şarj, Falso, Tackle"
type: design
status: active
related: ["[[physics-constants]]", "[[goalkeeper]]"]
---

# Oynanış Çekirdeği

## Özet (BLUF)
Saf fizik, yapışma yok. Haxball sabitleri + CMU RoboCup yakın kontrol
deseni. Tüm mekanikler deterministik core state'inde yaşar.

## Dribbling (saf fizik)
- Temel: top damping (0.99) > oyuncu damping (0.96) → hafif temasla
  itilen top oyuncunun yetişebileceği hızda kalır. Sabitler:
  [physics-constants](../20-tech-spec/physics-constants.md).
- Yakın kontrol algoritması (bot + his): her tick "hareket sonrası top
  kontrol yarıçapında kalacaksa hareket, yoksa küçük düzeltici kick"
  (CMU RoboCup deseni).
- Tuning metodolojisi: headless test harness ile sabit senaryolar
  (düz koşu, zigzag, 180° dönüş) koş; metrikler: ort. top-oyuncu
  mesafesi (hedef band = playerR+ballR ± tolerans), turnover oranı,
  dönüşte kontrol tick sayısı. Grid-search damping/bCoef etrafında.
- Kabul: yetkin oyuncu 10m'yi 5-8 kontrollü dokunuşla kat eder.
  Top kolay kaçıyorsa bCoef 0.5→0.4; yapışık hissederse kickStrength ↑.

## Şut şarjı
- Basılı tutma 100→800ms; güç = 0.3x + 0.7x·(t^1.5) (uzun basış ödülü).
- Input buffer 4-6 tick; touch'ta tut/sürükle ayrımı; şarj iptali ayrı input.
- Şarj core state'te (deterministik); release'te impulse ölçeklenir.

## Falso / spin
- Core: tek signed skaler "curve"; her tick v += k_c · perp(v) · curve;
  spin damping ile söner. Yer pasında curve=0.
- Tam Magnus (ω×v) ve top dönüş görseli SADECE kozmetik katmanda.
- Aftertouch: vuruş sonrası kısa pencerede yön inputu curve'e eklenir
  (Sensible Soccer mirası, analogda ince ayarlı).

## Slide tackle
- Aktif pencere ~X tick (genişleyen hitbox) + recovery ~2X tick
  (hareket kilidi). Topa temas = temiz kazanım.
- Grief kilidi: takım arkadaşına etkisiz (host doğrular).
- Kabul metriği: playtest'te tackle başarı %40-55 bandı; spam
  cezalandırılıyor, öngörü ödüllendiriliyor hissi.

## Pas asisti
- Koni içindeki en uygun takım arkadaşı + lead prediction
  (hedefPos + hedefVel·t_uçuş); manuel yön HER ZAMAN override eder.
- Denge: pas başarı >%90 ise asisti azalt.
