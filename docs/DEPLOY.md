# Goal Net — Yayına Alma Rehberi

Oyun tarayıcıda çalışan tek sayfalık statik bir Vite uygulaması. Sunucu
gerektiren tek parça, isteğe bağlı **açık oda listesi** kaydı. Çok oyunculu
bağlantının kendisi PeerJS'in ücretsiz genel brokerı üzerinden kuruluyor, yani
ana dağıtım için hiçbir arka uç şart değil.

Üç ayrı şey var, karıştırmayın:

| Parça | Nerede çalışır | Zorunlu mu |
|---|---|---|
| Oyun (`dist/`) | Statik host: Netlify, GitHub Pages, herhangi bir CDN | Evet |
| PeerJS brokerı | PeerJS bulutu, bizden bağımsız | Evet, ama kurulum gerektirmez |
| Oda listesi (`server/room-list.mjs`) | Fly.io, Render veya kendi makineniz | Hayır, kod ile oda kurulabilir |

---

## 1. Oyunu statik host'a koymak

Önce üretim derlemesi:

```bash
npm ci
npm run build          # dist/ üretir
node deploy/check-dist.mjs   # dist gerçekten yayınlanabilir mi, tarayıcısız kontrol
```

`deploy/check-dist.mjs`, `dist/index.html`in var olduğunu, referans verdiği
bütün yerel varlıkların diske yazıldığını, hash'li paketin dolu olduğunu ve
derlemeye `/src/` yollarının sızmadığını doğrular. Yayınlamadan önce çalıştırın.

### 1a. Netlify, sürükle bırak

En hızlı yol, hesap açmak dışında hiçbir kurulum istemez.

1. `npm run build` çalıştırın.
2. https://app.netlify.com/drop adresini açın.
3. `dist/` klasörünü tarayıcı penceresine sürükleyin.
4. Netlify size `https://<rastgele-ad>.netlify.app` verir. Site ayarlarından
   adı değiştirebilir, kendi alan adınızı bağlayabilirsiniz.

Sürükle bırak her seferinde elle derleme ister. Kalıcı kurulum için 1b'ye
bakın.

### 1b. Netlify, Git deposundan otomatik

Depoyu GitHub'a itin, Netlify'da **Add new site → Import an existing project**
deyip depoyu seçin. Depodaki `netlify.toml` bütün ayarları taşıdığı için
arayüzde hiçbir şey doldurmanız gerekmez:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Dosya ayrıca Node 20'yi sabitler, tek sayfa geri dönüşünü (`/*` → `index.html`)
kurar ve hash'li paketlere bir yıllık `immutable` önbellek başlığı verirken
`index.html`i her zaman taze tutar. Bundan sonra `main` dalına her itiş yeni
sürümü yayınlar.

### 1c. GitHub Pages

Pages, siteyi `https://<kullanıcı>.github.io/<depo-adı>/` altında, yani alt
dizinde sunar. Vite'ın varsayılan `base` değeri `/` olduğu için derlemeye alt
dizini vermeniz gerekir:

```bash
npx vite build --base=/goal_net/     # <depo-adı> ile değiştirin
```

Sonrasında iki seçenek var.

**Elle, `gh-pages` dalı:**

```bash
npx vite build --base=/goal_net/
cd dist
git init -b gh-pages
git add -A
git commit -m "deploy"
git push -f git@github.com:<kullanıcı>/<depo>.git gh-pages
```

Depo ayarlarında **Settings → Pages → Source: Deploy from a branch →
gh-pages / (root)** seçin.

**GitHub Actions ile otomatik:** depoya `.github/workflows/pages.yml` ekleyin.

```yaml
name: pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx vite build --base=/${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Pages kaynağını **GitHub Actions** olarak ayarlamayı unutmayın. Kendi alan
adınızı bağlarsanız site kökten sunulur, o zaman `--base` bayrağına gerek
kalmaz.

> Not: Pages ve Netlify HTTPS sunar. Oyun `location.protocol` üzerinden oda
> sunucusuna gittiği için, HTTPS bir sayfadan HTTP bir oda sunucusuna istek
> atılamaz. Oda listesi kullanacaksanız onu da TLS ile yayınlayın; aşağıdaki
> Fly.io ve Render adımlarının ikisi de sertifikayı kendiliğinden verir.

---

## 2. Oda listesi sunucusu (`server/room-list.mjs`)

Bu 70 satırlık kayıt defteri, açık odaları listelemeye yarar. Ev sahipleri
10 saniyede bir `POST /announce` yapar, oyuncular `GET /rooms` ile listeyi
çeker, 25 saniye ses çıkarmayan oda listeden düşer. Bağımlılığı yok, veriyi
bellekte tutar, bu yüzden **tek bir instance** çalıştırın: iki makineye
dağıtılırsa ev sahibi birine duyurur, oyuncu ötekine sorar ve liste boş görünür.

### 2a. Fly.io (ücretsiz kotayla)

Depoda hazır iki dosya var: `deploy/fly.toml` ve `deploy/Dockerfile.rooms`
(node:20-alpine, tek dosya kopyalar, 5200 portunu açar).

```bash
# tek seferlik
curl -L https://fly.io/install.sh | sh
fly auth signup            # veya: fly auth login

# depo kökünden
fly launch --no-deploy --copy-config \
  --config deploy/fly.toml --dockerfile deploy/Dockerfile.rooms
# fly.toml içindeki app adı benzersiz olmalı, ör. goalnet-rooms-ege

fly deploy --config deploy/fly.toml --dockerfile deploy/Dockerfile.rooms
fly scale count 1          # tek makine, bellek içi liste bölünmesin
```

Sonuç: `https://<app-adı>.fly.dev`. Yapılandırma `auto_stop_machines` ile
makineyi boşta uyutur, ilk istekte uyanır. Uyanma gecikmesi listeye en fazla
bir anket turu kaybettirir.

Doğrulama:

```bash
curl https://<app-adı>.fly.dev/rooms      # [] dönmeli
```

### 2b. Render (ücretsiz plan)

Depoda `deploy/render.yaml` blueprint'i hazır. Render panelinde **New →
Blueprint** deyip depoyu seçmeniz yeterli. Elle kurmak isterseniz **New → Web
Service** ve şu alanlar:

| Alan | Değer |
|---|---|
| Runtime | Node |
| Build Command | `echo no build step` |
| Start Command | `node server/room-list.mjs` |
| Health Check Path | `/rooms` |
| Instance Type | Free |

`room-list.mjs` portu `process.env.PORT` üzerinden okuduğu için Render'ın
atadığı portu kendiliğinden kullanır. Ücretsiz plan boşta uykuya geçer, ilk
istek birkaç saniye bekletebilir; oda listesi için sorun değil.

### 2c. Oyunun bu sunucuya işaret etmesi

Oyun, oda sunucusunun adresini **`goalnet-rooms-url` localStorage anahtarından**
okur. Yayınlanmış sayfada tarayıcı konsolunu açıp bir kez yazmanız yeter:

```js
localStorage.setItem('goalnet-rooms-url', 'https://goalnet-rooms.fly.dev');
location.reload();
```

Geri almak için:

```js
localStorage.removeItem('goalnet-rooms-url');
```

Anahtar boşsa oyun varsayılana düşer: sayfanın kendi protokolü ve host adı
üzerinden `:5200`, yani `npm run rooms` ile aynı makinede çalışan yerel kayıt
defteri. Yerel geliştirmede hiçbir şey ayarlamanız gerekmez.

> **Koordinatör notu.** Bu okuma `src/mp/session.js` içinde tek satır ister ve
> o dosya mp-social ajanının sahipliğinde. Sabit `ROOMS_URL` şu anda yalnızca
> varsayılanı içeriyor; override için gereken hali raporda verildi. Satır
> girene kadar yayınlanmış oyun uzak oda sunucusunu değil, ziyaretçinin kendi
> makinesindeki 5200 portunu dener.

---

## 3. PeerJS brokerı ücretsizdir

Çok oyunculu bağlantı `peerjs` istemcisiyle kuruluyor ve kod hiçbir broker
adresi vermiyor, yani PeerJS'in genel bulut sunucusu kullanılıyor. Bu sunucu
ücretsiz, kayıt istemez, kota beyan etmez ve yalnızca **tanışma** aşamasında
devrededir: oyuncular birbirini bulduktan sonra oyun verisi doğrudan WebRTC
üzerinden, uçtan uca akar. Sizin ödeyeceğiniz bant genişliği yoktur.

Bilinmesi gerekenler:

- Broker açık kaynak bir servistir, hizmet güvencesi vermez. Nadiren bakıma
  girer; o sırada oda kurulamaz, kurulmuş maçlar etkilenmez.
- Simetrik NAT arkasındaki iki oyuncu doğrudan bağlanamaz. Bu durumda TURN
  sunucusu gerekir ve PeerJS bulutunun ücretsiz TURN'ü sınırlıdır. Ev
  bağlantılarının büyük çoğunluğunda sorun çıkmaz.
- Kendi brokerınızı çalıştırmak isterseniz `peerjs-server` paketi aynı
  Fly.io/Render adımlarıyla yayınlanır ve `new Peer()` çağrılarına `host`,
  `port`, `path` verilir. Ücretsiz kurulum için gerekli değildir.

---

## 4. LAN'da oynamak

Aynı ağdaki makinelerde hiçbir şey yayınlamadan oynayabilirsiniz.

```bash
npm install
npx vite --host            # veya: npm run dev -- --host
```

Vite iki adres basar. `Network:` satırındaki `http://192.168.x.x:5173`
adresini aynı Wi-Fi'daki diğer cihazlara verin.

Oda listesini de yerelde istiyorsanız ikinci bir terminalde:

```bash
npm run rooms              # :5200
```

Oyun varsayılan olarak sayfanın host adı üzerinden `:5200` denediği için, siz
`192.168.x.x:5173` adresinden girdiğinizde oda listesi kendiliğinden
`192.168.x.x:5200`e gider. Ek ayar gerekmez.

Notlar:

- Güvenlik duvarı 5173 ve 5200 portlarına izin vermeli.
  Ubuntu'da: `sudo ufw allow 5173/tcp && sudo ufw allow 5200/tcp`.
- WebRTC aynı LAN içinde de PeerJS brokerıyla tanışır, yani LAN oyunu için
  internet bağlantısı gerekir. Tamamen çevrimdışı bir LAN'da kendi
  `peerjs-server` örneğinizi çalıştırmanız gerekir.
- Telefondan denerken tarayıcıyı tam ekran yapın; oyun `touch-action: none`
  ile kaydırmayı zaten kapatıyor.

---

## 5. Yayın öncesi kontrol listesi

```bash
npm ci
node scripts/sim-test.mjs        # fizik regresyonu
node scripts/replay-test.mjs     # gol tekrarı
npm run build
node deploy/check-dist.mjs       # dist gerçekten yayınlanabilir
```

Hepsi `ALL PASS` veriyorsa `dist/` klasörü yayına hazırdır.

## 6. Sık karşılaşılan sorunlar

| Belirti | Sebep | Çözüm |
|---|---|---|
| Sayfa beyaz, konsolda 404 `/assets/...` | GitHub Pages alt dizininde `base` verilmedi | `npx vite build --base=/<depo>/` |
| Oda listesi hep boş | Oyun `goalnet-rooms-url` bilmiyor veya sunucu uyuyor | Anahtarı ayarlayın, `curl .../rooms` ile sunucuyu uyandırın |
| Konsolda `Mixed Content` hatası | HTTPS sayfadan HTTP oda sunucusuna istek | Oda sunucusunu TLS ile yayınlayın |
| Oda kuruluyor ama kimse bağlanamıyor | Simetrik NAT, TURN yok | Aynı ağdan deneyin veya kendi TURN/broker'ınızı kurun |
| Fly'da liste bir dolup bir boşalıyor | Birden fazla makine var | `fly scale count 1` |

---

## 7. Kendi sunucun: web + TURN (üretim)

PeerJS'in genel brokerı bağlantıyı kurar ama simetrik NAT arkasındaki iki
oyuncuyu birbirine bağlayamaz. Röle şart, ve röle ücretsiz genel bir
hizmetten alınamaz: kendi coturn'ünüzü çalıştırırsınız. Depodaki
`docker-compose.yml` iki servisi birlikte ayağa kaldırır.

Yerel geliştirme kurulumu `SETUP.md` içinde. Burası internete açık kurulum.

### 7.1 Ne gerekiyor

| Gereksinim | Neden |
|---|---|
| Genel IPv4 adresi | Röle adresi adaylara konur, NAT arkasından duyurulamaz |
| Bir alan adı (`turn.oyunalanin.com`) | `turns:` URI'si sertifikadaki adla eşleşmeli |
| 3478 tcp+udp, 5349 tcp+udp, 49152-65535 udp açık | STUN, TLS ve röle trafiği |
| Gerçek sertifika | Kendinden imzalı olan tarayıcıda `turns:` adayını düşürür |

Bulut sağlayıcılarının çoğunda makine NAT arkasındadır (elastic IP, floating
IP). O durumda `TURN_LISTENING_IP=0.0.0.0` ve `TURN_EXTERNAL_IP=<genel IP>`
birlikte verilir; ikincisi olmadan coturn kendi özel adresini duyurur ve
röle sessizce çalışmaz.

### 7.2 Sertifika

Let's Encrypt, HTTP-01 doğrulamasıyla:

```bash
sudo certbot certonly --standalone -d turn.oyunalanin.com
```

Sertifikayı coturn'ün okuyabileceği yere kopyalayın. Konteyner `nobody`
(uid 65534) olarak koşar, `/etc/letsencrypt/live/...` altındaki 0600 anahtarı
okuyamaz:

```bash
sudo install -d -m 755 /srv/goalnet/certs
sudo install -m 644 /etc/letsencrypt/live/turn.oyunalanin.com/fullchain.pem \
  /srv/goalnet/certs/turn_server_cert.pem
sudo install -m 640 -g 65534 /etc/letsencrypt/live/turn.oyunalanin.com/privkey.pem \
  /srv/goalnet/certs/turn_server_pkey.pem
```

`docker-compose.yml` içindeki coturn volume'una bu dizini bağlayın:

```yaml
    volumes:
      - ./docker/coturn:/etc/coturn:ro
      - /srv/goalnet/certs:/etc/coturn/certs:ro
```

Certbot yenilemesi dosyayı değiştirdiğinde konteyner yeniden başlatılmalı;
`--deploy-hook "docker compose -f /srv/goalnet/docker-compose.yml restart coturn"`
işi görür.

### 7.3 `.env`

```ini
TURN_SECRET=<openssl rand -hex 32 çıktısı, ortama özel>
TURN_REALM=turn.oyunalanin.com
TURN_HOST=turn.oyunalanin.com
TURN_LISTENING_IP=0.0.0.0
TURN_EXTERNAL_IP=203.0.113.10
TURN_MIN_PORT=49152
TURN_MAX_PORT=65535
TURN_TOTAL_QUOTA=100
WEB_PORT=5210
```

`TURN_SECRET` yalnızca sunucuda kalır. `web` servisi onunla
`username=(unix_ts+300):userId`, `credential=base64(HMAC-SHA1(secret, username))`
üretir; tarayıcı sırrı hiç görmez ve eline geçen kimlik bilgisi beş dakikada
kendiliğinden ölür. Sırrı ortamlar arasında paylaşmayın; sızarsa `.env`
içinde değiştirip iki servisi de yeniden başlatmak yeterlidir.

### 7.4 Güvenlik duvarı

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

Bulut sağlayıcısının kendi security group'unda da aynı beş kural açılmalı.
UDP aralığını daraltmak isterseniz `TURN_MIN_PORT`/`TURN_MAX_PORT` ile hem
coturn'ü hem duvarı birlikte kısın; eşzamanlı tahsis başına bir port düşer.

`web` servisi varsayılan olarak `127.0.0.1:5210`'a bağlanır. Önüne TLS
sonlandıran bir ters vekil koyun (nginx, Caddy). `docker-compose.yml`
içindeki port satırından `127.0.0.1:` önekini kaldırıp doğrudan açmayın:
COOP/COEP başlıkları ancak HTTPS altında çapraz köken izolasyonu sağlar.

### 7.5 Doğrulama

```bash
docker compose up -d
curl -s https://oyunalanin.com/healthz
node packages/server/test/relay.mjs --from https://oyunalanin.com \
  --host turn.oyunalanin.com --port 3478
```

Son komut gerçek bir TURN Allocate el sıkışması yapar ve röle adresini
yazdırır. Başarısızsa sırayla bakın: 3478/udp duvarda açık mı, `TURN_SECRET`
iki serviste aynı mı, `TURN_REALM` her iki tarafta aynı mı, `TURN_EXTERNAL_IP`
gerçekten genel adres mi.

Tarayıcı tarafını da doğrulamak için Trickle ICE sayfasına
`/turn-credentials` çıktısındaki `iceServers` girin; `relay` tipinde aday
görmelisiniz.

### 7.6 Neden bu ayarlar

| Ayar | Sebep |
|---|---|
| `use-auth-secret` | Kullanıcı veritabanı olmadan süreli kimlik bilgisi, sabit parola yok |
| `no-auth` ASLA | Açık röle saatler içinde spam ve tünel trafiğiyle sömürülür |
| `total-quota` / `user-quota` | Tek bir istemcinin bant genişliğini tüketmesini engeller |
| loopback/multicast peer reddi | Rölenin sunucunun kendi iç servislerine yönlendirilmesini engeller |
| `network_mode: host` | Docker NAT'i röle port aralığını güvenilir taşımıyor |
| `no-tlsv1`, `no-tlsv1_1` | Eski TLS sürümleri kapalı |
