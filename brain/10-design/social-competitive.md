---
title: "Sosyal ve Rekabetçi Sistemler"
type: design
status: active
---

# Sosyal / Rekabetçi

## Rating (1.7c)
- Sistem: OpenSkill (Weng-Lin, açık kaynak Bayesian; takım oyunları
  için Elo'dan doğru). Her oyuncu (mu, sigma).
- Placement: ilk 5-10 maç yüksek sigma. Decay: inaktifte sigma artar.
- Parti dengesi: partili kuyrukta ortalama + küçük penalty.
- Rating maçlarında host tarafsızlığı notu: v1'de host oyunculardan
  biri (bilinen sınırlama, ADR'ye yazılır); adanmış host v2.

## Sezonlar
- 2-3 ay; sonunda SOFT reset (mu'yu ortaya sıkıştır, sıfırlama değil);
  rozet + forma ödülü (kozmetik).

## İzleyici modu
- İzleyici input göndermez, snapshot alır. Host upload'u izleyici
  sayısıyla büyür: 4+ izleyicide sınır uyarısı; ölçek gerekirse
  input-stream izleyici (kendi deterministik core'unu koşturur) tercih.

## Klan tag'i
- 3-5 karakter, isim önünde. Filtre: TR+EN küfür listesi,
  homoglyph/leet normalizasyonu. Değişim cooldown'u.

## Quick chat / emote (korumalı)
- Az sayıda nötr ifade + emote tekerleği. Zorunlu korumalar:
  mesaj başına 2-3s cooldown, ardışık-aynı-mesaj spam tespiti,
  per-player mute. (Rocket League "What a save!" sarkazm dersi:
  içerik sansürü değil, mute+cooldown asıl çözüm.)
