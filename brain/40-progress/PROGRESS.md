# PROGRESS — Canlı Durum (koordinatör her hedefte günceller)

Son güncelleme: 2026-08-08
Aktif faz: 1.6 (atmosfer) + 2 (parity) ajanda; sonra 1.3/1.4/1.7d
Sıradaki hedef: kalan matris satırları #14-#19, #21-#25, #38-#41, #42-#45

| Faz | Durum | Tag | Not |
|---|---|---|---|
| K | ☑ | — | SETUP.md yazıldı; Blender HUMAN-QUEUE'da, iş durdurmuyor |
| 0 | ☑ | faz0-stable | INVENTORY.md; testler kırılganlıktan arındırıldı (21/21) |
| 1.1 | ☑ | faz1.1-netcode | #3 monorepo, #4 determinizm (Node+Chromium bit-özdeş), #5 netcode paketi, #6 docker/coturn |
| 1.2 | ☑ | faz1.2-arena | #7-#11 core; #12-#13 /arena.html (modlar, lobi, kaleci seçimi, iki-sekme kanıtı) |
| 1.3 | ☑ | faz1.3-anim | #14-#17 prosedürel; iskeletli animasyon Blender ile insanda |
| 1.4 | ☑ | faz1.4-assets | #18-#19; draw call 111→20, GLB Draco+KTX2 hattı gerçek |
| 1.5 | ☑ | faz1.5-bots | #20 observe→action; scripted 3 kademe + ONNX aynı arayüz (enjekte runtime) |
| 1.6 | ☑ | faz1.6-atmos | #21-#25; +5 draw call / +67k üçgen; draw call bütçesi #19a devredildi |
| 1.7a | ☑ | faz1.7a-rules | #26-#29; settingsHash ayrı (constantsHash "aynı build?", settingsHash "aynı oda?") |
| 1.7b | ☑ | faz1.7b-replay | #30-#32; input-kayıtlı konteyner, keyframe seek 0.97ms, kısa-ID paylaşımı |
| 1.7c | ☑ | faz1.7c-social | #33-#37; izleyici maliyeti sabit, isim filtresi homoglyph-dayanıklı |
| 1.7d | ☑ | faz1.7d-present | #38-#41; anlatım hattı sessiz kliplerle uçtan uca, 58 kayıt insanda |
| 2 | ⏳ | — | #42 parity ☑, #45 plan ☑; #43 MAPPO eğitimi ve #44 ONNX deploy kaldı |

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
- 2026-09-03: Faz A (Türkçe anlatım) BİTTİ, ADR-0010. Chatterbox +
  `content/voices/ege.wav` ile 11 satır (`view/voiceLines.js`, HUD metinleriyle
  birebir), `tools/make-voice.mjs` (Chatterbox → ffmpeg kırpma/loudnorm/Opus,
  `--take N` ile kulakla seçim), `sfx.js` `say()/comment()` (öncelik 2 keser,
  1.2 s aralık, 4 s tekrar kilidi, düdükten 250 ms sonra), `main.js` tek satır.
  Tarayıcıda doğrulandı: 11 klip decode, taç → klip, tekrar düşürüldü, gol
  üstüne konuştu, konsol temiz; klasör boşken 14 olay tipi hatasız.
  `test:assets` sözleşmeyi test eder (tablo ↔ jobs ↔ disk). İki gerçek bulgu:
  Chatterbox tek kelimede bimodal (0.4 s temiz / 1.3 s kuyruk) → take'ler
  kullanıcıya gönderildi; `window.__game.sfx` ilk buildMatch'te TDZ →
  getter. Vite 4 KB inline limiti 2 klibi `data:` yaptı (zararsız).
  Sırada Faz B (panolar), D (müzik), C (forma).
- 2026-08-08 (12): Faz 1.7d (#38-#41) KAPANDI. Anlatım: 29 replik × TR/EN,
  öncelik/kesme/cooldown + 12 sn tekrar penceresi, tansiyona bağlı yoğunluk;
  runtime TTS yok, klipler manifest üzerinden. Ses henüz yok — hat doğru
  süreli sessiz placeholder'larla uçtan uca çalışıyor, 58 kaydın listesi
  (metinleri ve süreleriyle) HUMAN-QUEUE'ya yazıldı. Tansiyon formülü
  bileşen ağırlıkları tam 1'e toplanacak şekilde yazılmış; koordinatör
  bağımsız denedi: maç başı 0-0 → 0.28, son dakika 0-0 → 0.77, son dakika
  0-4 → 0.42, kale önünde → 0.96, altın gol tabanı 0.85. (İlk denemede alan
  adını yanlış verip "altın gol çalışmıyor" sanmıştım; kaynağa bakınca hata
  bendeydi.) xG-lite beş özellikli lojistik, katsayılar kaynakta ve ekranda
  açık; MVP ağırlıkları xG'nin gerçek golü asla geçemeyeceği şekilde ayarlı.
  Stadyum: 12 varyant, oda kodundan deterministik seçiliyor (tel trafiği yok),
  yağmur tam +1 draw call. Ajan `hostSession`'a olay gözlemcisi eklemek
  zorunda kaldı: çekirdeğin olay listesi tüketilip atılıyordu, kozmetik katman
  kurtarışı/müdahaleyi göremiyordu.
- 2026-08-08 (11): Faz 1.6 (#21-#25) KAPANDI — arena'ya atmosfer katmanı:
  VAT seyirci (1387 kişi, tek draw call, 5 klip), kozmetik XPBD file (topu
  yutuyor, post-correction'la top asla ağın arkasına geçmiyor), bayrak cloth,
  top toplayıcı sahnesi, forma sistemi (atlas + renk maskesi + numara; 100
  değişimde sıfır materyal tahsisi) ve iOS autoplay kapısı olan ses katmanı.
  Ölçüm: atmosfer +5 draw call / +67k üçgen (yüksek kademe), üçgen bütçesi
  (<150k) tutuyor. DÜRÜST TESPİT: draw call bütçesi (<100 masaüstü) tutmuyor
  ama sebep atmosfer değil — arena sahnesi zaten 108-111 call'da, çünkü stadyum
  ~28 ayrı kutu ve her oyuncu 7 ayrı mesh. Bu #19'un işi, o satır hâlâ açık.
  Ajan üç gerçek hata yakaladı: kozmetik top sürtünmeyi alt-adım başına
  uyguluyordu (çizgiyi 11 cm geçip duruyordu), post-correction'dan SONRA
  çalışan iki fonksiyon ipleri topun içine geri itiyordu, ve bayrak
  geometrisinde normal yoktu (siyah render).
- 2026-08-08 (10): Faz 2'nin ilk satırları (#42 parity, #45 deney planı) KAPANDI.
  `python/` altında çekirdeğin NumPy portu: 5 senaryoda (Faz 1.2 senaryosu +
  altın gol/mercy/skor limiti/tam süre) tick-tick checksum zinciri JS ile
  bit-özdeş, TOLERANS YOK; constantsHash Python'da yeniden hesaplanıp
  `7f502ae2` çıktı. Koordinatör testin yalanlanabilirliğini bizzat sınadı:
  simülasyon adımındaki PLAYER_DAMPING'i bir LSB bozunca "FIRST DIVERGENCE at
  tick 38 / PARITY FAILED", geri alınca yeşil. (İlk denemede yanlış satırı —
  tavsiye fonksiyonunu — bozmuştum, o yüzden testi haksız yere suçlamadım.)
  Portta iki gerçek tuzak belgelendi: `MappingProxyType` `isinstance(dict)`
  kontrolünden geçmiyor (sessizce varsayılan ayarlara düşürüyordu) ve JS
  `Math.round` `floor(x+0.5)` değil. Ayrıca gym-tarzı eğitim ortamı ve
  `deney-plani.md` (S1-S4 araştırma soruları, 8 ablation, 5 seed, 3060'ta
  ~3 hafta bütçe, figür figür makale iskeleti).
- 2026-08-08 (9): Faz 1.7c (#33-#37) KAPANDI — `packages/social`: Plackett-Luce
  OpenSkill (80 maçta 4v4 mu farkı 9.53, 1v1 kontrolü 2.69 — takım sonucu dörde
  bölündüğü için yavaş olması beklenen davranış), 8 maçlık placement (×1.72
  hızlı), atalet decay'i varyansta lineer. Sezon sıfırlaması yayılımı tam yarıya
  indiriyor ve sırayı bozmuyor. İzleyici bütçesi gerçek ölçümle kanıtlandı:
  16 izleyicide de yayın başına 3 payload kodlanıyor (naif tasarım 2576'ya
  çıkardı). İsim filtresi 27/27 evasion varyantını yakaladı, 47/47 meşru Türkçe
  ismi geçirdi; bilinen tek yanlış-pozitif "Niger" ve bu kod içinde açıkça
  belgelenmiş (allowlist'e almak küfrü açardı). Quick chat sabit ifade tablosu
  üzerinden çalıştığı için tel üzerinden hakaret taşınamıyor.
- 2026-08-08 (6): Faz 1.7a (#26-#29) KAPANDI. Maç ayarları tek kanonik nesne
  (`normaliseSettings` + `settingsHash a168d11e`), saha preset'leri 27/36/45 m
  tam tamsayı oranıyla, altın gol / mercy (4 fark) / skor limiti önceliği
  mercy > altın gol > limit. Preset `constantsHash`'e DEĞİL header'a yazıldı:
  aynı kodu koşan iki peer farklı odada "uyumsuz build" gibi görünmesin diye
  (ADR-0005). constantsHash `7f502ae2` sabit, STATE_VERSION 3, core gate 182
  kontrol. Koordinatör takip işini kapattı: botlar orta preset'e sabitlenmişti,
  gözlem normalizasyonu artık `pitchFor(world)` ile presete göre ölçekleniyor —
  üç preset'te de aynı normalize değer okunuyor. (Bu iş sırasında köşegeni
  yarım hesaplayıp botları golsüz bıraktım; testler yakaladı, düzeltildi.)
- 2026-08-08 (8): Faz 1.7b (#30-#32) KAPANDI — `packages/replay`: input-kayıtlı
  konteyner (varint delta + RLE), 10 sn keyframe ile ortalama 0.97 ms seek,
  3 dk 4 oyunculu maç 120 kB sıkışıyor. Paylaşım için kısa-ID öneriliyor
  (base64 URL 164k karakter olacaktı; `toUrl()` uzun olanı sessizce kesmek
  yerine reddediyor). En iyi 3 an: gol 100 / kurtarış 70 / direk 50 / uzak şut
  30, son dakikada ×1.5, çakışan pencereler eleniyor. Çekirdek direk olayı
  yaymadığı için kaydedici bunu topun radyal hızının işaret değiştirmesinden
  türetiyor (constantsHash'e dokunmamak için). Koordinatör iki ADR'nin aynı
  numarayı (0005) aldığını fark edip arena olanını 0007'ye taşıdı.
  Koordinatör arena'yı tarayıcıda bağımsız doğruladı: 4v4 kalecili maç,
  tick 1750, 7 bot politikası, konsol temiz. Gözlem: botlar topun etrafında
  kümeleniyor (pozisyon alma zayıf) — Faz 2 MARL'ın çözeceği bir konu,
  MANUAL-TESTS'e his notu olarak eklendi.
- 2026-08-08 (7): #12 ve #13 için deterministik istemci `/arena.html` olarak
  ayrı giriş noktasında yazıldı (ADR-0007); yayındaki oyun `/` adresinde
  değişmedi, görüntü katmanı ve PeerJS taşıması fork edilmeden kullanıldı.
  Modlar 1v1/2v2/3v3 (kalecisiz) ve 4v4 (takım başına tam bir kaleci, lobide
  seçilir, maç boyu sabit); boş slotlar seçilen zorlukta bota gidiyor, botlar
  yalnız host'ta koşuyor. Ölçek eşlemesi tek sabit: `UNITS_PER_METRE = 23.3333`
  (840 birim = 36 m), gerçek duvarlar çekirdeğin sayılarından çiziliyor.
  Kapılar: `test:arena` 125/125, `test:arena2tab` 30/30 (in-process + gerçek
  Chromium iki sekme: aynı skor, tick 1011'de checksum `6035d1ea` iki tarafta
  da aynı, misafirde bot çağrısı 0'a karşı host'ta 2030). Yukarı akışta iki
  gerçek hata çıktı ve düzeltildi: `hostSession` saati yeniden çıpalarken
  snapshot yayınını susturuyordu (20 Hz yerine 1.8 Hz ölçüldü) ve host/bot
  inputundan 9 butonluk maskeyi düşürüyordu. Matris işareti koordinatörde.
- 2026-08-08 (5): Faz 1.2'nin çekirdek satırları (#7-#11) KAPANDI. Ölçümler:
  dribbling 10 m = 6 dokunuş / 0 turnover (kabul 5-8), şarj eğrisi 0.30x→1.00x
  (sapma <1e-3), falso ±52 birim saptırıyor ve hız %1.2 içinde kalıyor (boost
  değil rotasyon), tackle %47.2 temiz kazanım (kabul %40-55) ve takım
  arkadaşına 0 etki, kaleci tutma 210 tick / ıska kilidi 60 tick / grief
  koruması çalışıyor. constantsHash `fd1b55e2`→`7f502ae2`, STATE_VERSION 2.
  Koordinatör iki takip işini kapattı: netcode INPUT mesajı artık 9 butonluk
  bitmask taşıyor (eski `kick` alanı bit 0 olarak korunuyor, test eklendi) ve
  physics-constants.md'ye Faz 1.2 sabit bloğu + hash geçmişi işlendi. Bot
  fixture'ı yeni çekirdekle yeniden üretildi.
- 2026-08-08 (5): Faz 1.7d sunum katmanı (#38-#41) kuruldu —
  `packages/client/src/arena/present/`. #38 anlatım: 29 replik × TR/EN,
  öncelik + kesme + replik-başı cooldown + 12 s tekrar penceresi + tansiyona
  bağlı yoğunluk; runtime TTS YOK, klip manifesti + çalar, placeholder klipler
  üreteçle (gerçek kayıt HUMAN-QUEUE'da, 58 satırlık fiş yazıldı). #39 tansiyon:
  skor yakınlığı + saat + saha bölgesi + sahiplik dengesi -> tek skaler,
  ağırlıklar 1'e toplanıyor, subscribe kancası kalabalık katmanına açık.
  #40 stadyum: gece/gündüz + açık/yağmur + 3 tema = 12 varyant, oda kodundan
  deterministik seçim, yağmur tek LineSegments + tek uniform (ölçüldü: +1 draw
  call, 9000/4500/1620 segment kademe), mobilde otomatik kısılma + manuel
  override. #41: xG-lite (5 özellikli lojistik, formül brain/20-tech-spec/
  presentation-formulas.md'de çalışılmış örneklerle) + MVP ağırlıklı toplamı +
  maç sonu ekranı. Katman core'dan READ-ONLY: tek dokunuş hostSession'a
  eklenen `onEvents` gözlemcisi. `npm run test:present` 158/158.
- 2026-08-08 (4): Faz 1.5 (#20) KAPANDI — `packages/bots`: 100 özellikli
  egosentrik observation (takım 1 için 180° döndürme, mirror değil), 18
  ayrık / 7 sürekli aksiyon, scripted politika 3 kademe (ölçülen: tepki
  24/8/4 tick, nişan sapması 0.023/0.012/0.004, zor kolayı 10-0 yendi),
  ONNX politikası enjekte edilen runtime ile aynı arayüzde. Ajan gerçek bir
  hata yakaladı: core vuruşu yalnız yükselen kenarda tetikliyor, bot tuşu
  basılı tutunca tek vuruş oluyordu (4 tick bas / 8 tick bırak ile düzeldi).
  Faz 1.2 oynanış ajanı hâlâ çalışıyor.
- 2026-08-09 (2): TEK OYUN kararı uygulandı ve asset hattı kuruldu.
  Arena bir hedef olmaktan çıktı (menü girişi kaldırıldı, build tek belge
  üretiyor); kaynakları ağaçta duruyor çünkü tek oyun onların üstüne kuruluyor.
  ADR-0009 ile sahalar birleşti (22.03 × 36 m, 7.29 m kale) — genişletme iki
  şeyi bozdu ve ikisi de A/B ile bulundu: slayt başarısı %47→%18 düştü (eski
  oranın bir kısmı dar sahanın hücumcuyu köşeye sıkıştırmasıymış; TACKLE_REACH
  12→20 ile geri geldi) ve scripted botlar 60 saniyede gol atamaz oldu (bu
  gerileme değil, 22 m sahada normal futbol — replay fixture'ı 4→6 kişi).
  Motor kararı bir kez TERSİNE döndü: "çekirdek motor olsun" önerisi yanlıştı,
  çünkü çekirdek 2 BOYUTLU (topun durumu x,z,vx,vz — yükseklik yok). Uygulansa
  kafa golü, havalanan şut, orta ve filenin uçan topu yakalaması silinecekti.
  Karar: 3B float motor kalır, çekirdek emekli.
  Asset hattı uçtan uca: Sketchfab token'ı → `tools/fetch-models.mjs` (lisansı
  API'den okur, NC/ND ve gerçek kişi benzerliğini reddeder, CREDITS yazar) →
  `tools/blender/prep-vendor.py` (metre cinsine koşullar, zemine oturtur,
  rigged modellerde iskeleti korur) → `view/vendorModel.js`. Gelenler: panelli
  top, stadyum koltuğu (1566 adet, boşlar dahil), projektör, kulübe + yedekler,
  skorboard (canlı skor), stadyum kabuğu, iskeletli futbolcu ve kaleci.
  Boru hattında dört tuzak ölçerek bulundu ve kapatıldı: üst düğümdeki inç→metre
  ölçeği, Blender'ın Z-yukarı ekseni, çok-mesh modelin ilk parçasının alınması,
  ve rigged modelde parent temizlemenin mesh'i pankeke çevirmesi.
  Ayrıca: rüzgâr (top+file+yağmur+bayrak tek kaynaktan), kar, saha yıpranması,
  forma sırt numarası + kaleci forması, `/numara` ve `/forma` komutları,
  render bütçesinin telefondan ayrılması (150k → masaüstü 2.5M).
  Bir de dürüst bir kayıt: titreme düzeltmesi ilk denemede İŞE YARAMADI —
  unit testler yeşilken ekranda hiçbir şey değişmedi, çünkü test aritmetiği
  ölçüyordu, bağlantıyı değil. Gerçek tarayıcıda ölçüm (`test:jitter`) eklendi.

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
