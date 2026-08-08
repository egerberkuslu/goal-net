# SETUP — Ortam Durumu (Faz K, devops)

Son doğrulama: 2026-08-08 · Makine: RTX 3060 12GB, Linux 6.17

## Doğrulama komutları ve durum

| Araç | Komut | Durum |
|---|---|---|
| Node 20 | `node --version` | ✅ v20.19.5 |
| npm | `npm --version` | ✅ 11.11.0 |
| git | `git --version` | ✅ 2.43.0 |
| Docker | `docker --version && docker ps` | ✅ 28.5.1, daemon çalışıyor |
| Docker Compose | `docker compose version` | ✅ v2.40.1 |
| Python 3 | `python3 --version` | ✅ 3.12.4 (anaconda) |
| pip | `pip --version` | ✅ 26.0.1 |
| gltfpack | `npx gltfpack` | ✅ devDependency olarak kuruldu |
| gltf-transform | `npx gltf-transform --version` | ✅ devDependency (`@gltf-transform/cli`) |
| Blender + MCP | `blender --version` | ⛔ KURULU DEĞİL → HUMAN-QUEUE (sudo gerekir) |

## Notlar
- gltf araçları repo devDependency'si olarak kuruldu (global kurulum ve
  OS onayı gerekmedi). Asset boru hattı `npx` üzerinden çağırır.
- Blender kurulumu `sudo apt install blender` veya snap ister → OS onayı
  gerektiği için HUMAN-QUEUE'ya yazıldı. Blender'sız ilerlenebilir:
  asset işleri (Faz 1.4/1.6) placeholder/prosedürel geometriyle başlar.
- Mevcut test altyapısı: `npm run test:sim|rules|mp|fx|replay|input|crowd`
  (7 headless paket, node ile koşar; ağ gerekmez).
- Dev sunucu: `npx vite --port 5199 --host` · Oda listesi: `npm run rooms`.
