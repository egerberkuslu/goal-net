# Goal Net — Tasarım (2026-07-31)

## Amaç
Web'de three.js tabanlı penaltı/şut oyunu. Ana vitrin: gerçekçi kale filesi fiziği
(top-file teması, sarma, gerilme, momentum aktarımı).

## Kararlar (kullanıcı onaylı)
- Kapsam: penaltı + serbest vuruş odaklı şut oyunu (tam maç değil).
- Fizik: özel XPBD (extended position-based dynamics) çözücü, harici fizik motoru yok.
- Kontrol: sürükle-bırak; sürükleme eğrisi falsoyu (yan spin) belirler.

## Mimari
Fizik çekirdeği three.js'den bağımsız saf JS (node ile test edilebilir); render katmanı ayrı.

```
src/core/constants.js  — fiziksel sabitler (FIFA kale ölçüleri, top, hava)
src/core/net.js        — file topolojisi + XPBD kumaş çözücü
src/core/ball.js       — top: yerçekimi, hava direnci, Magnus, spin
src/core/physics.js    — dünya: alt-adım döngüsü, top-file teması, direk/zemin çarpışması
src/view/scene.js      — sahne: çim, saha çizgileri, kale demiri, ışık, sis
src/view/netView.js    — file render (Line2 kalın çizgiler, her karede senkron)
src/view/ballView.js   — top mesh + prosedürel desen
src/view/trajectory.js — sürükleme sırasında yörünge önizlemesi
src/game/input.js      — pointer sürükleme → hız/açı/falso
src/game/game.js       — modlar, skor, mesajlar, slow-motion, reset, kamera
src/main.js            — sabit zaman adımlı ana döngü
```

## File modeli
- Kale 7.32×2.44 m; file üst derinliği 0.85 m, alt 1.7 m, göz aralığı 0.14 m, ip yarıçapı 6 mm.
- Ana yüzey: üst direk → arka üst kıvrım → yere inen tek parametrik levha (kolon × profil ızgarası).
- Yan paneller: direk düzleminde ayrı ızgara, ana yüzeye yakınlık-dikişi (stitch) kısıtlarıyla bağlı.
- Pinler: üst direk boyu tüm ön sıra, direk boyu yan panel ön kolonu, arka üst köşeler stançon
  noktalarına, arka etek yere (seyrek kazık). Aradaki her şey serbest → doğal sarkma.
- Kısıtlar: yapısal (yatay+dikey, ~rijit, compliance 2e-6) + yumuşak çapraz (kayma, 6e-4) + dikiş.

## Top-file teması
- Küre hem düğümlere hem ip segmentlerine karşı test edilir (göz 0.14 m < top çapı 0.22 m
  olduğundan segment teması tünellemeyi engeller).
- XPBD kütle-ağırlıklı projeksiyon: düğüm ~4 g, top 430 g → tek temas topu %1 saptırır ama
  onlarca temas + ağ gerilimi topu doğal biçimde yavaşlatır, file sarar.
- Alt-adım: 60 Hz ana adım × 8 alt-adım (h≈2.1 ms) × 2 kısıt iterasyonu.

## Top
- m=0.43 kg, r=0.11 m; kuadratik sürükleme (Cd 0.25), Magnus (Cl = 1/(2+v/rω)), spin sönümü.
- Yer sekmesi (e≈0.62 + sürtünme + spin etkisi), direk/üst direk kapsül çarpışması (e≈0.7).

## Oyun akışı
- Modlar: Penaltı (11 m) / Serbest vuruş (rastgele 14–22 m).
- Sürükleme: hız → şut gücü (11–30 m/s), dikey → yükseklik, yatay → yön, eğri sapması → yan falso.
- Gol tespiti: top z=0 düzlemini çerçeve içinden geçince; gol anında 1.2 s slow-motion.
- Mesajlar: GOOOL! / Direk! / Kaçtı! — Türkçe HUD, skor/şut sayacı.

## Doğrulama
- `scripts/sim-test.mjs` (node): sert şut tünellemiyor, NaN yok, file düğümleri sınırda kalıyor,
  isabetli şut file içinde yavaşlıyor.
- Tarayıcıda Playwright: konsol hatasız, ekran görüntüsü.
