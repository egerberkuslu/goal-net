---
title: "Netcode — Host-Authoritative P2P"
type: tech-spec
status: active
related: ["[[physics-constants]]", "[[replay-format]]"]
---

# Netcode

## Mimari
- Host oyunculardan biri; core simülasyonunu yalnız o koşturur.
- Peer'lar input gönderir; host 20-30Hz delta snapshot yayınlar
  (join'de full). Client: ~100ms interpolasyon buffer'ı; kendi
  oyuncusu için client-side prediction + host reconciliation.
- Host seçimi deterministik: en düşük playerId. Host migration v2.
- Botlar SADECE host'ta koşar.

## DataChannel ayarları
- game kanalı: { ordered: false, maxRetransmits: 0 } (UDP semantiği;
  maxRetransmits ve maxPacketLifeTime AYNI ANDA verilemez).
- lobby/kontrol kanalı: ordered reliable.
- Uygulama katmanında sıra numarası → stale snapshot at.
- Mesaj ~16KB altı; büyük state delta'lanır.

## TURN (ZORUNLU altyapı)
- coturn, TURN REST API (ephemeral credential):
  use-auth-secret + static-auth-secret=<hex>; realm; TLS 5349
  (letsencrypt cert); external-ip; total-quota; no-loopback-peers.
  ASLA: no-auth. Portlar: 3478, 5349, UDP 49152-65535.
- Node tarafı: username = (unix_ts+300)+":"+userId,
  credential = HMAC-SHA1(secret, username) base64.
- Docker'da coturn: network_mode: host (relay port aralığı NAT'te sorunlu).

## Sunucu header'ları
- Statik servis COOP/COEP göndermeli (ONNX WASM threads için):
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

## Anti-cheat (gerçekçi kapsam)
- Host input doğrulaması: hız/ivme sınırı (accel>0.1 reddet),
  kick menzili <25, kick rate cap, pozisyon sıçraması reddi.
- Grief kilitleri: goalkeeper.md + core-invariants.
- Bilinen sınır: host'un kendisi hile yapabilir → rating için
  adanmış/tarafsız host v2 notu.
