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
| 1.3 | ☐ | — | |
| 1.4 | ☐ | — | |
| 1.5 | ☑ | faz1.5-bots | #20 observe→action; scripted 3 kademe + ONNX aynı arayüz (enjekte runtime) |
| 1.6 | ☐ | — | |
| 1.7a | ☑ | faz1.7a-rules | #26-#29; settingsHash ayrı (constantsHash "aynı build?", settingsHash "aynı oda?") |
| 1.7b | ☑ | faz1.7b-replay | #30-#32; input-kayıtlı konteyner, keyframe seek 0.97ms, kısa-ID paylaşımı |
| 1.7c | ☑ | faz1.7c-social | #33-#37; izleyici maliyeti sabit, isim filtresi homoglyph-dayanıklı |
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
