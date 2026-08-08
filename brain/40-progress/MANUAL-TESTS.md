# MANUAL-TESTS — Kullanıcının elle koşacağı birikimli liste
(tester otomatik test edemediklerini buraya ekler; kullanıcı en
sonda toplu koşar)

## P2P gerçek ağ
- [ ] Farklı ağlardaki 2 cihazla oda kur/katıl (TURN zorlaması dahil)

## Arena (deterministik istemci, `/arena.html`)

Otomatik koşan kısım: `npm run test:arena` (125 kontrol, DOM'suz) ve
`npm run test:arena2tab` (in-process + gerçek Chromium iki sekme, 30 kontrol).
Aşağıdakiler gerçek ağ, gerçek GPU ya da gerçek el istediği için elde kaldı.

- [ ] **PeerJS ile iki gerçek cihaz.** İki sekme kanıtı `?net=local`
      (BroadcastChannel) üzerinden koşuyor; yayın yolu olan PeerJS brokerı
      hiç zorlanmadı.
  ```
  Cihaz A: http://<host>:5301/arena.html  → "Oda Kur" (bağlantı: PeerJS)
  Cihaz B: aynı adres → kodu gir → "Katıl" → "Hazırım"
  Cihaz A: mod seç (4v4) → "Başlat"
  Beklenen: iki ekranda aynı skor; HUD'daki `tick` farkı ~6 tick'i geçmiyor;
  misafirin HUD'unda `bot 0`, host'unkinde `bot` sayacı artıyor.
  ```

- [ ] **Kaleci elle oynanır mı.** 4v4'te lobide "Kaleci Ol" seç, maça gir.
      Kendi ceza sahanda: `G` topu tutar (sayaç 3.5 sn), `H` el atışı yapar,
      `J` basılı tutup bırakmak degaj eder, `R` + yön dalış yapar. Ceza sahası
      DIŞINDA dördü de çalışmamalı (çekirdek yetkiyi orada kapatıyor).

- [ ] **Modların hissi.** 1v1 / 2v2 / 3v3 (kalecisiz) ve 4v4 (kalecili) tek tek
      açılıp baştan sona oynanır: başlama vuruşu → oyun → gol → skor → maç sonu
      ekranı. Bot zorluğu kolay/orta/zor arasında hissedilir fark yaratmalı.

- [ ] **Gerçek GPU'da kare hızı.** İki sekme testi yazılım rasterleştirmeyle
      koştuğu için misafir sekmesi ~13 FPS çizdi (simülasyon ve ağ etkilenmedi;
      pump rAF'tan ayrı çalışıyor). Gerçek GPU'da 60 FPS bekleniyor —
      `/arena.html` açıp HUD'daki tick akışına ve gözle akıcılığa bakılır.

- [ ] **Arka plandaki host.** Host sekmesini arkaya al, 30 sn bekle, öne getir.
      Beklenen: maç durmamış, misafirin skoru host'la aynı (pump worker
      zamanlayıcısından koşuyor, rAF'tan değil).

## Determinizm — üçüncü motor ailesi
- [ ] `npx vite --port 5199` çalışırken Firefox (SpiderMonkey) ve varsa Safari
      (JavaScriptCore) ile `http://localhost:5199/enginecheck.html` aç,
      konsolda `window.__parity` yaz. Beklenen: `constantsHash "fd1b55e2"`,
      `digest 2132210153` (Node ve Chromium ile birebir aynı).

## Oynanış hissi
- [ ] Dribbling 10m = 5-8 dokunuş hissi
- [ ] Tackle risk/ödül dengesi

## Mobil
- [ ] Orta seviye telefonda 60 FPS, dokunmatik kontroller

## TURN / altyapı (Faz 1.1 · devops)

Otomatik koşan kısım burada değil. `docker compose up -d` sonrası şunlar
makinede headless geçiyor ve CI'ya konabilir:

```bash
node packages/server/test/run.mjs                            # 53 kontrol, ağsız
TURN_SECRET=<.env> node packages/server/test/relay.mjs       # canlı Allocate
```

Aşağıdakiler genel IP, gerçek sertifika veya ikinci bir ağ istediği için
otomatikleştirilemedi. Sunucu kurulduktan sonra elle koşulacak.

- [ ] **Genel IP üzerinden röle tahsisi.** Yerel doğrulama loopback'e bağlı
  coturn ile yapıldı; `external-ip` yolu (NAT arkasındaki bulut makinesi)
  hiç çalıştırılmadı.
  ```bash
  # TURN sunucusunun kendisinde:
  docker compose up -d
  # Başka bir makineden:
  node packages/server/test/relay.mjs --from https://oyunalanin.com \
    --host turn.oyunalanin.com --port 3478
  # Beklenen: "valid REST credential gets a relay allocation" PASS ve
  # yazdırılan röle adresi sunucunun GENEL IP'si olmalı, özel adres değil.
  ```

- [ ] **Gerçek sertifikayla TLS röle (5349).** Yerelde kendinden imzalı
  sertifikayla TLS 1.3 el sıkışması doğrulandı, Let's Encrypt zinciri
  doğrulanmadı.
  ```bash
  openssl s_client -connect turn.oyunalanin.com:5349 -servername turn.oyunalanin.com </dev/null \
    | grep -E 'Verify return code|subject='
  # Beklenen: "Verify return code: 0 (ok)" ve CN/SAN = turn.oyunalanin.com
  ```

- [ ] **Tarayıcıda relay adayı.** Trickle ICE sayfasına
  `curl -s https://oyunalanin.com/turn-credentials?userId=test` çıktısındaki
  `iceServers` girilir; `typ relay` satırı görünmeli. Yalnızca `host` ve
  `srflx` çıkıyorsa 3478/udp duvarda kapalı ya da kimlik bilgisi reddediliyor.

- [ ] **İki gerçek ağ arasında TURN zorlamalı maç.** İki cihazda da
  `iceTransportPolicy: 'relay'` ile oda kurulup oynanır; tüm trafik röleden
  geçtiğinde oynanış kabul edilebilir mi (gecikme, kopma) ölçülür. Yukarıdaki
  "P2P gerçek ağ" maddesiyle birlikte koşulabilir.

- [ ] **Röle port aralığı doğrulaması.** Eşzamanlı 3-4 tahsis açıkken
  `ss -unlp | grep turnserver` çıktısındaki portlar 49152-65535 içinde
  kalmalı; dışına taşıyorsa `min-port`/`max-port` uygulanmamış demektir.
