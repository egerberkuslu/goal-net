# ADR-0011: Görünüm yönü — low-poly sıcak gece

- **Durum:** kabul edildi
- **Tarih:** 2026-09-04
- **Bağlam:** ADR-0009 (tek oyun), ADR-0010 (üretilmiş assetler)

## Bağlam

Dört faz (anlatım, panolar, müzik, forma) bitip GitHub'a gittikten sonra
kullanıcı oyunu oynadı ve "hâlâ çok kötü" dedi; hangi parça diye sorulunca
dördünü birden seçti: futbolcular, tribün, ışık/atmosfer, saha/kale/panolar.
Yani sorun tek bir asset değil, **oyunun genel görünüm dili**. Bir önceki
turda indirilmiş assetler reddedilmiş, orijinal düz görünüme dönülmüştü;
sonra üretilmiş assetler eklendi ama görünüm dili değişmedi.

Bu sefer kod yazmadan önce hedef sabitlendi: FLUX'a üç konsept karesi
çizdirildi (A low-poly sıcak gece / B çizgi film akşam / C gerçekçi gece),
kullanıcıya gönderildi, **A** seçildi.

## Karar

1. **Hedef görünüm A**: low-poly, düz shading dili korunur; gece maçı; sıcak
   projektör anahtar ışığı + soğuk dolgu; projektör başlarında parlama ve
   bloom; gökyüzü gradyan kubbesi; canlı çim; kendinden aydınlık (LED) panolar;
   daha kalabalık ve renkli tribün. Fotoğraf doku yok (C reddedildi), cel
   shading yok (B seçilmedi).
2. **Kaldıraç sırası**: atmosfer (her şeyi birden etkiler) → tribün → futbolcu.
   Her adım oyunun kendi kamerasından `scripts/shot.mjs` ile doğrulanır.
3. **Hüzme konisi yok.** İlk geçişte çizildi, yayın kamerasında dört sert
   kenarlı kama gibi göründü, kaldırıldı. Projektör = baş parlaması + bloom.
4. **Bloom** `UnrealBloomPass` (güç 0.42, yarıçap 0.55, eşik 0.82): sadece
   lambalar ve en parlak beyazlar. Composer `renderer.info`'yu geçiş başına
   sıfırlar → kare başına elle `info.reset()`, bütçe ölçümü dürüst kalır.
5. **Kullanıcı oynarken canlı sunucuya (5199) dokunulmaz.** Vite her dosya
   dokunuşunda tam sayfa yeniler, maç sıfırlanır; bu "oyun bozuk" hissinin
   bir parçasıydı. Geliştirme 5311'de.
6. **Makine yükü** oyunun parçasıdır: arka plan simülasyonları ve bozuk MCP
   süreçleri kullanıcı oynarken kapatılır; 60 FPS ölçümü sessiz makinede
   yapılır.

## Sonuçlar

- Tek bir "kötü" cevabı artık bir yöne çevrilebiliyor; konsept karesi
  tartışmayı kısaltıyor.
- Görünüm işleri asset üretimiyle değil ışıkla başlıyor; en ucuz, en geniş
  etkili kaldıraç bu.

## v2

- Tribün arkasına çatı hattı ve alt-çatı ışık şeritleri.
- Futbolcu silueti: boyun, daha belirgin omuz, krampon geometrisi (Blender
  parçaları sözleşmesi içinde).
- Bayrak/atkı sallayan seyirci varyantları.
