---
title: "Animasyon Standardı"
type: tech-spec
status: active
related: ["[[rendering-optimization]]"]
---

# Animasyon Standardı (kozmetik katman)

## Locomotion
- 8 yönlü strafe blend space (ileri/geri/yan/diyagonal), hız+yön
  parametreli; AnimationMixer + setEffectiveWeight + crossFade.
- TEK KLİP KOŞU KABUL EDİLMEZ. Motion matching KULLANILMAZ
  (tarayıcıda olgun değil).

## Prosedürel katmanlar (core'dan read-only)
- Üst gövde/kafa topa bakış (bone aim), dönüşte spine lean.
- Ayak IK: iki-kemik analitik çözüm (CCDIK yerine tercih; Mixamo
  offset sorunları bilinen issue). IK hedefi core state'inden okunur.
- Core temas olayı → additive "tap" (dokunuş senkronu).
- Additive nefes/idle mikro hareket.

## Klip listesi
- Saha: 8 yön koşu, normal/falso/şarjlı vuruş, hazırlanma, sendeleme,
  slide tackle, idle, 3-5 gol kutlaması.
- Kaleci: bekleme, yan adım, 4 dalış + kalkış, tutma/yumruklama,
  el/ayak degaj.
- Kamera: sert vuruşta sarsıntı, gol sonrası kısa replay.

## Araç zinciri
- Mixamo baz (indirme HUMAN-QUEUE) → Blender retarget → glTF.
- Eksik tekil aksiyonlar: Cascadeur (ücretsiz katman ~300 frame) veya
  Blender keyframe; video-to-motion: Rokoko Vision (ücretsiz) /
  FreeMoCap (açık kaynak, 3060'ta lokal).
- Hit reaction'lar canned animasyon; ragdoll YOK (v2, yalnız kozmetik).
