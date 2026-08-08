---
title: "ONNX Botlar ve MARL Deploy"
type: tech-spec
status: active
related: ["[[physics-constants]]", "[[replay-format]]"]
---

# Botlar (Faz 1.5 arayüz, Faz 2 MARL)

## Arayüz (1.5'te kilitle)
- interface Bot { observe(coreState) → action }
- Scripted bot ve ONNX bot AYNI interface; host'ta koşar.

## Faz 2 eğitim hattı
- Core'un NumPy portu (aynı sayı temsili — fixed-point ise aynı) →
  parity: JS replay kayıtları Python'da tick tick checksum ile özdeş.
- PettingZoo env → MAPPO self-play + checkpoint havuzu; müfredat
  1v1 → 2v2 → 3v3 → kalecili. Referans: GRF_MARL, epymarl.
- Ödül: gol (seyrek) + potential-based shaping (topa/kaleye yaklaşma,
  sahiplik) — optimal politikayı bozmaz, makalede belirtilir.
- Değerlendirme: scripted bota karşı kazanma oranı, Elo, 5 seed.

## Tarayıcı deploy
- INT8 quantize (WASM'de FP32'ye göre 2-3x hız) → onnxruntime-web.
- ort.env.wasm.simd=true; numThreads=hardwareConcurrency;
  executionProviders:["wasm"]; graphOptimizationLevel:"all".
- KRİTİK: COOP/COEP header'ları yoksa SharedArrayBuffer kapanır →
  sessizce tek-thread (3-4x yavaş). Sunucu header'ları: netcode-p2p.md.
- Inference Web Worker'da; yüklemede dummy warm-up.
- Karar frekansı ~10Hz (60Hz core'dan ayrık); aksiyonlar core'a
  normal input olarak girer.
- Zorluklar: easy/medium/hard = farklı checkpoint dosyaları
  (public/models/); easy'de +150-250ms gözlem gecikmesi.
