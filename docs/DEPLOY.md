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
