---
title: "Faz 2 Akademik Deney Planı ve Makale İskeleti"
type: research
status: active
date: 2026-08-08
related: ["[[onnx-bots]]", "[[adr-0008-numpy-portu-ve-parity]]", "[[adr-0003-sayi-temsili]]", "[[adr-0005-mac-ayarlari-ve-saha-presetleri]]"]
---

# Faz 2 Deney Planı (matris #45)

Matris #43 (MAPPO self-play, "scripted botu >%70 yenen politika") ve #44 (ONNX
deploy) bu planın uygulanmasıyla kapanır. Burada yazan her sayı bir deney
tasarımı kararıdır; koşu sonuçları PROGRESS'e ve makaleye gider.

## 1. Araştırma sorusu

**Bit-deterministik bir simülatör, çok-ajanlı pekiştirmeli öğrenmeyi
tarayıcıya kadar taşınabilir kılar mı — ve bunun bedeli nedir?**

Alt sorular, her biri ayrı bir deneyle ölçülür:

- **S1 (parity kazancı).** Eğitim ortamı ile deploy ortamı bit-özdeş olduğunda
  sim-to-sim boşluğu sıfırdır. Bunu ölçmek yerine *kanıtlıyoruz* (ADR-0008),
  ama karşılaştırma noktası olarak float bir ortamda eğitilen aynı politikanın
  deterministik core'da ne kadar kaybettiğini ölçeriz. Hipotez H1: float
  ortamda eğitilen politika, deterministik core'da ölçülebilir (>%3 kazanma
  oranı) kayıp yaşar; deterministik ortamda eğitilen yaşamaz (tanım gereği 0).
- **S2 (müfredat).** 1v1 → 2v2 → 3v3 → kalecili 3v3 müfredatı, doğrudan 3v3
  eğitimine göre daha az örnekle mi aynı seviyeye ulaşır? H2: evet, hedef
  seviyeye ulaşmak için gereken çevre adımı ≥%30 azalır.
- **S3 (ödül şekillendirme).** Potansiyel-tabanlı şekillendirme (PBRS) örnek
  verimliliğini artırır ama son politikayı değiştirmez. H3: PBRS'li koşular
  daha erken öğrenir, nihai kazanma oranı farkı istatistiksel olarak anlamsızdır
  (Welch t-testi, 5 seed).
- **S4 (deploy maliyeti).** INT8 kuantizasyon ve WASM yürütme, oyun kalitesini
  ne kadar düşürür? H4: FP32→INT8 kazanma oranı düşüşü <%2, gecikme kazancı 2-3x.

Katkı iddiası (makalenin "contribution" cümlesi): *tarayıcıda çalışan,
P2P, insan-karşıtı bir futbol oyunu için, eğitim ile dağıtım arasında
bit-özdeşliği kanıtlanmış uçtan uca bir MARL hattı; ve bu hattın müfredat,
şekillendirme ve kuantizasyon eksenlerinde ölçülmüş maliyet-fayda tablosu.*

## 2. Ortam

`python/haxball3d_sim` (ADR-0008). Ortam parametreleri deneyler arası sabit:

| Öğe | Değer | Gerekçe |
|---|---|---|
| Gözlem | 100 özellik, ego-merkezli atak çerçevesi | `observation.js` ile bit-özdeş; her iki takım aynı ağırlıkları kullanır |
| Aksiyon | 18 ayrık (idle + 8 yön + kick × 9) | `action.js` tablosu; checkpoint'ler bu tabloya pinlenir |
| Karar frekansı | 10 Hz (6 tick) | `onnx-bots.md`; tarayıcıdaki bot da bu hızda karar verir |
| Maç | 180 s, skor limiti 3, orta saha, mercy açık | `DEFAULT_SETTINGS` |
| Bölüm uzunluğu | ≤ 1800 karar (180 s) | maç kuralları erken bitirir |
| Ödül | gol farkı + PBRS (γ=0.99, katsayı 0.1) | bkz. §5 |

Saha preset'i (küçük/orta/büyük) ve kaleci varlığı **domain randomization**
olarak değil, ayrı değerlendirme koşulları olarak kullanılır: eğitim orta
sahada, genelleme testi diğer ikisinde (§6, G3).

## 3. Baseline'lar

1. **Scripted üç kademe** (`packages/bots/src/scripted.js`, `TIERS`): `kolay`
   (reaction 13 tick, aimNoise 110 u, pace 0.90), `orta` (6 / 45 / 1.00), `zor`
   (1 / 12 / 1.00). Bunlar hem baseline hem de değerlendirme rakibidir; #43'ün
   kabul ölçütü (">%70") `orta` kademeye karşıdır, `zor` ise tavan ölçümüdür.
2. **Rastgele politika.** Zemin çizgisi; kazanma oranı ölçeğinin 0 ucunu verir.
3. **Kendine-oyun dondurulmuş ilk checkpoint.** Öğrenmenin gerçekten ilerlediğini
   gösteren iç referans (Elo eğrisinin monotonluğu).
4. **Ablasyonsuz MAPPO** (tam müfredat + PBRS): ana yöntem, ablasyonların
   karşılaştırma noktası.

Baseline'lar deterministik: scripted politikalar `reset(seed)` ile geri sarılan
kendi PRNG'lerini kullanır, `Math.random` yoktur. Aynı seed + aynı checkpoint =
aynı maç, yani her rapor edilen sayı yeniden üretilebilir.

## 4. Yöntem

- **Algoritma:** MAPPO (merkezi kritik, paylaşımlı ağırlıklar; kaleci ayrı
  politika kafası). Referans uygulamalar: GRF_MARL, epymarl.
- **Ağ:** 2×256 MLP gövde (obs 100 → 256 → 256), politika kafası 18 logit,
  değer kafası 1. Kritik girdisi: tüm ajanların gözlemi + top durumu
  (merkezi, eğitim zamanı).
- **Self-play:** son 10 checkpoint'lik havuz, %70 en güncel / %30 havuzdan
  örnekleme; havuz çeşitliliği çöküşü (policy collapse) için Elo takibi.
- **Müfredat:** 1v1 → 2v2 → 3v3 → kalecili 3v3. Geçiş ölçütü: mevcut aşamada
  `orta` scripted'a karşı 200 maçlık pencerede kazanma oranı ≥ %65 ve son 3
  değerlendirme penceresinde plato (≤ %2 iyileşme).
- **Paralel ortam:** 64 kopya (`HaxballEnv`, süreç başına 8, 8 süreç).
- **Seed:** her koşu 5 seed (0-4). Rapor edilen her sayı 5 seed üzerinden
  ortalama ± standart hata; eğriler IQM (interquartile mean) ile de verilir
  (Agarwal ve ark.'nın "deep RL at the edge of the statistical precipice"
  eleştirisine cevap olarak).

## 5. Ödül

```
r = 1.0 · (attığımız gol − yediğimiz gol)
  + 0.1 · (γ·Φ(s′) − Φ(s)),  γ = 0.99
Φ(s) = −mesafe(top, hücum ettiğimiz kale) / saha köşegeni
```

Gol terimi gerçek amaçtır ve iki takım arasında tam sıfır toplamlıdır
(`test_parity.py` bunu doğruluyor). İkinci terim Ng-Harada-Russell
potansiyel-tabanlı şekillendirmedir: optimal politikayı **değiştiremez**,
yalnızca ne kadar çabuk bulunduğunu etkiler. Makalede bu özellik açıkça
belirtilir ve S3 ile deneysel olarak da gösterilir.

Sahiplik (possession) potansiyeli `shaping_terms` kancasıyla eklenebilir; ana
koşuda kapalıdır, A3 ablasyonunda açılır.

## 6. Değerlendirme protokolü ve metrikler

Her değerlendirme **200 maç** (100 ev sahibi + 100 deplasman, taraf değişimi
zorunlu — saha simetrik ama kickoff takımı değil).

| Metrik | Tanım | Neden |
|---|---|---|
| **Kazanma oranı** (birincil) | `orta` scripted'a karşı galibiyet oranı, beraberlik 0.5 | #43'ün kabul ölçütü |
| Gol farkı/maç | ortalama (attığımız − yediğimiz) | kazanma oranının doyduğu yerde ayırt eder |
| Sahiplik | topa en yakın oyuncunun bizde olduğu tick oranı | oyun stili; ödül şekillendirmesinin etkisi burada görünür |
| Şut/isabet | `shot` olayı ve gol dönüşümü | xG-lite (matris #41) ile aynı tanım |
| Örnek verimliliği | %70 kazanma oranına ulaşmak için gereken çevre adımı | S2/S3'ün birincil ölçütü |
| Elo / OpenSkill | havuz içi turnuva | öğrenmenin monotonluğu; rating altyapısı zaten seçilmiş (Araştırma 2) |
| Karar gecikmesi | ONNX inference p50/p95, WASM | S4 |

**Genelleme koşulları:** G1 kalecili/kalecisiz, G2 farklı takım büyüklüğü
(3v3'te eğitilip 2v2'de test), G3 farklı saha preset'i (küçük/büyük).
Hiçbiri eğitimde görülmez.

## 7. Ablasyonlar

| # | Ablasyon | Ne test edilir |
|---|---|---|
| A1 | Müfredat yok (doğrudan 3v3) | S2 |
| A2 | PBRS yok (yalnız seyrek gol ödülü) | S3 |
| A3 | PBRS + sahiplik potansiyeli | şekillendirme doygunluğu |
| A4 | Self-play havuzu yok (yalnız en güncel rakip) | politika çöküşü |
| A5 | Gözlem kırpması: takım arkadaşı/rakip slotları kapalı | gözlemin hangi kısmı işe yarıyor |
| A6 | Kaleci ayrı kafa yerine ortak politika | ADR-0001'in sabit rol kararının maliyeti |
| A7 | FP32 → INT8 (deploy) | S4 |
| A8 | Karar frekansı 10 Hz → 20 Hz / 5 Hz | tarayıcı bütçesi ile oyun kalitesi dengesi |

Her ablasyon 5 seed. A1-A6 tam müfredat bütçesiyle, A7-A8 yalnız en iyi
checkpoint üzerinde (yeniden eğitim yok).

## 8. Hesap bütçesi (RTX 3060 12 GB)

Tek GPU, tek makine. Ölçülen gerçek: skaler Python core'da 3000 tick ≈ 0.5 s
(≈ 6k tick/s tek çekirdek), yani 10 Hz kararla ≈ 1k karar/s/çekirdek.

| Kalem | Hesap | Değer |
|---|---|---|
| Ortam throughput | 8 süreç × 8 env × ~1k karar/s | ~50-60k karar/s hedef, ölçülecek |
| Aşama başına bütçe | 1v1 5M, 2v2 10M, 3v3 20M, kalecili 15M | 50M çevre adımı |
| Duvar saati (1 seed, tam müfredat) | 50M / 50k | ≈ 17 saat |
| 5 seed × (ana + A1, A2, A4) | 4 konfig × 5 seed | ≈ 14 gün, gece koşuları |
| A3, A5, A6 (kısaltılmış: yalnız 3v3 aşaması, 20M) | 3 × 5 seed × 7 saat | ≈ 4.5 gün |
| Değerlendirme | 200 maç × ~1800 karar, inference dahil | koşu başına dakikalar |
| **Toplam** | | **≈ 3 hafta GPU zamanı** |

Riskler ve azaltmalar: (a) throughput hedefin altında kalırsa `vectorised=True`
modu ve env başına toplu gözlem hesabı devreye alınır, gerekirse aşama
bütçeleri %40 kısılır — plan ablasyon sayısını değil bütçeyi keser;
(b) 12 GB için ağ küçük, sorun VRAM değil CPU; süreç sayısı çekirdeğe göre
ayarlanır; (c) uzun koşular `claude-train` ile detached tmux'ta, wandb takibi,
DVC ile veri/parametre sürümü.

## 9. Yeniden üretilebilirlik

- Her koşu: git commit + `constantsHash` + `layout.json` hash'i + seed +
  config, wandb'a yazılır. `constantsHash` uyuşmayan bir checkpoint yüklenmez.
- Değerlendirme maçları input-only replay olarak saklanır (matris #30); makale
  figürlerindeki her maç yeniden oynatılabilir.
- DVC pipeline: `veri → eğitim → değerlendirme → figür`; her figür kod+veri+
  parametreye kadar izlenir (`reproducibility-dvc`).

## 10. Makale iskeleti

Hedef: oyun/RL uygulama konferansı (IEEE CoG veya AIIDE); dergi alternatifi
IEEE Transactions on Games. Uzunluk 8 sayfa + ek.

1. **Introduction.** Tarayıcı tabanlı P2P çok oyunculu bir oyunda bot kalitesi
   sorunu; eğitim-dağıtım boşluğu; katkı cümlesi (§1).
2. **Related work.** Google Research Football ve GRF_MARL, MAPPO, self-play
   havuzları, PBRS, determinizm/lockstep literatürü, tarayıcıda ONNX/WASM
   çıkarım.
3. **Deterministic core.** Q16.16 fixed-point (ADR-0003), tick sırası,
   checksum zinciri, `constantsHash`. **Şekil 1:** state layout + tick akış
   diyagramı (14 aşama), hangi aşamaların vektörleştirilebildiği renkli.
4. **Bit-exact NumPy port.** ADR-0008; parity rejimi ve kanıt.
   **Tablo 1:** parity kanıt tablosu (senaryo, tick sayısı, zincir digest'i,
   JS/Python). **Şekil 2:** parity harness'ın akışı (JS trace → Python replay →
   per-tick diff), ve bir yapay hata enjekte edildiğinde ilk ayrışma tick'inin
   nasıl raporlandığı.
5. **Environment and learning setup.** Gözlem/aksiyon tabloları, ödül,
   müfredat, self-play. **Şekil 3:** gözlem vektörünün grup grup anatomisi
   (self / top / kale geometrisi / bağlam / takım arkadaşı-rakip slotları).
6. **Experiments.**
   - **Şekil 4:** öğrenme eğrileri, x = çevre adımı, y = `orta` scripted'a karşı
     kazanma oranı; 5 seed, IQM + %95 bootstrap bandı; müfredat geçişleri
     dikey çizgilerle işaretli.
   - **Şekil 5:** ablasyon çubukları (A1-A6), nihai kazanma oranı ve %70'e
     ulaşma adımı, yan yana.
   - **Tablo 2:** üç scripted kademeye karşı kazanma oranı, gol farkı,
     sahiplik, şut isabeti.
   - **Şekil 6:** genelleme ısı haritası (G1-G3): eğitim koşulu × test koşulu.
   - **Tablo 3:** deploy — FP32 vs INT8, kazanma oranı, model boyutu, p50/p95
     gecikme, WASM tek-thread vs çok-thread (COOP/COEP açık/kapalı).
   - **Şekil 7:** niteliksel — bir golün üretim örneği; top izleri ve oyuncu
     konumları, öğrenilmiş politika ile `zor` scripted karşılaştırmalı.
7. **Discussion.** Parity'nin bedeli (ikiz bakım), fixed-point'in tuning
   maliyeti, PBRS'nin sınırları, self-play havuzunun çeşitliliği.
8. **Limitations.** Tek oyun, tek donanım, insan değerlendirmesi yok
   (kullanıcı çalışması v2), 2D fizik (yükseklik yok).
9. **Conclusion.**
- **Ek A:** sabit tablosu ve `constantsHash`. **Ek B:** 100 gözlem özelliğinin
  tam listesi. **Ek C:** hiperparametreler. **Ek D:** parity harness'ın
  yeniden üretim komutları.

## 11. Kabul (matris #45)

Bu dosyanın kendisi + [ADR-0008](../30-decisions/adr-0008-numpy-portu-ve-parity.md)
satırın çıktısıdır: araştırma sorusu, baseline'lar, metrikler, ablasyonlar,
seed/tekrar sayısı, hesap bütçesi ve figür-figür makale iskeleti yazılı.
