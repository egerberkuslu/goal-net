---
title: "ADR-0005 Deterministik istemci ayrı giriş noktasında (arena.html) ve tek ölçek sabitiyle"
type: adr
status: accepted
date: 2026-08-08
related: ["[[adr-0001-sabit-kaleci]]", "[[adr-0003-sayi-temsili]]", "[[adr-0004-faz12-oynanis-sabitleri]]"]
---

## Bağlam

Faz 1.1/1.2'de `packages/core` (deterministik, Q16.16), `packages/net`
(host-otorite oturumlar) ve `packages/bots` (tek arayüz, üç kademe) tamamlandı.
Matris #12 (modlar) ve #13 (lobi) bunların ekrana bağlanmasını istiyor.

İki kısıt çarpışıyordu:

1. `packages/client/src/main.js` **yayında olan oyun**. Kendi float fiziği,
   kendi JSON protokolü ve kendi dünya modeli var; kullanıcı onu oynuyor ve
   GitHub Pages'ten dağıtılıyor. Deterministik yığını oraya taşımak, çalışan
   oyunu yeni ve henüz kanıtlanmamış bir çekirdeğin arkasına koymak demekti.
2. Çekirdeğin arenası 400 x 840 **birim**; mevcut renderer 36 m x 22 m **metre**
   çiziyor. İkisi arasında bir eşleme seçilmeden hiçbir şey doğru yere konamaz.

## Karar

**Deterministik istemci ikinci bir giriş belgesidir** (`packages/client/arena.html`
+ `src/arena/*`); eski oyun `/` adresinde, yeni yığın `/arena.html` adresinde,
aynı build içinde yan yana yaşar. Görüntü katmanı (`view/scene.js`,
`playerView.js`, `ballView.js`, `cameraRig.js`) ve PeerJS taşıması (`mp/peer.js`)
**fork edilmeden import edilir**.

**Ölçek tek sabittir:** `UNITS_PER_METRE = 23.333333`, yani çekirdeğin kendi
`CONSTANTS.UNITS_PER_METRE` değeri (840 birim / 36 m). `src/arena/units.js`
dışında hiçbir arena dosyası 65536'ya bölmez ve metre üretmez.

## Sonuçlar

+ Yayındaki oyun hiç değişmedi; `npm run build` iki giriş belgesi üretiyor ve
  `check:dist` temiz.
+ Uzun eksen tam oturuyor: 840 birim = 36 m, yani çekirdeğin kale çizgileri
  renderer'ın `PITCH_HALF_L = 18` çizgileriyle birebir aynı yerde.
  `buildGoalFrames()` hiçbir düzeltme olmadan doğru yere kale kuruyor.
− Kısa eksen oturmuyor: 400 birim = 17.14 m, çizilen 22 m'den dar. Çim
  dokusundaki taçlar artık dekor; **gerçek duvarlar** çekirdeğin sayılarından
  çizilen beyaz sınır çizgisidir (`view.js` → `buildPitchOverlay`).
− Kale ağzı 4.71 m (FIFA 7.32 değil) ve oyuncu yarıçapı 0.643 m. Yani çekirdek
  futbol değil Haxball oranlarında; oyuncu gövdesi gerçek çarpışma diskini
  kaplasın diye 1.837x ölçekleniyor. Bu bir kozmetik borç, fizik borcu değil.
+ Tek sabit olduğu için oranları değiştirmek isteyen tek bir satır değiştirir.

## İkinci karar: aynı tarayıcıda loopback taşıma

Arena'nın taşıma katmanı iki arka uçlu: `peer` (PeerJS, yayın yolu) ve `local`
(`BroadcastChannel`, aynı tarayıcının iki sekmesi). İkincisi
`scripts/arena-2tab.mjs` için var: iki sekmenin aynı skoru ve aynı checksum'u
gördüğünü kanıtlayan bir testin, geçmek için üçüncü bir tarafın sunucusuna
(PeerJS broker) ihtiyaç duyması kanıt değildir. Aynı ikili protokol, aynı
oturumlar, aynı lobi el sıkışması; yalnızca kablo farklı.

## Yukarı akışta çıkan iki hata (arena bunları kullanınca ortaya çıktı)

- `hostSession.update()` yakalama tavanına takılıp saati yeniden çıpaladığında
  `targetSnapshot`'ı **çıpalama öncesi** `elapsed` ile hesaplıyordu; snapshot
  yayını, takılma ne kadar sürdüyse o kadar süre susuyordu. İki sekme testinde
  20 Hz yerine 1.8 Hz ölçüldü. Çıpalama sonrası saatle hesaplanıyor artık.
- `hostSession` host'un kendi inputunu ve bot inputunu `{moveXFx, moveZFx, kick}`
  olarak kırpıyordu; dokuz butonluk maske düşüyordu. Yani host oyuncusu şarj
  edemiyor, kayamıyor, kaleciyse elini kullanamıyordu. `buttons` artık geçiyor
  (yalnız `kick` kullanan çağıran için bit-özdeş davranış).

## Alternatifler (reddedilenler)

- **main.js'i deterministik çekirdeğe taşımak.** Kapsam kilidine aykırı ve
  yayındaki oyunu riske atıyor; iki yığın kanıtlanana kadar yan yana durmalı.
- **Ölçeği oyuncu yarıçapından seçmek** (42.86 birim/m). Oyuncu insan boyunda
  olurdu ama saha 19.6 m x 9.3 m'ye inerdi ve çekirdeğin kendi
  `UNITS_PER_METRE` sabitiyle çelişirdi.
- **Ölçeği kale genişliğinden seçmek** (15.03 birim/m). Kale FIFA ölçüsünde
  olurdu ama oyuncu yarıçapı 1 m, saha 56 m x 26.6 m olurdu.
- **Genişliği ayrı ölçeklemek** (x ve z için farklı katsayı). Dairesel
  çarpışmaları elipse çevirirdi: topun sekmesi ekranda fizikle uyuşmazdı.
