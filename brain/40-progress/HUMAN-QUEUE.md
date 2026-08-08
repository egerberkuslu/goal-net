# HUMAN-QUEUE — İnsan gerektiren işler (agent bekletmez, buraya yazar)

- [ ] Mixamo animasyon paketi indirme (Adobe hesabı gerekir) —
      asset-artist liste verecek, indirilen dosya yolları buraya yazılacak
- [ ] Blender kurulumu (Faz 1.3/1.4 asset işleri için): `sudo apt install blender`
      veya `sudo snap install blender --classic` — sudo gerektirdiği için devops
      kuramadı. Kurulunca `blender --version` çıktısını buraya not düş.

## Maç anlatımı kliplerinin kaydı (matris #38, Faz 1.7d)

**Durum:** hat çalışıyor, ses yok. `packages/client/src/arena/present/`
altındaki anlatım hattı uçtan uca kurulu ve test edildi; eksik olan tek
şey gerçek kayıt. Bugün her replik için doğru süreye sahip **placeholder**
klipler üretiliyor (`npm run present:clips`) — bunlar ses değil, zamanlama
iskeletidir ve repoya girmez.

### İnsanın yapacağı iş

1. Aşağıdaki 58 satırı (29 replik × TR + EN) kaydet.
   - **Süre sütunu tavsiyedir, tavandır**: klip o süreyi aşarsa yönetmen
     onu bir sonraki repliğin ortasında keser. Kısa olması sorun değil.
   - Ton: TR spiker Türkçesi — kısa, şimdiki zaman, yan cümle yok.
     EN aynı ritmin karşılığı, birebir çeviri değil.
   - `_hot` ile biten repliklerin coşkulu, `routine`/`plain` olanların
     düz okunması gerekir; ikisi tansiyon değerine göre seçilir.
2. Dosya adları **birebir** aşağıdaki gibi olmalı, uzantı **`.opus`**
   (veya `.mp3`). Manifest bu uzantıları `.wav` placeholder'ından önce
   arar, yani dosyaları klasöre atmak yeterli — kod değişmez.
   Hedef klasör: `packages/client/src/arena/present/clips/`
3. Kayıt ayarları: mono, 48 kHz, −16 LUFS civarı, sessizlik kırpılmış,
   baş/son 30 ms fade. Klip **başında sessizlik bırakma** — yönetmen
   zamanlamayı dosya süresinden okur.
4. Bittiğinde `npm run test:present` çalıştır: manifest doğrulaması ve
   süre kontrolü gerçek dosyalar üzerinde de aynı testtir.

### Lisans notu (karar gerektirir)

10-design/presentation.md'nin uyardığı gibi: sentetik ses kullanılacaksa
**XTTS-v2 Türkçe'de en iyi ama NON-COMMERCIAL**, Piper fork'u GPL-3.0 ve
daha robotik, ElevenLabs ticari. Yayın öncesi lisans kararı insanın.
Hat runtime TTS kullanmıyor ve kullanmayacak; bu karar yalnız kliplerin
nasıl üretileceğiyle ilgili.

### Replik listesi

| dosya | dil | sn | olay | metin |
|---|---|---|---|---|
| `kickoff_start.tr.wav` | tr | 2.6 | kickoff | Ve maç başlıyor! Orta sahada top. |
| `kickoff_start.en.wav` | en | 2.6 | kickoff | And we are under way here. |
| `kickoff_restart.tr.wav` | tr | 1.9 | restart | Oyun yeniden başlıyor. |
| `kickoff_restart.en.wav` | en | 1.9 | restart | They restart from the centre. |
| `goal_plain.tr.wav` | tr | 2.8 | goal | GOOOL! Ağlarla buluşuyor! |
| `goal_plain.en.wav` | en | 2.8 | goal | GOAL! It is in the back of the net! |
| `goal_hot.tr.wav` | tr | 3.4 | goal | GOOOOL! İnanılmaz! Stadyum ayakta! |
| `goal_hot.en.wav` | en | 3.4 | goal | GOOOAL! Unbelievable! The place is on its feet! |
| `goal_equaliser.tr.wav` | tr | 3.0 | goal | Beraberlik golü! Her şey yeniden başlıyor! |
| `goal_equaliser.en.wav` | en | 3.0 | goal | The equaliser! We are level again! |
| `goal_lead.tr.wav` | tr | 2.9 | goal | Öne geçiyorlar! Skoru çeviren gol! |
| `goal_lead.en.wav` | en | 2.9 | goal | They take the lead! What a turnaround! |
| `goal_late.tr.wav` | tr | 3.3 | goal | Son saniyede gol! Bu maçı bitiren vuruş! |
| `goal_late.en.wav` | en | 3.3 | goal | A goal at the death! That could be the game! |
| `goal_own.tr.wav` | tr | 2.9 | own-goal | Kendi kalesine! Talihsiz bir an. |
| `goal_own.en.wav` | en | 2.9 | own-goal | Into his own net! A dreadful moment. |
| `save_routine.tr.wav` | tr | 2.0 | save | Kaleci sorunsuz kontrol ediyor. |
| `save_routine.en.wav` | en | 2.0 | save | Comfortable for the keeper. |
| `save_big.tr.wav` | tr | 2.7 | save | Muhteşem kurtarış! Nereden çıkardı! |
| `save_big.en.wav` | en | 2.7 | save | What a save! Out of nowhere! |
| `save_reflex.tr.wav` | tr | 2.3 | save | Refleks! Topu son anda çeliyor. |
| `save_reflex.en.wav` | en | 2.3 | save | Reflexes! He gets a hand to it. |
| `keeper_catch.tr.wav` | tr | 1.8 | catch | Eldivenlerinde kalıyor. |
| `keeper_catch.en.wav` | en | 1.8 | catch | He gathers it cleanly. |
| `keeper_whiff.tr.wav` | tr | 2.4 | keeper-error | Kaleci boşa çıktı! Kale tamamen açık! |
| `keeper_whiff.en.wav` | en | 2.4 | keeper-error | The keeper has missed it! The goal is gaping! |
| `woodwork_post.tr.wav` | tr | 2.5 | woodwork | Direk! Santimle kaçırdı! |
| `woodwork_post.en.wav` | en | 2.5 | woodwork | Off the post! Inches away! |
| `woodwork_hot.tr.wav` | tr | 2.9 | woodwork | Direğe çarpıp çıkıyor! Kalp durduran an! |
| `woodwork_hot.en.wav` | en | 2.9 | woodwork | It smacks the woodwork! Hearts in mouths! |
| `near_miss.tr.wav` | tr | 2.2 | near-miss | Az farkla dışarı! Tehlikeli bir deneme. |
| `near_miss.en.wav` | en | 2.2 | near-miss | Just wide! A dangerous effort. |
| `counter_attack.tr.wav` | tr | 2.4 | counter-attack | Kontra atak! Alan sonuna kadar açık! |
| `counter_attack.en.wav` | en | 2.4 | counter-attack | On the counter! Acres of space ahead! |
| `counter_attack_hot.tr.wav` | tr | 2.6 | counter-attack | Hızlı geçiş! Bu pozisyon maçı bitirebilir! |
| `counter_attack_hot.en.wav` | en | 2.6 | counter-attack | Breaking at pace! This could settle it! |
| `tackle_won.tr.wav` | tr | 1.9 | tackle | Temiz müdahale, topu kazandı. |
| `tackle_won.en.wav` | en | 1.9 | tackle | A clean challenge, and he wins it. |
| `tackle_hard.tr.wav` | tr | 2.1 | tackle | Sert mücadele! Kimse geri adım atmıyor. |
| `tackle_hard.en.wav` | en | 2.1 | tackle | A crunching challenge! Nobody is backing off. |
| `dominance_red.tr.wav` | tr | 3.0 | dominance | Kırmızı takım oyunu tamamen eline aldı. |
| `dominance_red.en.wav` | en | 3.0 | dominance | Red have taken a real grip on this game. |
| `dominance_blue.tr.wav` | tr | 3.0 | dominance | Mavi takım sahanın her yerinde. |
| `dominance_blue.en.wav` | en | 3.0 | dominance | Blue are all over them right now. |
| `pressure_build.tr.wav` | tr | 2.7 | pressure | Baskı artıyor, tribünler gerildi. |
| `pressure_build.en.wav` | en | 2.7 | pressure | The pressure is building, and the crowd feels it. |
| `half_time.tr.wav` | tr | 2.6 | half | İlk yarı sona erdi. Takımlar soyunma odasına. |
| `half_time.en.wav` | en | 2.6 | half | That is the first half. They head down the tunnel. |
| `second_half.tr.wav` | tr | 2.4 | half | İkinci yarı başlıyor, taraflar yer değiştirdi. |
| `second_half.en.wav` | en | 2.4 | half | Back under way, and they have changed ends. |
| `golden_goal.tr.wav` | tr | 3.2 | golden-goal | Altın gol! Bir sonraki gol maçı bitiriyor! |
| `golden_goal.en.wav` | en | 3.2 | golden-goal | Golden goal! The next one wins it! |
| `final_whistle_win.tr.wav` | tr | 3.0 | match-end | Bitti! Maçın kazananı belli oldu! |
| `final_whistle_win.en.wav` | en | 3.0 | match-end | That is full time! We have our winner! |
| `final_whistle_draw.tr.wav` | tr | 2.8 | match-end | Bitti! Kazanan çıkmadı, puanlar paylaşıldı. |
| `final_whistle_draw.en.wav` | en | 2.8 | match-end | Full time, and neither side could break the deadlock. |
| `final_whistle_rout.tr.wav` | tr | 2.9 | match-end | Farklı bir skorla bitti. Tek taraflı bir maçtı. |
| `final_whistle_rout.en.wav` | en | 2.9 | match-end | It ends in a rout. That was one-way traffic. |
