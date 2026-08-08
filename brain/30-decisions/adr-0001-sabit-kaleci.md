---
title: "ADR-0001 Sabit Kaleci (maç başı seçim)"
type: adr
status: accepted
date: 2026-08-07
---
## Bağlam
Araştırma Rematch'in dinamik kaleci modelini (ceza sahasına giren en
yakın oyuncu kaleci olur) adaylaştırdı. Kullanıcı kararı: kaleci maç
başında seçilsin, dinamik olmasın.
## Karar
Kaleci lobide/maç başında seçilir ve maç boyunca sabittir. Takas
yalnızca maçlar arasında. Boş slot host tarafından deterministik atanır.
## Sonuçlar
+ Rol netliği; UI/his basit; MARL'da rol embedding'i temiz.
+ "Kutuda kim var" tie-break karmaşası yok.
− Kalecisi ayrılan takım maç boyu dezavantajlı (yeniden atama:
  ayrılma halinde host en düşük playerId'li saha oyuncusunu atar —
  tek istisna).
## Alternatifler
Rematch dinamik modeli — reddedildi (kullanıcı tercihi + basitlik).
Sweeper etiketi — v2 havuzuna.
