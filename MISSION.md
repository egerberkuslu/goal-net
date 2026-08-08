# MISSION — Otonom Hedef Döngüsü

NİHAİ HEDEF: brain/00-index.md matrisindeki TÜM maddeler kendi kabul
kriterleriyle GEÇTİ olana ve MANUAL-TESTS.md kullanıcı için hazır olana
kadar DURMADAN çalış. "Yaklaşık çalışıyor" kabul değildir; kriter
sağlanana kadar hedef kapanmaz.

## Döngü
1. PROGRESS.md → mevcut faz ve sıradaki hedefi belirle
2. Faz sırası: K → 0 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 →
   1.7a → 1.7b → 1.7c → 1.7d → 2
   İstisna: 1.1+1.2+1.5+1.7a+1.7b GEÇTİ ise Faz 2 hazırlığı
   (NumPy port + parity) kozmetik fazlarla PARALEL başlayabilir.
3. Hedefi uygun agent'a delege et (görev tanımı + kabul kriteri ver)
4. Test kapısı işlet (CLAUDE.md protokolü)
5. GEÇTİ → matriste ☑, PROGRESS güncelle, git tag; sonraki hedef.
   KALDI ×3 → BLOKE + neden; sıradakine geç; her 3 hedefte bloklara dön.
6. İnsan gerektirenler (Mixamo indirme, OS onayı, gerçek ağ P2P testi,
   oynanış hissi, mobil cihaz testi) → HUMAN-QUEUE.md / MANUAL-TESTS.md;
   otomatik yapılabilir kısımla devam et, bekleme.
7. Tüm matris ☑ veya (BLOKE + insan-bekliyor) durumuna gelince:
   FINAL RAPOR yaz (ne bitti, ne bloke, kullanıcı ne yapmalı).

## Oturum sürekliliği
Context dolarsa veya oturum yenilenirse: CLAUDE.md otomatik yüklenir →
PROGRESS.md'den kaldığın yerden devam. Kalıcı hiçbir bilgi yalnızca
konuşmada bırakılmaz; her şey brain/ dosyalarına yazılır.

## Faz özetleri (detaylar brain/ notlarında)
- K: ortam kurulumu ve doğrulama (devops) → SETUP.md
- 0: mevcut oyunu envanterle + test + stabilize (refactor YOK)
  → git tag faz0-stable
- 1.1: monorepo (core/client/server) + host-authoritative netcode +
  determinizm testleri → brain/20-tech-spec/netcode-p2p.md
- 1.2: kilitli oynanış seti (dribbling/şarj/falso/tackle/kaleci) +
  modlar + lobi → brain/10-design/gameplay-core.md, goalkeeper.md
- 1.3: animasyon standardı → brain/20-tech-spec/animation-standard.md
- 1.4: asset + performans bütçeleri → brain/20-tech-spec/rendering-optimization.md
- 1.5: bot arayüzü soyutlama (observe→action; scripted ↔ ONNX aynı interface)
- 1.6: atmosfer (seyirci, top toplayıcı, cloth, forma) — kozmetik katman
- 1.7a: golden goal, mercy rule, saha preset'leri, oda ayarları
- 1.7b: replay + otomatik "en iyi anlar" → brain/20-tech-spec/replay-format.md
- 1.7c: rating (OpenSkill) + sezon + izleyici + klan + quick chat
  → brain/10-design/social-competitive.md
- 1.7d: anlatım, tansiyon, forma genişletme, stadyum varyantları,
  istatistik → brain/10-design/presentation.md
- 2: MARL (NumPy port + parity, MAPPO self-play, ONNX deploy)
  → brain/20-tech-spec/onnx-bots.md, brain/50-research/
