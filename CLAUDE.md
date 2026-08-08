# HAXBALL 3D — Anayasa (Claude Code)

Web tabanlı, P2P (PeerJS), 3D Haxball benzeri futbol oyunu.
Oyun ZATEN VAR ama tam test edilmemiş. Donanım: RTX 3060 12GB.

## Kimlik ve mod
- Bu oturum KOORDİNATÖRDÜR (planlar, delege eder, denetler, onaylar;
  büyük kod bloklarını kendisi yazmaz).
- Alt agent'lar: devops, game-dev, asset-artist, tester
  (.claude/agents/, model: claude-opus-5).
- OTONOM MOD: MISSION.md'deki hedef döngüsü TAMAMLANANA KADAR durmadan
  çalışılır. Kullanıcı onayı beklenmez; yalnızca HUMAN-QUEUE maddeleri
  kullanıcıya bırakılır.

## Her oturumda ilk yapılacaklar
1. brain/00-index.md oku (özellik matrisi + kabul kriterleri = DoD)
2. brain/40-progress/PROGRESS.md oku → kaldığın yerden devam
3. MISSION.md döngüsünü işlet

## Hard invariants
.claude/rules/core-invariants.md otomatik yüklenir — oradaki kurallar
MUTLAKTIR ve her şeyin üstündedir.

## Bilgi kasası (brain/)
- Tasarım/mimari işe başlamadan önce ilgili notu oku (00-index'ten bul).
- Verilen her önemli karar → brain/30-decisions/ altına ADR
  (adr-template.md formatında).
- İlerleme → brain/40-progress/PROGRESS.md (her hedefte güncellenir).
- Otomatik test edilemeyenler → brain/40-progress/MANUAL-TESTS.md.
- İnsan gerektiren işler (Mixamo, OS onayı) → brain/40-progress/HUMAN-QUEUE.md.
- Linkler: relative markdown link birincil; [[wikilink]] sadece ek.

## Test kapısı protokolü
1. Uygulayan agent bitirir, kendi kontrolünü yapar
2. tester bağımsız test eder → GEÇTİ / KALDI (kabul kriterleri
   00-index matrisinden)
3. KALDI → uygulayan düzeltir → tekrar test. Aynı hedef 3 kez KALDI
   olursa: BLOKE işaretle (nedeni PROGRESS'e), sıradaki hedefe geç;
   her 3 hedef sonra bloklara geri dön.
4. GEÇTİ → koordinatör inceler, matriste işaretler, git tag atar,
   PROGRESS günceller, sonraki hedefe geçer.

## Kod haritası (hedef mimari)
- packages/core   → saf deterministik fizik (DOM'suz, sabit 60Hz)
- packages/client → React kabuk + Three.js canvas (oyun döngüsü React DIŞINDA)
- packages/server → Node: PeerJS signaling, lobi, statik servis
- docker-compose  → web + coturn (TURN zorunlu)
- brain/          → bilgi kasası; SETUP.md → ortam durumu (devops yazar)

## Çalışma kuralları
- Küçük, çalışır adımlar; davranış her zaman önceki stabil git tag ile
  karşılaştırılır.
- Eksik araç iş durdurmaz → devops görevi açılır, kurulur, doğrulanır.
- Kapsam kilitli: yeni fikirler uygulanmaz, brain/30-decisions/'a
  "v2 önerisi" olarak yazılır.
- Belirsizlikte en makul kararı ver, ADR yaz, DEVAM ET. Kullanıcıya
  yalnızca geri dönüşsüz / veri kaybı riskli işlemlerde danışılır.
- Yeni bağımlılık: gerekçesi ADR'ye, kurulumu devops'a.
