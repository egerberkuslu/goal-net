# Çok Oyunculu (P2P) Arayüz Sözleşmesi — v1

Koordinatör: ana oturum. Bu doküman paralel çalışan ajanların ortak sözleşmesidir.
Değiştirmeyin; boşluk bulursanız kendi tarafınızda en makul kararı verip README-notu bırakın.

## Mimari
- **P2P + host-otorite**: Oda kuran (host) simülasyonu çalıştırır. Misafirler input
  gönderir (`input`, ~30 Hz), host durum yayını yapar (`snap`, 20 Hz). Misafir,
  file (net) çözücüsünü SADECE görsel olarak lokal çalıştırır; top/oyuncu durumu
  host'tan gelir.
- **Sinyalleşme**: PeerJS bulut sunucusu (ücretsiz). Oda kodu = 6 harf/rakam;
  host'un peer id'si `goalnet-<KOD>`.
- Takımlar: 0 = Kırmızı, 1 = Mavi. Host da oynar.

## Mesaj protokolü (JSON, DataConnection üzerinden)
Tüm mesajlar `{ t: string, ...alanlar }`.

Misafir → Host:
- `{t:'hello', name}` — bağlanınca ilk mesaj.
- `{t:'team', team}` — takım değiştirme isteği (host onaylar, lobby yayını döner).
- `{t:'input', seq, x, z, kick}` — oyun sırasında yön (-1..1) ve şut tuşu durumu.

Host → Misafir(ler):
- `{t:'lobby', you, players:[{id, name, team, isHost}], settings}` — her lobi
  değişikliğinde tam durum. `you` = alıcının id'si.
- `{t:'start', settings}` — maç başlıyor; misafir dünyayı bu ayarlarla kurar.
- `{t:'snap', tick, state, timeLeft, score:[r,b],
     ball:{x,y,z,vx,vy,vz,wx,wy,wz},
     players:[{id, x, z, vx, vz, facing, down, charge, kickAnim, team, role}],
     events:[{type,...}]}` — 20 Hz durum yayını. `state`: 'kickoff'|'play'|'goal'|'end'.
- `{t:'kicked', reason:'kick'|'ban'}` — ardından bağlantı kapatılır.
- `{t:'end', score}` — maç bitti (snap.state de 'end' olur).

## settings nesnesi
```js
{
  matchTime: 60 | 180 | 300,      // saniye
  goalLimit: 3 | 5 | 10 | 0,      // 0 = sınırsız
  goalScale: 0.8 | 1 | 1.3,       // kale genişlik/yükseklik çarpanı
  keepers: true | false,          // AI kaleciler
}
```

## Modül sözleşmeleri

### A) `src/core/config.js` (core-config ajanı)
```js
export function makeConfig(overrides = {}) // -> config
// config: { goalW, goalH, matchTime, goalLimit, keepers, goalScale }
// goalW = 7.32*goalScale, goalH = 2.44*goalScale (direk yarıçapı sabit)
```
- `Net` yapıcısı `new Net(config, {goalZ, sign})` olur; `World` yapıcısı
  `new World(config)`; `world.config` erişilebilir.
- Maç süresi/gol limiti core'da DEĞİL game katmanında kullanılır; config sadece taşır.
- Saha ölçüleri (36×22) sabit kalır.
- `view/scene.js`: kale demiri + stançonlar `buildGoalFrames(scene, config)` adlı
  ayrı fonksiyona çıkar; `{group, dispose()}` döner (maç başında yeniden kurulabilir).
  `createScene` artık kale çizmez.
- Eski davranış (parametresiz) aynen çalışmalı: `makeConfig()` varsayılanları
  bugünkü sabitlerdir. `scripts/sim-test.mjs` yeşil kalmalı; goalScale 0.8 ile
  kaleye gol atılabildiğini gösteren 1 test ekleyin.

### B) `src/mp/peer.js` + `src/mp/protocol.js` (network ajanı)
```js
export class PeerNet {
  // callbacks: {onOpen(code), onPeerJoin(id), onPeerLeave(id),
  //             onMessage(id, msg), onError(err), onClosed(reason)}
  constructor(callbacks)
  host()                 // PeerJS id goalnet-<KOD>; onOpen(code) tetiklenir
  join(code, name)       // bağlanır, hello'yu KENDİSİ GÖNDERMEZ (üst katman gönderir)
  send(id, msg); broadcast(msg)
  kick(id); ban(id)      // ban: id kalıcı blokliste (bellek içi), tekrar bağlanamaz
  close()
}
```
- `peerjs` bağımlılığını package.json'a ekleyin (`^1.5.0`), import ES module.
- protocol.js: mesaj tip sabitleri + `validate(msg)` (bilinmeyen tip/alan → null) +
  snap encode/decode yardımcıları (v1 JSON; alan adları yukarıdaki sözleşme).
- Bağlantı kopma tespiti: PeerJS 'close'/'error' → onPeerLeave.
- Ağ erişimi olmadan test: DataConnection'ı mock'layıp protokol/validate birim
  testi `scripts/mp-test.mjs` (node ile koşar, network YOK).

### C) `src/mp/lobbyUI.js` + index.html ekleri (lobi-UI ajanı)
```js
export class LobbyUI {
  // callbacks: {onCreate(name), onJoin(code, name), onTeamSwitch(team),
  //             onSettingsChange(settings), onStart(), onKick(id), onBan(id),
  //             onLeave()}
  constructor(callbacks)
  showMenu()                    // ana menüye 'Çok Oyunculu' akışı
  showConnecting(msg)
  showLobby(state)              // state = lobby mesajının içeriği + isHost bilgisi
  showError(msg)                // kullanıcıya Türkçe hata
  hide()                        // maç başlarken overlay kapanır
}
```
- Mevcut `#menu` overlay'ine "Çok Oyunculu" butonu; yeni overlay'ler mevcut
  `.overlay` stiliyle uyumlu, Türkçe.
- Lobi ekranı: oda kodu (büyük, kopyala butonu), oyuncu listesi takım renkleriyle,
  takım değiştir (kendi satırında), host için: ayar seçicileri (süre, gol limiti,
  kale boyu, kaleci aç/kapa), oyuncu satırında At/Banla butonları, Başlat butonu.
- Misafirde ayarlar salt-okunur görünür.
- Mevcut yerel modlara dokunmayın (1 Oyuncu / 2 Oyuncu butonları kalır).
- Oyun entegrasyonu YOK — sadece UI + callback'ler; koordinatör bağlayacak.

## Genel kurallar
- Kod İngilizce, UI metinleri Türkçe.
- Vite dev sunucusu ANA ağaçta kullanıcı tarafından kullanılıyor; worktree'nizde
  `npm run dev` ÇALIŞTIRMAYIN. Test: `node scripts/sim-test.mjs` (+ kendi test dosyanız).
- Her ajan kendi worktree'sinde küçük anlamlı commit'ler yapar (lowercase, imperative).
