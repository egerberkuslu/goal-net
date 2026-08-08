---
title: "INVENTORY — Mevcut Oyunun Envanteri (Faz 0)"
type: progress
status: active
updated: 2026-08-08
---

# INVENTORY — Faz 0

Mevcut oyun tek pakette (monorepo DEĞİL), saf JS + three.js + vite. Fizik
el yazması; hazır fizik motoru kullanılmıyor. Canlı: GitHub Pages
(`https://egerberkuslu.github.io/goal-net/`), repo `egerberkuslu/goal-net`.

## Modül haritası

| Yol | İçerik |
|---|---|
| `src/core/` | Saf simülasyon: `world.js` (arena, çarpışmalar, restart kuralları), `net.js` (XPBD file), `ball.js` (aero+Magnus+sekme), `player.js` (hareket, ragdoll, planjon, zıplama, kayma), `ai.js` (bot + kaleci), `config.js` (`makeConfig`), `constants.js`, `world-entry.js` (node testleri için re-export) |
| `src/game/` | `game.js` (maç akışı, kurallar, set-piece), `input.js` (klavye+gamepad+dokunmatik, kamera-göreli), `stats.js`, `replay.js`, `pauseMenu.js` |
| `src/view/` | `scene.js`, `netView.js`, `ballView.js`, `playerView.js`, `crowdView.js`, `fx.js`, `cameraRig.js`, `aimView.js`, `sfx.js` |
| `src/mp/` | `peer.js` (PeerJS), `protocol.js` (doğrulama sınırı), `session.js` (host-otorite oturum), `lobbyUI.js`, `lobbyState.js`, `chatUI.js` |
| `server/` | `room-list.mjs` — açık oda kayıt defteri (bellek içi, TTL) |
| `scripts/` | 7 headless test paketi |
| `deploy/` | `pages.sh`, `check-dist.mjs`, `fly.toml`, `Dockerfile.rooms`, `render.yaml` |

## Test paketleri (hepsi `node`, ağsız)

| Paket | Kapsam |
|---|---|
| `sim` | Fizik: gol/tünelleme, file yutması, duvar-aut, taç/korner/kale vuruşu, restart sahipliği, dribbling, kayma, kaleci kurtarış/planjon/zıplama, kafa, perf bütçesi |
| `rules` | Faul→serbest vuruş/penaltı, devre değişimi, altın gol, istatistikler (66 kontrol) |
| `mp` | Protokol doğrulama + lobi reducer'ları (179 kontrol) |
| `fx` | Konfeti, yağmur, kamera sarsıntısı |
| `replay` | Ring buffer, kukla oynatma, tahsis sızıntısı |
| `input` | Kamera-göreli eşleme, deadzone, gamepad/klavye birleşimi, isim/renk (100 kontrol) |
| `crowd` | Instanced seyirci, gol tepkileri |

## Matris karşılaştırması (00-index)

**Bugün kısmen/büyük ölçüde karşılanan satırlar** (kabul kriteri henüz
resmî test edilmedi, Faz 1.x'te kriterle doğrulanacak):
- #7 dribbling (var ama asistli — invariant çelişkisi), #8 şut şarjı (0.6 s),
  #9 falso (vektörel omega, skaler değil), #10 slide tackle (aktif+recovery),
  #12 modlar (1P/2P/antrenman/çok oyunculu — 3v3/4v4 lobiden bot ile),
  #13 lobi+oda UI, #17 kamera sarsıntısı + gol replay, #21 seyirci (instanced),
  #23 kale ağı cloth (XPBD, top ağı dalgalandırıyor ve geçmiyor),
  #25 sesler (prosedürel), #26 golden goal, #29 oda ayarları senkronu,
  #30/#31/#32 replay (kayıt var; input-replay ve paylaşım YOK),
  #35 izleyici modu, #36/#37 quick chat (chat var, klan/filtre yok),
  #41 istatistik ekranı.

**Tamamen eksik olanlar:** #3 monorepo, #4 determinizm, #5 host-authoritative
netcode (mevcut P2P host-otorite ama snapshot/interp ve determinizm kriteri
karşılanmıyor), #6 docker+coturn, #11 kaleci maç-başı seçimi, #14/#15/#16
animasyon standardı (şu an prosedürel, Mixamo/blend-tree yok), #18/#19 asset
+ performans bütçeleri, #20 bot arayüzü soyutlama, #22 top toplayıcı,
#24 forma atlası, #27 mercy rule, #28 saha preset'leri, #33/#34 rating+sezon,
#38/#39/#40 anlatım/tansiyon/stadyum varyantları, #42-#45 MARL.

## Invariant çelişkileri (Faz 1.1/1.2'de ele alınacak — Faz 0'da DOKUNULMADI)

1. **Dribbling asistli**: `world.dribbleAssist()` topu oyuncunun çevresinde
   yörüngede taşıyor (yay + taşıma yarıçapı). Invariant "saf fizik, magnet
   yasak" diyor → Faz 1.2'de saf fiziğe dönülmeli (kabul: 10 m'de 5-8 dokunuş).
2. **Ragdoll var** (`player.knockDown`) — v2 havuzunda "yapılmaz" listesinde.
3. **Kafa vuruşu var** (`kickParams` header dalı) — v2 havuzunda.
4. **Kaleciler otomatik AI** — ADR-0001 maç başı seçim + sabit rol istiyor.
5. **Determinizm yok**: float aritmetik, `Math.random` (bot gürültüsü,
   ragdoll tumble), `performance.now()` tabanlı akış. ADR-0003 kararı ve
   fixed-point/checksum işi Faz 1.1'de.
6. **Falso skaler değil**: core'da `omega` 3B vektör; spec tek skaler istiyor.
7. **Hız eşitliği**: ✅ uyumlu — tüm oyuncular `PLAYER_SPEED` sabitini
   paylaşıyor, stat/sprint farkı yok. Sadece kaleci planjonu ve kayma anlık
   itki veriyor (yetenek değil, aksiyon maliyeti + cooldown ile dengeli).

## Faz 0'da yapılan stabilizasyon

- `sim-test`: tohumlu PRNG ile `Math.random` sabitlendi (bot gürültüsü ve
  ragdoll tumble artık tekrarlanabilir) — oyun davranışı değişmedi.
- `sim-test` perf iddiası: duvar-saati yerine **CPU zamanı** ve makine
  hızına göre normalize edilmiş **oran** ölçüyor. Gerekçe: yük altında eski
  commit (bcc0925) de 14.06 ms ölçtü, HEAD 14.68 ms → regresyon yok, makine
  ~1.7× yavaşlamıştı. Mutlak eşik yanlış alarm üretiyordu.
- `replay-test` heap-delta iddiası: GC testere dişi etkisi için üç pencerenin
  en küçüğü alınıyor.
- Sonuç: 7 paket × 3 koşu = 21/21 geçti; `npm run build` + `check:dist` temiz.
