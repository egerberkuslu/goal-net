---
title: "ADR-0003 Core Sayı Temsili (fixed-point vs float)"
type: adr
status: proposed
date: 2026-08-07
---
## Bağlam
Saf JS float cross-platform bit-determinizmi garanti etmez; replay,
P2P doğrulama ve NumPy parity bit-özdeşlik ister.
## Karar (öneri — Faz 1.1'de kanıtla ve accepted yap)
Core matematiği fixed-point (Q16.16 tam sayı) yazılır. Kabul testi:
aynı input dizisi iki farklı cihaz/tarayıcıda bit-özdeş checksum.
Test başarısızsa alternatif (Math.fround disiplinli float) değerlendir.
## Sonuçlar
+ Bit-özdeş replay/parity; MARL portu güvenli.
− Tuning ve kod okunabilirliği maliyeti.
