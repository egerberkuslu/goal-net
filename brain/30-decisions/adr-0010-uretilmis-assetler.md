# ADR-0010: Üretilmiş assetler — anlatım, pano, müzik, forma

- **Durum:** kabul edildi
- **Tarih:** 2026-09-03
- **Bağlam:** ADR-0009 (tek oyun), brain/20-tech-spec/asset-sources.md

## Bağlam

İndirilmiş modeller (Sketchfab rig'leri, fotoğraf çim, vendor mobilya) oyunun
kendi kamerasından "rezalet" okundu ve geri alındı: stil uyuşmadı, ölçek ve
UV tuzakları dört ayrı düzeltme istedi, kaleci bir kez baş aşağı sahaya çıktı.
Oyun şu an orijinal temiz görünümünde ve öyle kalacak.

Kullanıcının makinesinde `~/Desktop/video-lab` var: tamamen yerel, hesapsız
üç üreteç — FLUX schnell (görsel), Chatterbox (ses klonu, Türkçe destekli,
`content/voices/ege.wav`), ACE-Step (müzik). İstek: bunlarla oyunu **kendi
diline uygun** assetlerle doldurmak — Türkçe maç anlatımı, reklam panoları,
menü müziği, forma desenleri.

## Karar

1. **Asset indirilmez, üretilir.** Kaynak her zaman yerel üreteç; çıktı
   oyunun paletine ve düz vektör diline uydurulur.
2. **Taşıma kuralı:** gönderilen her asset `packages/client/src/view/<tür>/`
   altında yaşar ve `import.meta.glob('./<tür>/*.<ext>', {eager, query:'?url'})`
   ile bulunur — **try/catch içinde** (node'da `import.meta.glob` yok; headless
   testler view dosyalarını import ediyor). Bu, `vite build`'i geçen tek yol:
   `dist-assets/` gitignore'lu ve build tarafından kopyalanmıyor. Kök
   `.gitignore`'da `*.png` var → görsel **WebP**, ses **Opus**.
3. **Yokluk = sessizlik/düz renk, asla hata.** Klasör boşsa glob boş harita
   döner; `say()` ilk satırda çıkar, pano düz rengini korur, müzik no-op.
4. **Anlatım:** 11 kısa satır (`view/voiceLines.js`), HUD metinleriyle birebir.
   Saf `pickVoice()` anti-spam: öncelik 2 (gol) her şeyi keser; 1.2 s asgari
   aralık; aynı satır 4 s içinde tekrarlanmaz; düdüklü olaylarda spiker 250 ms
   sonra. `kick/ragdoll/shoulder` bilerek sessiz. Chatterbox'ın seed'i yok →
   `--take N` ile iki kayıt, satır satır kulakla seçim.
5. **Panolar:** FLUX'a **yazı yazdırılmaz** (schnell Q4'te metin güvenilmez;
   Box yüz UV'leri ayna olabilir; pano yayın kamerasından ~250×30 px). Düz
   vektör, iki renkli soyut banner; sahte marka adları gerekirse kanvasla, ayrı
   adımda. Kamera tarafı panolar `opacity 0.3` kalır — top görünmeli.
6. **Formalar:** FLUX 256×256 silindirik şerit **çizmez** (UV, numara, flip'i
   tutturamaz). Siyah-beyaz desen swatch'ı üretir; araç zamanında preset'in
   kendi `base/accent` renklerine boyanır; kanvas hattı (kenar, numara, gölge)
   dokunulmaz. Palet oyunun paleti kalır — stil kalkanı bu.
7. **Müzik:** sadece menü ve pause'da; oyun içinde 0. Kalabalık yatağı ve
   anlatımla tek slider'ı paylaşmasın. ffmpeg ile kusursuz döngü, Opus.
8. **Her faz tek başına gönderilebilir** ve sırayla: anlatım → panolar →
   müzik → formalar. Her fazın sonunda kapı + build + ekran/kulak doğrulaması +
   push. Getirisi en belirsiz olan (forma) en sonda; "hayır" bedava.

## Sonuçlar

- Oyun kendi sesiyle konuşur ve kendi assetleriyle dolar; hiçbir şey dış
  servise bağlı değil.
- `scripts/assets-test.mjs` üreteçlerle oyun arasındaki **sözleşmeyi** test
  eder (tablo ↔ jobs ↔ disk); modeli çalıştırmaz. Klasör boşsa WARN, yarımsa FAIL.
- Üreteçler sırayla çalışır (12 GB, tek model); Chatterbox `PYTHONPATH=""` ve
  `gen-tools/.venv`, diğerleri `audio-tools/.venv`.
- `music.py` `video-lab/work/music.wav`'ı ezer → hash'ten kopyalanır.

## v2 önerileri (uygulanmadı)

- Panolara sahte marka adları (yüz başına ayna kontrolüyle).
- Ayrı "Anlatım" ve "Müzik" slider'ları / pause menüsünde müzik anahtarı.
- Satır başına birden fazla take'in rastgele seçimi ("Gol!" çeşitleri).
- ACE-Step ile tribün tezahüratı (vokal).
- `keeper-release` / `shoulder` satırları; oyun içi düşük seviyeli müzik.
- Blender MCP bağlanınca skorboard kasası ve kulübe geometrisi.
