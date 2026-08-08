---
title: "Sunum — Anlatım, Tansiyon, Forma, Stadyum, İstatistik"
type: design
status: active
---

# Sunum Katmanı (tamamı kozmetik, core'dan read-only)

## Maç anlatımı (1.7d)
- Event bus (core olayları: gol, kurtarış, direk, tackle, son dk) →
  commentary manager: öncelik (gol > kurtarış > genel), kesme kuralı,
  klip başına cooldown, tekrar engeli.
- Klipler ÖNCEDEN üretilir (runtime TTS YOK): 30-50 replik × TR+EN ×
  normal/coşkulu. Üretim: ElevenLabs (ticari kalite) veya açık kaynak
  (XTTS-v2 Türkçe'de en iyi ama NON-COMMERCIAL lisans — yayın öncesi
  lisans kontrolü ŞART; Piper fork GPL-3.0 daha robotik).
  Format: opus/mp3.

## Tansiyon sistemi
- Girdi: skor farkı, kalan süre, topun kaleye yakınlığı → tek
  "tansiyon" değeri (0-1). Çıktı: crowd loop katmanı crossfade
  (sakin/orta/coşkulu), tezahürat sıklığı, anlatıcı varyant seçimi.
- Web Audio: GainNode ducking (anlatım çalarken crowd kısılır);
  iOS: ilk user gesture'da AudioContext.resume().

## Forma sistemi
- Tek base texture + grayscale renk maskeleri → shader'da takım rengi;
  numara SDF font/atlas; klan tag entegrasyonu. Kırışıklık normal map.

## Stadyum varyantları
- Gece/gündüz: baked lightmap varyantları + ambient renk; realtime
  yalnız 1 directional shadow (düşük çözünürlük).
- Hava: GPU partikül (Points/instanced); yağmur kısa çizgi billboard,
  kar yavaş Points; overdraw sınırlı, mobilde otomatik azalt.
- Tribün temaları: renk/doku varyantları (yerleşik, editör yok).

## İstatistik + MVP
- Event bus'tan: şut, isabet, pas, top kazanma, kurtarış.
- xG-lite: şut anında mesafe+açı+kaleci pozisyonundan 0-1 skor.
- MVP = gol×3 + asist×2 + kurtarış×2 + xG katkısı + top kazanma
  (şeffaf, ekranda gösterilebilir formül).
