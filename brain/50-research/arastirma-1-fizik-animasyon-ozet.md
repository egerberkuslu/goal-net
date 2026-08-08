---
title: "Araştırma 1 Özeti — Fizik, Dribbling, Animasyon, Ragdoll"
type: research
status: active
---
# Araştırma 1 (Ağu 2026) — damıtılmış bulgular
Aksiyona dönüşen her şey 10-design ve 20-tech-spec notlarına işlendi.
- Dribbling: Haxball doğrulanmış sabitler + CMU RoboCup dash/kick
  deseni; yapışma yok. → physics-constants, gameplay-core
- Şut/pas: charge eğrisi, skaler curve + görsel Magnus ayrımı.
- Animasyon: 8 yön blend + prosedürel (aim/lean/IK/tap); motion
  matching web'de olgun değil; Cascadeur/Rokoko/FreeMoCap.
- Ragdoll: yalnız kozmetik olur; v2'ye ertelendi; canned reactions.
- WASM fizik motorları core'da yasak (float determinizm riski;
  Rocket League patch 2.53 dersi).
- Model doğrulaması: claude-opus-5 (24 Tem 2026) mevcut; koordinatör
  claude-opus-5 koordinatör dahil her rolde kullanılır (kullanıcı kararı).
Tam rapor kullanıcı arşivinde (konuşma artifact'ı).
