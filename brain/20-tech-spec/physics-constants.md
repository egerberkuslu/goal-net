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

## Determinizm
- Kabul: aynı input dizisi → 2 farklı cihazda bit-özdeş checksum
  (her tick state checksum'u üret, karşılaştır).
- Yöntem kararı ADR-0003: tercih fixed-point (ör. Q16.16 tam sayı);
  saf JS float cross-platform garanti DEĞİL. NumPy portu da aynı
  temsille yazılır → parity bedava.
- constantsHash: tüm sabitlerin hash'i; replay başlığına yazılır;
  uyuşmazsa replay açıkça reddedilir.
