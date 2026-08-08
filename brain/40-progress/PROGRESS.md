# PROGRESS — Canlı Durum (koordinatör her hedefte günceller)

Son güncelleme: 2026-08-08
Aktif faz: 1.1 (monorepo + determinizm + netcode)
Sıradaki hedef: Matris #3 (monorepo) ve #4 (determinizm/ADR-0003)

| Faz | Durum | Tag | Not |
|---|---|---|---|
| K | ☑ | — | SETUP.md yazıldı; Blender HUMAN-QUEUE'da, iş durdurmuyor |
| 0 | ☑ | faz0-stable | INVENTORY.md; testler kırılganlıktan arındırıldı (21/21) |
| 1.1 | ☐ | — | |
| 1.2 | ☐ | — | |
| 1.3 | ☐ | — | |
| 1.4 | ☐ | — | |
| 1.5 | ☐ | — | |
| 1.6 | ☐ | — | |
| 1.7a | ☐ | — | |
| 1.7b | ☐ | — | |
| 1.7c | ☐ | — | |
| 1.7d | ☐ | — | |
| 2 | ☐ | — | |

## Bloklar
(yok)

## Önemli tespitler (Faz 0 girdisi)
Mevcut oyun bugüne kadar tek pakette (monorepo değil) geliştirildi; 7 headless
test paketi var (sim/rules/mp/fx/replay/input/crowd, ~500 kontrol) ve canlıda
GitHub Pages'te yayınlı (https://egerberkuslu.github.io/goal-net/).
core-invariants ile bilinen çelişkiler (Faz 1.1/1.2'de ele alınacak, Faz 0'da
DOKUNULMAZ — sadece envantere yazılır):
- Dribbling'de yörünge-taşıma asisti var (invariant: saf fizik, magnet yasak)
- Ragdoll mevcut (v2 havuzunda "yapılmaz" listesinde)
- Kaleciler otomatik AI (invariant: maç başı seçim, ADR-0001)
- Kafa vuruşu mevcut (v2 havuzunda)
- Determinizm yok (float fizik, Math.random bot gürültüsü)

## Oturum notları
- 2026-08-08: Otonom döngü başladı. Faz K bitti (SETUP.md). Faz 0 koordinatör
  tarafından yürütüldü (delege edilen ajan kullanıcı tarafından durduruldu):
  INVENTORY.md yazıldı, iki kırılgan test iddiası ölçüme dayalı biçimde
  sağlamlaştırıldı, 7 paket × 3 koşu yeşil, build+dist temiz, tag faz0-stable.
  Önemli bulgu: perf "regresyonu" gerçek değildi — eski commit aynı yük altında
  aynı süreyi ölçtü; makine ollama/java yüzünden ~1.7× yavaşlamıştı.
