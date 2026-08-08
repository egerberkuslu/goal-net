---
title: "NumPy Portu — Parity Notları ve Yeniden Üretim"
type: research
status: active
date: 2026-08-08
related: ["[[adr-0008-numpy-portu-ve-parity]]", "[[adr-0003-sayi-temsili]]", "[[deney-plani]]"]
---

# Parity notları (matris #42)

Karar ve kanıt tablosu [ADR-0008](../30-decisions/adr-0008-numpy-portu-ve-parity.md)'de.
Burada portu okuyacak/bakımını yapacak kişi için işleyiş notları var.

## Nasıl doğrulanır

```bash
python3 python/test_parity.py     # 68 kontrol, PASS/FAIL, hata varsa çıkış kodu 1
python3 python/parity.py --rules  # tam zincir farkı, ilk ayrışan tick'i basar
```

`packages/core` veya `packages/bots` değiştiyse önce fixture'lar yenilenir
(komutlar `python/README.md`'de). Fixture üreticileri tamsayı PRNG kullanır ve
saat okumaz: JS değişmediyse dosyalar byte-özdeş çıkar, yani `git status`
temizse motor kaymamıştır.

## Neyin aynası neresi

| JS | Python | Not |
|---|---|---|
| `core/src/fx.js` | `haxball3d_sim/fx.py` | limb bölmesi *korunur*; truncation'ın yeri sonucun parçası |
| `core/src/checksum.js` | `checksum.py` | `Math.imul(...)>>>0` → `(h*PRIME) & 0xFFFFFFFF`; string hash UTF-16 kod birimi |
| `core/src/constants.js` | `layout.json` | el ile yazılmaz; `constantsHash` Python'da tablodan yeniden hesaplanıp karşılaştırılır |
| `core/src/matchRules.js` | `matchrules.py` | wire codec'i (encode/decodeSettings) bilerek portlanmadı: Python tüketicisi yok |
| `core/src/world.js` | `world.py` | bölüm numaraları ve sıra birebir; sıra checksum'ı belirliyor |
| `bots/src/observation.js` | `observation.py` | float32 bit deseniyle karşılaştırılır |
| `bots/src/action.js` | `actions.py` | 18 aksiyonluk tablo layout.json'dan gelir |

## Vektörleştirme: ne oldu, ne olmadı

Vektörleştirilenler (numpy int64, `World(vectorised=True)`):
input ivmesi (§2), entegrasyon (§8), duvar sınırlama (§9a), dört direk (§9c'nin
oyuncu yarısı), damping (§12). Ortak özellikleri: her lane yalnız kendi
oyuncusunun slotlarını okur ve yazar → JS'teki döngü sırası gözlemlenemez.

Vektörleştirilemeyenler ve nedeni:

- **Darbe aşamaları (§5b touch, §5c kick, §5d şut).** Hepsi tek topa yazar;
  i'nin vuruşu i+1'in menzil testini aynı tick içinde etkiler. Paralel
  değerlendirme bunu bozar — ve bozduğu yer nadir olduğu için testte geç
  yakalanırdı.
- **Disk-disk çarpışmaları (§9d, §9e).** Çift çift, sabit sırayla çözülür ve her
  çözüm bir sonrakinin girdisidir.
- **Tackle hitbox'ı (§6).** Başka oyuncuların hızını yazar.
- **Kaleci tutuş (§10).** İlk isabette `break`; "en küçük indeks kazanır"
  kuralı sıralı bir tarama demek.
- **Zamanlayıcı/buton kenarları (§1).** Vektörleştirilebilirdi ama olay listesi
  oyuncu indeksi sırasında üretiliyor; kazancı yok, riski var.

n ≤ 12 olduğu için vektörleştirme bu ölçekte **daha yavaş** (numpy çağrı
başına sabit maliyet). Ölçüm, 4 oyuncu / 3000 tick: skaler **0.42 s**,
vektörleştirilmiş **1.74 s** (≈4.1x yavaş). Mod performans için değil, "aynı
programın iki yazılışı aynı sonucu veriyor mu" sorusunu test edilebilir kılmak
için var. Gerçek eğitim throughput'u çok sayıda ortamı paralel koşturmaktan
gelecek (deney planı §8), tek ortamı vektörleştirmekten değil.

## Harness'ın kırılabildiğinin kanıtı

Geçen bir test, kırılamıyorsa hiçbir şey söylemez. `PLAYER_DAMPING`'e Python
tarafında **tek LSB** hata enjekte edilip harness koşturuldu:

```
FIRST DIVERGENCE at tick 1
  JS checksum     97150def
  Python checksum 5f8d9f22
  [  39] player[0].P_VZ   JS  195036   PY  195033   d=-3
```

Yani 3000 tick'lik zincirin sonunu değil, ilk ayrışan tick'i ve tam alanı
buluyor; çıkış kodu 1. Bir LSB'lik sabit hatası bile gizlenemiyor.

## Portta yakalanan tuzaklar

- `isinstance(raw, dict)` → donmuş `MappingProxyType` reddedilir, ayarlar
  sessizce varsayılana düşer. Çözüm `collections.abc.Mapping`. Tick 0'da
  ayrışma olarak göründü.
- `Math.round` ≠ `floor(x+0.5)` (`0.49999999999999994`). Float sınırı sadece
  `fxFromNumber`/`quantiseAxis` olduğu için etkisi sınırlı ama fixture'da var.
- `fxHypot`'un sıfır kısayolları yarılama döngüsünden **önce** gelir; vektör
  sürümünde sonda uygulanırsa `ax==0 && ay>2^26` lane'i yanlış çıkar.
- `(al*bl) >>> 16` JS'te ToUint32'den geçer; al·bl < 2^32 olduğu için Python'da
  düz `>> 16` ile aynı, ama bu bir tesadüf değil sınır: limb'ler 16 bit.

## Sonraki adım

#43 (MAPPO self-play) bu ortamın üstüne oturur. Eğitim koşusu da checksum
üretiyor (`info["checksum"]`), yani bir eğitim maçı replay gibi doğrulanabilir;
checkpoint'lerin yanında `constantsHash` ve `layout.json` özeti saklanmalı.
