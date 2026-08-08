# packages/ — monorepo (Faz 1.1)

| Paket | Rol | Kural |
|---|---|---|
| `core` | Saf deterministik simülasyon (fixed-point, sabit 60 Hz) | DOM YOK, yan etki YOK, WASM fizik YASAK |
| `client` | Three.js + UI + ağ istemcisi | Core'u sadece okur; oyun döngüsü React dışında |
| `server` | Statik servis (COOP/COEP), oda kaydı, TURN kimlik bilgisi | — |

Geçiş notu: mevcut oyun `src/` altında çalışmaya devam ediyor ve Faz 1.1
boyunca dokunulmuyor. `packages/core` yeni deterministik çekirdek olarak
sıfırdan yazılıyor; oynanış Faz 1.2'de onun üstüne taşınacak (bkz.
brain/40-progress/INVENTORY.md "invariant çelişkileri").
