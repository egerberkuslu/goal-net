---
title: "Modlar, Kurallar, Oda Ayarları"
type: design
status: active
---

# Modlar ve Kurallar

## Modlar
- İnsan vs bot (tek kişilik pratik), 3v3 (kalecisiz), 4v4 kalecili.
- Zorluk seçimi: kolay/orta/zor (Faz 2'ye kadar scripted; sonra
  ONNX checkpoint'leri).

## Maç kuralları
- Süre + skor limiti (oda ayarı). Beraberlikte: golden goal AÇIK ise
  ilk gol bitirir; KAPALI ise berabere biter.
- Mercy rule (oda ayarı, varsayılan açık): 4 gol farkta maç biter.
- Top dışarı: core "T tick sonra şu noktadan restart" der; görsel
  sahneler (top toplayıcı) kozmetik katmanda oynar.

## Saha preset'leri
- Küçük / Orta / Büyük — core'da harita parametresi (boyut, kale
  genişliği, restart noktaları). Oyuncular arası fizik farkı YOK.
- Kullanıcı haritası/editörü YOK (ADR-0002).

## Oda ayarları senkronu
- Host canonical: süre, skor limiti, saha, golden goal, mercy,
  mod. Client değişiklik talebi → host onaylar → lobby snapshot.
- Ayarlar lobide tüm oyunculara görünür; maç başladıktan sonra kilitli.
