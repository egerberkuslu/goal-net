---
title: "Fizik Sabitleri ve Determinizm"
type: tech-spec
status: active
related: ["[[gameplay-core]]", "[[replay-format]]"]
---

# Fizik Sabitleri (KİLİTLİ)

## Özet (BLUF)
Haxball doğrulanmış sabitleri taban; 60Hz tick; her frame
newSpeed = damping × oldSpeed. Değişiklik = ADR + constantsHash.

## Sabitler (2D taban, 3D'ye aynı oranlarla ölçekle)
| Varlık | Parametre | Değer |
|---|---|---|
| Oyuncu | accel | 0.1 |
| Oyuncu | kickingAccel (vuruş sırasında) | 0.07 |
| Oyuncu | damping | 0.96 |
| Oyuncu | radius / invMass / bCoef | 15 / 0.5 / 0.5 |
| Top | damping | 0.99 (oyuncudan YÜKSEK — şart) |
| Top | radius / invMass / bCoef | 10 / 1 / 0.5 |
| Kick | impulse | 5 (unit(oyuncu→top) yönünde EKLENİR) |
| Kick | menzil | < 25 birim |
| Kick | latch | ~18 tick (0.3s) |
| Kick | rate cap | 4-12 kick/sn |

- Kick ASLA velocity set etmez; her zaman vektörel impulse ekler.
- Oyuncu terminal hızı ≈ accel·damping/(1−damping) ≈ 2.4 birim/tick.

## Faz 1.2 sabitleri (oynanış seti)

Faz 1.1 tablosu değişmedi; aşağıdakiler ONA EKLENDİ. Gerekçeler, ölçüm
gridleri ve metre eşlemesi: [ADR-0004](../30-decisions/adr-0004-faz12-oynanis-sabitleri.md).

| Mekanik | Parametre | Değer |
|---|---|---|
| Yakın kontrol | `BTN.TOUCH` impulse | 0.35 (tam vuruşun ~%7'si) |
| Yakın kontrol | dokunuş cooldown | 6 tick |
| Yakın kontrol | kontrol yarıçapı | playerR + ballR + kickRange = 29 (türetilmiş) |
| Şut şarjı | süre | 6 → 48 tick (100 → 800 ms) |
| Şut şarjı | güç eğrisi | 0.3 + 0.7·t^1.5 (t normalize) |
| Şut şarjı | input buffer | 5 tick |
| Falso | curve sönümü | 0.97/tick |
| Falso | aftertouch penceresi | vuruş sonrası kısa pencere, yön inputu curve'e eklenir |
| Slide tackle | aktif / recovery / cooldown | 12 / 24 / 20 tick |
| Kaleci | tutma sayacı | 210 tick (~3.5 sn), dolunca zorunlu bırakma |
| Kaleci | dalış ıskası kilidi | 60 tick |
| Kaleci | grief kilidi | 180 tick (tutuştan kendi kalesine gol sayılmaz) |

`constantsHash`: `fd1b55e2` → **`7f502ae2`** (yeni anahtarlar + state layout;
kilitli değerlerin hiçbiri değişmedi). `STATE_VERSION` 1 → 2. Zincir digest'i
`cce47120` → `5b7752f4`. Eski replay/snapshot'lar bu yüzden açıkça reddedilir.

## Determinizm
- Kabul: aynı input dizisi → 2 farklı cihazda bit-özdeş checksum
  (her tick state checksum'u üret, karşılaştır).
- Yöntem kararı ADR-0003: tercih fixed-point (ör. Q16.16 tam sayı);
  saf JS float cross-platform garanti DEĞİL. NumPy portu da aynı
  temsille yazılır → parity bedava.
- constantsHash: tüm sabitlerin hash'i; replay başlığına yazılır;
  uyuşmazsa replay açıkça reddedilir.
