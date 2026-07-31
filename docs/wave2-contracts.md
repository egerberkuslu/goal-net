# Dalga 2 — Paralel Ajan Sözleşmeleri

5 ajan paralel çalışır. Koordinatör (ana oturum) entegrasyonu yapar.

## Ortak kurallar (HEPSİ İÇİN)
- Worktree'niz HOME reposunun checkout'u olabilir: önce `cp -r /home/ege/Desktop/goal_net <worktree>/goal_net`
  yapın, kopyada git ile çalışın, sonunda `git format-patch` ile commit'lerinizi
  `/tmp/claude-1000/-home-ege-Desktop-goal-net/57c38aef-f2ff-4cba-a502-51c2b05b6b99/scratchpad/<ajan-adi>-patches/`
  klasörüne verin. /home/ege/Desktop/goal_net'e DOKUNMAYIN, dev sunucu ÇALIŞTIRMAYIN.
- `index.html` ve `package.json` DÜZENLENMEZ (çakışma kaynağı). Yeni DOM'u JS ile yaratın
  (`document.createElement`, stiller JS'ten veya <style> node'u enjekte edin). İstediğiniz
  npm script satırlarını raporda bildirin, koordinatör ekler.
- `scripts/sim-test.mjs` DÜZENLENMEZ; kendi testinizi `scripts/<ajan-adi>-test.mjs` olarak yazın
  (aynı PASS/FAIL stili, node ile koşar, ağ erişimi yok). `node scripts/sim-test.mjs` yeşil kalmalı.
- Sadece kendi sahiplik listenizdeki dosyalara dokunun. Küçük anlamlı commit'ler (lowercase imperative).

## Dosya sahipliği
- **rules**: `src/core/world.js`, `src/core/constants.js` (yeni sabit ekleme), `src/game/game.js`,
  yeni `src/game/stats.js`, `scripts/rules-test.mjs`
- **mp-social**: `src/mp/*` (session, protocol, peer, lobbyUI), `scripts/mp-test.mjs`
- **atmosphere**: `src/view/sfx.js`, yeni `src/view/fx.js`, `src/view/cameraRig.js`,
  `src/view/crowdView.js`, `src/game/pauseMenu.js`, `scripts/fx-test.mjs`
- **input-identity**: `src/game/input.js`, `src/view/playerView.js`, `scripts/input-test.mjs`
- **replay-deploy**: yeni `src/game/replay.js`, `netlify.toml` / `deploy/` altı, `docs/DEPLOY.md`,
  `scripts/replay-test.mjs`

## Paylaşılan veri sözleşmeleri
1. **Roster girdisi** artık `{ id, team, role, name? }` — mp-social lobby'den isimleri koyar;
   Game/GuestMatch kurulumunda `player.mpName = entry.name` set edilir (koordinatör main.js'te bağlar;
   rules ajanı Game constructor'daki roster döngüsüne `p.mpName = entry.name ?? ''` satırını ekler).
   input-identity playerView isim etiketini `player.mpName`'den okur (boşsa etiket yok).
2. **Takım renkleri**: `config.teamColors = [0xRRGGBB, 0xRRGGBB]` (opsiyonel; yoksa mevcut kırmızı/mavi).
   mp-social lobby ayarlarına renk seçimini ekler ve `settings.teamColors` yayınlar; `makeConfig`'e
   dokunmaz — koordinatör settings→config aktarımını bağlar. input-identity playerView'u
   `world.config.teamColors ?? varsayılan` okuyacak şekilde günceller (charge ring + forma + aim rengi).
3. **Snap eventleri**: validator scalar ekstra alanları geçirir (≤8 anahtar). rules yeni event tipleri
   kullanabilir: `{type:'foul'}`, `{type:'penalty', team}`, `{type:'freekick', team}`, `{type:'half'}`,
   `{type:'golden'}`. mp-social GuestMatch mesaj eşlemesine bunları ekler
   (Faul! / Penaltı! / Serbest vuruş! / Devre Arası / Altın Gol!).
4. **Maç fazları protokolde YENİ STATE AÇMAZ**: rules, serbest vuruş/penaltı/devre arasını mevcut
   'kickoff' state'i + eventlerle temsil eder (host otorite zaten simüle ediyor; misafir sadece izler).
5. **Replay kancası hazır**: `world.puppet = true` iken step() top/oyuncu fiziğini atlar, sadece
   fileler simüle olur (top scripted). replay-deploy bunu kullanır; world.js'i DÜZENLEMEZ.
6. **İstatistik sözleşmesi**: rules `game.stats` nesnesi tutar
   `{shots:[r,b], onTarget:[r,b], saves:[r,b], possession:[r,b] (saniye), fouls:[r,b]}`;
   maç sonu overlay'ini stats.js kendisi DOM ile çizer (`#end` overlay'ine append).
