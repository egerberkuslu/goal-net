---
title: "Kaleci — Maç Başı Seçim, Tutma, Degaj, Dalış"
type: design
status: active
related: ["[[gameplay-core]]", "[[adr-0001-sabit-kaleci]]"]
---

# Kaleci

## Özet (BLUF)
Kaleci MAÇ BAŞINDA SEÇİLİR ve maç boyunca sabittir (ADR-0001).
Dinamik/otomatik kaleci atama YOKTUR. Ceza sahasında özel yetkiler,
dışında normal oyuncudur.

## Rol seçimi
- Lobide takım kurulurken her takım bir kaleci slotu doldurur
  (4v4 kalecili modda zorunlu; 3v3'te kaleci yok, herkes saha oyuncusu).
- Slot boş kalırsa host maç başında rastgele/ilk katılana atar
  (deterministik: en düşük playerId).
- Takas yalnızca maçlar ARASINDA (lobiye dönünce). Maç içi takas yok.
- Bot kaleci: bot takımlarında kaleci slotu bota atanır; MARL fazında
  kaleci rolü role-embedding ile aynı politikada öğrenilir.

## Mekanikler (hepsi core'da, deterministik)
- Tutma: ceza sahası içinde top temasında "tut" inputu → top kaleciye
  sabitlenir, sayaç ~180-240 tick (3-4 sn). Süre dolunca zorunlu degaj.
- Degaj: iki ayrı input — elle atış (düz, orta güç) / ayakla degaj
  (şarjlanabilir, uzun). Grief kilidi: tutuştan kendi kalesine gol
  sayılmaz (host doğrular, top çizgiyi geçerse degaj tekrarı).
- Dalış: 4 yön (sol/sağ alçak, sol/sağ uzanma). Dalış impulse'u
  kaleciye; topa temas ederse kurtarış. Iskalarsa (whiff) ~60 tick
  yerde kilit (savunmasız). DALIŞ SONUCU HOST'TA KESİNLEŞİR —
  client tahmini gol/kurtarışı asla nihai gösteremez (Rematch'in
  dive-rollback bug dersi).
- Ceza sahası dışında: el yetkileri kapalı, normal saha oyuncusu.

## Kozmetik (read-only)
- Bekleme duruşu, yan adımlama, dalış+kalkış, tutma/yumruklama,
  degaj animasyonları → [animation-standard](../20-tech-spec/animation-standard.md).
