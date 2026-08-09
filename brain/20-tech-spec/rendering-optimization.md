---
title: "Render, Kalabalık, Cloth ve Asset Pipeline"
type: tech-spec
status: active
---

# Render ve Optimizasyon

## Bütçeler
- Sahne bütçesi cihaz katmanına göre (`arena/assets/quality.js` BUDGETS):
  - **masaüstü: 2.5M üçgen / 600 draw call**, **yüksek: 4M / 900**
  - mobil: 200k / 60, düşük: 150k / 50 — bunlar politika değil, telefonun
    gerçekten çizebildiği; katman sistemi zaten masaüstünü telefondan ayırıyor
  - 2026-08-09'da yükseltildi: eski 150k tavanı orta seviye telefon için
    konmuştu ve bütün katmanlar onu miras alıyordu, yani RTX 3060'ta oyun
    telefon bütçesiyle çiziliyordu
  (renderer.info.render.calls ile ölç); tekstür 2K masaüstü / 1K mobil.
- Cihaz katmanı algılama → mobilde seyirci yoğunluğu, cloth
  iterasyonu, partikül, post-processing otomatik düşer.

## Seyirci (1.6)
- InstancedMesh + Vertex Animation Texture (VAT): animasyon texture'a
  bake edilir, vertex shader'da okunur; CPU skinning YOK.
- RGBA(32bit) texture tercih (half-float okuma yavaş; bazı cihazlar
  float texture desteklemez → encode).
- Yakın tribün instanced model, uzak tribün billboard sprite.
- Idle loop + event tetikli alkış/dalga; instance başına faz offset.

## Kale ağı / bayrak (Verlet cloth)
- Particle grid (~10×8) + mesafe constraint'leri, 2-4 relaxation
  iterasyonu; üst kenar pinned.
- Top çarpması: collision + POST-INTEGRATION düzeltme (top ağdan
  geçmesin). Kozmetik olduğundan determinizm gerekmez.

## Oyuncular
- ~10 skinned mesh kabul edilebilir; bone 20-30 (mobil); GPU skinning;
  uzakta bone/klip LOD.

## Asset pipeline (kesin komutlar)
- npm i -g @gltf-transform/cli  (KTX2 için toktx PATH'te)
- Hızlı yol: gltf-transform optimize in.glb out.glb
    --compress draco --texture-compress ktx2
- Ayrık: dedup → prune → draco (--method edgebreaker) →
  resize 1024 → uastc (normal/orm slotları) → etc1s (albedo)
- Alternatif: gltfpack -i in.glb -o out.glb -cc -tc (meshopt+KTX2)
- CDN'de ikinci gzip/brotli katmanı.
