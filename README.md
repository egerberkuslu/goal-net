# Goal Net

Web tabanlı 3D futbol oyunu. **İki oyun aynı repoda** — biri yayında oynadığın
sürüm, diğeri onun deterministik/çok oyunculu halefi.

| Nerede | Ne |
|---|---|
| `/` | **Yayındaki oyun.** Bugüne kadar oynadığın sürüm. Float fizik, XPBD file, ragdoll, kendi ağ protokolü. Canlı: https://egerberkuslu.github.io/goal-net/ |
| `/arena.html` | **Arena (yeni).** Deterministik tamsayı çekirdek + host-otorite netcode + bot arayüzü üstüne kurulu; modlar, lobi, kaleci rolü, atmosfer, anlatım. Henüz yayında değil. |

İkisi görüntü katmanını ve PeerJS taşımasını paylaşır; başka hiçbir şeyi
paylaşmaz. Arena olgunlaşınca `/` onunla değiştirilecek (o güne kadar
yayındaki oyuna dokunulmuyor).

## Hızlı başlangıç

```bash
npm install
npx vite --port 5199 --host      # her iki oyun da bu sunucuda
npm run rooms                    # (isteğe bağlı) açık oda listesi, :5200
```

Tarayıcı: `http://localhost:5199/` (oyun) · `http://localhost:5199/arena.html` (arena)

## Dizin haritası

```
packages/
  client/    Three.js istemci — src/{core,game,view,mp} yayındaki oyun,
             src/arena/ yeni arena (atmos/, present/, anim/, social/)
  core/      Deterministik simülasyon (Q16.16 tamsayı, DOM'suz, 60 Hz)
  net/       Host-otorite netcode: snapshot/delta, tahmin, uzlaştırma
  bots/      observe→action bot arayüzü; scripted + ONNX politikaları
  replay/    Input-kayıtlı maç tekrarı, paylaşım, "en iyi anlar"
  social/    Rating (OpenSkill), sezon, izleyici, isim filtresi, quick chat
  server/    Node servisi: statik + COOP/COEP, oda kaydı, TURN kimlik bilgisi
python/      Çekirdeğin NumPy portu (bit-özdeş) + MARL eğitim ortamı
brain/       Bilgi kasası: tasarım, teknik spec, ADR'ler, ilerleme
docker/      coturn (TURN) yapılandırması · docker-compose.yml kökte
deploy/      GitHub Pages / Netlify / Fly.io dosyaları
scripts/     Headless test paketleri (node ile koşar, ağ gerektirmez)
```

## Testler

```bash
npm run test:sim      # yayındaki oyunun fiziği        npm run test:core    # deterministik çekirdek
npm run test:rules    # faul/devre/altın gol           npm run test:net     # netcode
npm run test:mp       # eski ağ protokolü              npm run test:bots    # bot arayüzü
npm run test:fx       # konfeti/yağmur/sarsıntı        npm run test:social  # rating/sosyal
npm run test:replay   # eski replay                    npm run test:replaypkg
npm run test:input    # gamepad/dokunmatik             npm run test:arena   # arena mantığı
npm run test:crowd    # seyirci                        npm run test:atmos   # atmosfer katmanı
npm run test:present  # anlatım/tansiyon/xG            npm run test:server  # sunucu + TURN
npm run test:parity   # JS ↔ Python bit-özdeşlik
```

## Yayınlama

```bash
bash deploy/pages.sh        # GitHub Pages'e (oyun + arena birlikte)
docker compose up --build   # web + coturn (TURN) yığını, ayrıntı: docs/DEPLOY.md
```

## Otonom geliştirme

Bu repo `MISSION.md` + `brain/` bilgi kasasıyla ajan-güdümlü geliştiriliyor.
Durum ve kalan işler: `brain/00-index.md` (özellik matrisi) ve
`brain/40-progress/PROGRESS.md`. Senden istenenler:
`brain/40-progress/HUMAN-QUEUE.md` ve `MANUAL-TESTS.md`.
