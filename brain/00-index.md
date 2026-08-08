---
title: "00-INDEX — Harita ve Özellik Matrisi (DoD)"
type: index
status: active
updated: 2026-08-07
---

# 00-INDEX — Bilgi Kasası Haritası

## Notlar
- Tasarım: [gameplay-core](10-design/gameplay-core.md) ·
  [goalkeeper](10-design/goalkeeper.md) ·
  [modes-rules](10-design/modes-rules.md) ·
  [social-competitive](10-design/social-competitive.md) ·
  [presentation](10-design/presentation.md)
- Teknik: [physics-constants](20-tech-spec/physics-constants.md) ·
  [netcode-p2p](20-tech-spec/netcode-p2p.md) ·
  [replay-format](20-tech-spec/replay-format.md) ·
  [animation-standard](20-tech-spec/animation-standard.md) ·
  [rendering-optimization](20-tech-spec/rendering-optimization.md) ·
  [onnx-bots](20-tech-spec/onnx-bots.md)
- Kararlar: [30-decisions/](30-decisions/) (ADR'ler) ·
  Şablon: [adr-template](30-decisions/adr-template.md)
- Durum: [PROGRESS](40-progress/PROGRESS.md) ·
  [MANUAL-TESTS](40-progress/MANUAL-TESTS.md) ·
  [HUMAN-QUEUE](40-progress/HUMAN-QUEUE.md)
- Araştırma: [50-research/](50-research/)

## ÖZELLİK MATRİSİ = Definition of Done
Durum: ☐ bekliyor · ⏳ sürüyor · ☑ GEÇTİ · ⛔ BLOKE

| # | Özellik | Faz | Kabul kriteri | Durum |
|---|---------|-----|---------------|-------|
| 1 | Ortam kurulumu (Node, Docker, Blender+MCP, gltf araçları) | K | SETUP.md'deki her doğrulama komutu tester'da geçer | ☑ (Blender → HUMAN-QUEUE) |
| 2 | Mevcut oyun envanteri + stabilizasyon | 0 | Envanter tam; bilinen bug'lar düzeltildi; tag faz0-stable | ☑ |
| 3 | Monorepo core/client/server ayrımı | 1.1 | Core DOM'suz derlenir; client/server ayrı paket | ☐ |
| 4 | Determinizm | 1.1 | Aynı input → 2 farklı cihazda bit-özdeş checksum (ADR-0003) | ☐ |
| 5 | Host-authoritative netcode | 1.1 | 2 sekme: input→host→snapshot 20-30Hz + interp; botlar sadece host'ta | ☐ |
| 6 | Docker: web + coturn | 1.1 | compose up ile ayağa kalkar; TURN relay testi geçer | ☐ |
| 7 | Dribbling (saf fizik) | 1.2 | 10m mesafe 5-8 kontrollü dokunuşla; yapışma yok | ☐ |
| 8 | Şut şarjı | 1.2 | 100-800ms tutma → 0.3x-1x güç eğrisi; input buffer 4-6 tick | ☐ |
| 9 | Falso (skaler spin) | 1.2 | Core'da tek parametre; deterministik; görsel Magnus ayrı | ☐ |
| 10 | Slide tackle | 1.2 | Aktif+recovery pencereleri; takım arkadaşına etkisiz; başarı oranı %40-55 bandında | ☐ |
| 11 | Kaleci: maç başı seçim + tutma + degaj + 4 yön dalış | 1.2 | Rol lobide seçilir, maç boyu sabit; tutma ~200 tick; dalış whiff → ~60 tick kilit; dalış sonucu host onaylı | ☐ |
| 12 | Modlar: insan vs bot, 3v3, kalecili 4v4 | 1.2 | Her mod baştan sona oynanabilir | ☐ |
| 13 | Lobi + oda + zorluk seçimi UI | 1.2 | Oda kur/katıl/başlat akışı çalışır | ☐ |
| 14 | 8 yönlü locomotion + prosedürel katmanlar | 1.3 | Blend tree + aim/lean/foot-IK/tap; tek klip koşu yok | ☐ |
| 15 | Kaleci animasyon seti | 1.3 | Bekleme, yan adım, 4 dalış+kalkış, tutma, degaj | ☐ |
| 16 | Vuruş varyantları + kutlamalar (3-5) | 1.3 | State machine'de geçişler temiz | ☐ |
| 17 | Kamera: vuruş sarsıntısı + gol replay | 1.3 | Kozmetik; core'a dokunmaz | ☐ |
| 18 | Stadyum + dekor asset'leri | 1.4 | Sahne <150k üçgen; GLB Draco+KTX2 | ☐ |
| 19 | Performans bütçesi | 1.4 | Draw call mobil <50 / masaüstü <100; 60 FPS orta donanım | ☐ |
| 20 | Bot arayüzü soyutlama | 1.5 | Scripted ve ONNX bot aynı observe→action interface'i | ☐ |
| 21 | Seyirci (instanced + VAT) | 1.6 | Tek-birkaç draw call; idle/dalga/gol coşkusu | ☐ |
| 22 | Top toplayıcı çocuk sahneleri | 1.6 | Top dışarı → kozmetik sahne; core sadece T sn restart | ☐ |
| 23 | Kale ağı + bayrak Verlet cloth | 1.6 | Top ağı dalgalandırır; top ağdan geçmez (post-correction) | ☐ |
| 24 | Forma sistemi (atlas + renk mask + numara) | 1.6 | Takım rengi/desen/numara runtime değişir | ☐ |
| 25 | Tezahürat + temel sesler | 1.6 | iOS autoplay resume dahil çalışır | ☐ |
| 26 | Golden goal | 1.7a | Oda ayarından açılır; beraberlikte ilk gol bitirir | ☐ |
| 27 | Mercy rule | 1.7a | Oda ayarı; 4 gol farkta maç biter (açılıp kapanabilir) | ☐ |
| 28 | Saha boyutu preset'leri (K/O/B) | 1.7a | Core harita parametresi; oyuncular arası fark yok | ☐ |
| 29 | Özel oda ayarları senkronu | 1.7a | Süre/skor/saha/golden goal/mercy host-canonical, lobide görünür | ☐ |
| 30 | Tam maç replay (input kaydı) | 1.7b | Kayıt→oynatma desync'siz; constantsHash uyuşmazsa açık ret | ☐ |
| 31 | Replay paylaşımı | 1.7b | Deflate+base64 link veya kısa ID; açılır oynar | ☐ |
| 32 | "En iyi 3 an" otomatik klipler | 1.7b | Gol/save/direk heuristikleri tick aralığı üretir | ☐ |
| 33 | Rating: OpenSkill + placement + decay | 1.7c | Takım maçı sonrası mu/sigma güncellenir; 5-10 placement | ☐ |
| 34 | Sezon (soft reset + rozet) | 1.7c | Sezon kapanışında sıkıştırma reseti çalışır | ☐ |
| 35 | İzleyici modu | 1.7c | Input'suz katılım; 4+ izleyicide host yükü ölçülü/sınırlı | ☐ |
| 36 | Klan tag'i (3-5 karakter) + isim filtresi | 1.7c | Homoglyph-normalize küfür filtresi | ☐ |
| 37 | Quick chat / emote (korumalı) | 1.7c | 2-3s cooldown + spam tespiti + per-player mute | ☐ |
| 38 | Maç anlatımı (hazır klipler TR+EN) | 1.7d | Event bus + öncelik/kesme + cooldown; runtime TTS yok | ☐ |
| 39 | Tansiyon sistemi | 1.7d | Skor+süre → tek değer → crowd/anlatıcı yoğunluğu; kozmetik | ☐ |
| 40 | Stadyum varyantları (gece/gündüz, hava, temalar) | 1.7d | Baked ışık varyantları; GPU partikül; mobilde otomatik kısılır | ☐ |
| 41 | İstatistik ekranı + MVP (xG-lite) | 1.7d | Maç sonu ekranı; şeffaf formül | ☐ |
| 42 | NumPy port + parity | 2 | JS replay Python'da adım adım özdeş (checksum) | ☐ |
| 43 | MAPPO self-play eğitimi (1v1→3v3) | 2 | Scripted botu >%70 yenen politika | ☐ |
| 44 | ONNX deploy + kolay/orta/zor | 2 | INT8+WASM, worker'da; zorluklar ayırt edilir hisseder | ☐ |
| 45 | Akademik deney planı | 2 | Deney tasarımı + makale iskeleti ADR/not olarak | ☐ |

## v2 havuzu (YAPILMAZ)
Turnuva bracket, kozmetik mağaza, zıplama/kafa vuruşu, host migration,
ragdoll, stadyum editörü/paylaşımı (ADR-0002), sweeper etiketi,
training packs, tactical pings, sinematik replay FX.
