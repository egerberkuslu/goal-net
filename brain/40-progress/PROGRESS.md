# PROGRESS — Canlı Durum (koordinatör her hedefte günceller)

Son güncelleme: 2026-08-08
Aktif faz: 1.2 (oynanış seti + kaleci + modlar + lobi)
Sıradaki hedef: Matris #7-#11 (saf fizik dribbling, şarj, falso, tackle, kaleci)

| Faz | Durum | Tag | Not |
|---|---|---|---|
| K | ☑ | — | SETUP.md yazıldı; Blender HUMAN-QUEUE'da, iş durdurmuyor |
| 0 | ☑ | faz0-stable | INVENTORY.md; testler kırılganlıktan arındırıldı (21/21) |
| 1.1 | ☑ | faz1.1-netcode | #3 monorepo, #4 determinizm (Node+Chromium bit-özdeş), #5 netcode paketi, #6 docker/coturn |
| 1.2 | ☐ | — | |
| 1.3 | ☐ | — | |
| 1.4 | ☐ | — | |
| 1.5 | ☑ | faz1.5-bots | #20 observe→action; scripted 3 kademe + ONNX aynı arayüz (enjekte runtime) |
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
- 2026-08-08 (4): Faz 1.5 (#20) KAPANDI — `packages/bots`: 100 özellikli
  egosentrik observation (takım 1 için 180° döndürme, mirror değil), 18
  ayrık / 7 sürekli aksiyon, scripted politika 3 kademe (ölçülen: tepki
  24/8/4 tick, nişan sapması 0.023/0.012/0.004, zor kolayı 10-0 yendi),
  ONNX politikası enjekte edilen runtime ile aynı arayüzde. Ajan gerçek bir
  hata yakaladı: core vuruşu yalnız yükselen kenarda tetikliyor, bot tuşu
  basılı tutunca tek vuruş oluyordu (4 tick bas / 8 tick bırak ile düzeldi).
  Faz 1.2 oynanış ajanı hâlâ çalışıyor.
- 2026-08-08 (3): Faz 1.1 KAPANDI. `packages/net`: host-otorite oturum
  (60 Hz sim, peer-başı delta baseline'ı, input limitleri, bot hook'u),
  istemci oturumu (100 ms interpolasyon, tahmin + uzlaştırma) ve ikili wire
  protokolü. Gate: %12 kayıp + %8 sırasızlık + jitter altında 173/173 snapshot
  host checksum'u ile eşleşti, kararlı halde desync 0, geri sıçrama yok.
  Bant genişliği 4 oyuncu için ~4.1 KB/s/peer (16 KB tavanının çok altında).
  2-sekme canlı entegrasyonu Faz 1.2'de istemciye bağlanacak.
- 2026-08-08 (2): Faz 1.1'in üç satırı kapandı. Monorepo: istemci
  `packages/client`'a taşındı (vite workspace config, testler+tarayıcı yeşil).
  Deterministik çekirdek `packages/core` (Q16.16, 58 kontrol); ikinci motor
  doğrulaması koordinatörce yapıldı → Node ve Chromium bit-özdeş
  (`fd1b55e2` / digest `2132210153`), ADR-0003 accepted. Docker: web+coturn
  ayağa kalkıyor, gerçek RFC 5766 Allocate testi geçiyor (53+6 kontrol).
  Sırada #5 netcode.
- 2026-08-08: Otonom döngü başladı. Faz K bitti (SETUP.md). Faz 0 koordinatör
  tarafından yürütüldü (delege edilen ajan kullanıcı tarafından durduruldu):
  INVENTORY.md yazıldı, iki kırılgan test iddiası ölçüme dayalı biçimde
  sağlamlaştırıldı, 7 paket × 3 koşu yeşil, build+dist temiz, tag faz0-stable.
  Önemli bulgu: perf "regresyonu" gerçek değildi — eski commit aynı yük altında
  aynı süreyi ölçtü; makine ollama/java yüzünden ~1.7× yavaşlamıştı.
