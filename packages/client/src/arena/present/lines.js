// The commentary line catalogue (feature matrix #38).
//
// This table is the contract between three things that are otherwise strangers:
// the commentary bus (which picks a line id), the clip manifest (which maps an
// id + language to an audio file) and the human who will one day record them.
// Nothing here is generated at runtime: there is NO text-to-speech in the
// shipping client, by design (10-design/presentation.md), so every id below has
// to exist as a recorded file or it simply never plays.
//
// FIELDS
//   id          stable, ASCII, snake-case. Never renamed — it is the file name.
//   event       the presentation event that offers this line (see bus.js)
//   priority    0-100. Higher interrupts lower; see commentary.js
//   cooldownMs  this line cannot repeat inside this window
//   durationMs  how long the clip runs. Placeholder clips are generated at
//               exactly this length so timing bugs show up before the real
//               recording exists.
//   tension     [min, max] window of the tension scalar in which the line is
//               allowed, or null for "any". This is how the same event gets a
//               flat read at 0-0 in minute one and a shout in sudden death.
//   tr / en     the words. TR is the primary; EN is the same beat, not a
//               literal translation.
//
// Turkish is written the way a Turkish commentator actually speaks — short,
// present tense, no subordinate clauses — because a clause that runs past
// durationMs gets cut off mid-word in the mix.

/** @typedef {{id:string, event:string, priority:number, cooldownMs:number,
 *             durationMs:number, tension:[number,number]|null,
 *             tr:string, en:string}} CommentaryLine */

/** Every language the pipeline knows about. */
export const LANGUAGES = Object.freeze(['tr', 'en']);

/** @type {readonly CommentaryLine[]} */
export const LINES = Object.freeze([
  // ---------------------------------------------------------------- kickoff
  {
    id: 'kickoff_start',
    event: 'kickoff',
    priority: 30,
    cooldownMs: 20000,
    durationMs: 2600,
    tension: null,
    tr: 'Ve maç başlıyor! Orta sahada top.',
    en: 'And we are under way here.',
  },
  {
    id: 'kickoff_restart',
    event: 'restart',
    priority: 22,
    cooldownMs: 12000,
    durationMs: 1900,
    tension: null,
    tr: 'Oyun yeniden başlıyor.',
    en: 'They restart from the centre.',
  },

  // ------------------------------------------------------------------ goals
  {
    id: 'goal_plain',
    event: 'goal',
    priority: 100,
    cooldownMs: 9000,
    durationMs: 2800,
    tension: [0, 0.55],
    tr: 'GOOOL! Ağlarla buluşuyor!',
    en: 'GOAL! It is in the back of the net!',
  },
  {
    id: 'goal_hot',
    event: 'goal',
    priority: 100,
    cooldownMs: 9000,
    durationMs: 3400,
    tension: [0.55, 1],
    tr: 'GOOOOL! İnanılmaz! Stadyum ayakta!',
    en: 'GOOOAL! Unbelievable! The place is on its feet!',
  },
  {
    id: 'goal_equaliser',
    event: 'goal',
    priority: 100,
    cooldownMs: 9000,
    durationMs: 3000,
    tension: null,
    tr: 'Beraberlik golü! Her şey yeniden başlıyor!',
    en: 'The equaliser! We are level again!',
  },
  {
    id: 'goal_lead',
    event: 'goal',
    priority: 100,
    cooldownMs: 9000,
    durationMs: 2900,
    tension: null,
    tr: 'Öne geçiyorlar! Skoru çeviren gol!',
    en: 'They take the lead! What a turnaround!',
  },
  {
    id: 'goal_late',
    event: 'goal',
    priority: 100,
    cooldownMs: 9000,
    durationMs: 3300,
    tension: [0.6, 1],
    tr: 'Son saniyede gol! Bu maçı bitiren vuruş!',
    en: 'A goal at the death! That could be the game!',
  },
  {
    id: 'goal_own',
    event: 'own-goal',
    priority: 96,
    cooldownMs: 9000,
    durationMs: 2900,
    tension: null,
    tr: 'Kendi kalesine! Talihsiz bir an.',
    en: 'Into his own net! A dreadful moment.',
  },

  // ----------------------------------------------------------------- keeper
  {
    id: 'save_routine',
    event: 'save',
    priority: 60,
    cooldownMs: 5000,
    durationMs: 2000,
    tension: [0, 0.6],
    tr: 'Kaleci sorunsuz kontrol ediyor.',
    en: 'Comfortable for the keeper.',
  },
  {
    id: 'save_big',
    event: 'save',
    priority: 72,
    cooldownMs: 5000,
    durationMs: 2700,
    tension: null,
    tr: 'Muhteşem kurtarış! Nereden çıkardı!',
    en: 'What a save! Out of nowhere!',
  },
  {
    id: 'save_reflex',
    event: 'save',
    priority: 68,
    cooldownMs: 6000,
    durationMs: 2300,
    tension: [0.5, 1],
    tr: 'Refleks! Topu son anda çeliyor.',
    en: 'Reflexes! He gets a hand to it.',
  },
  {
    id: 'keeper_catch',
    event: 'catch',
    priority: 40,
    cooldownMs: 7000,
    durationMs: 1800,
    tension: [0, 0.7],
    tr: 'Eldivenlerinde kalıyor.',
    en: 'He gathers it cleanly.',
  },
  {
    id: 'keeper_whiff',
    event: 'keeper-error',
    priority: 74,
    cooldownMs: 8000,
    durationMs: 2400,
    tension: null,
    tr: 'Kaleci boşa çıktı! Kale tamamen açık!',
    en: 'The keeper has missed it! The goal is gaping!',
  },

  // -------------------------------------------------------------- woodwork
  {
    id: 'woodwork_post',
    event: 'woodwork',
    priority: 78,
    cooldownMs: 6000,
    durationMs: 2500,
    tension: null,
    tr: 'Direk! Santimle kaçırdı!',
    en: 'Off the post! Inches away!',
  },
  {
    id: 'woodwork_hot',
    event: 'woodwork',
    priority: 80,
    cooldownMs: 6000,
    durationMs: 2900,
    tension: [0.6, 1],
    tr: 'Direğe çarpıp çıkıyor! Kalp durduran an!',
    en: 'It smacks the woodwork! Hearts in mouths!',
  },

  // ------------------------------------------------------------ open play
  {
    id: 'near_miss',
    event: 'near-miss',
    priority: 55,
    cooldownMs: 6000,
    durationMs: 2200,
    tension: null,
    tr: 'Az farkla dışarı! Tehlikeli bir deneme.',
    en: 'Just wide! A dangerous effort.',
  },
  {
    id: 'counter_attack',
    event: 'counter-attack',
    priority: 52,
    cooldownMs: 7000,
    durationMs: 2400,
    tension: null,
    tr: 'Kontra atak! Alan sonuna kadar açık!',
    en: 'On the counter! Acres of space ahead!',
  },
  {
    id: 'counter_attack_hot',
    event: 'counter-attack',
    priority: 58,
    cooldownMs: 7000,
    durationMs: 2600,
    tension: [0.65, 1],
    tr: 'Hızlı geçiş! Bu pozisyon maçı bitirebilir!',
    en: 'Breaking at pace! This could settle it!',
  },
  {
    id: 'tackle_won',
    event: 'tackle',
    priority: 36,
    cooldownMs: 5000,
    durationMs: 1900,
    tension: null,
    tr: 'Temiz müdahale, topu kazandı.',
    en: 'A clean challenge, and he wins it.',
  },
  {
    id: 'tackle_hard',
    event: 'tackle',
    priority: 44,
    cooldownMs: 6000,
    durationMs: 2100,
    tension: [0.55, 1],
    tr: 'Sert mücadele! Kimse geri adım atmıyor.',
    en: 'A crunching challenge! Nobody is backing off.',
  },
  {
    id: 'dominance_red',
    event: 'dominance',
    priority: 26,
    cooldownMs: 25000,
    durationMs: 3000,
    tension: [0, 0.75],
    tr: 'Kırmızı takım oyunu tamamen eline aldı.',
    en: 'Red have taken a real grip on this game.',
  },
  {
    id: 'dominance_blue',
    event: 'dominance',
    priority: 26,
    cooldownMs: 25000,
    durationMs: 3000,
    tension: [0, 0.75],
    tr: 'Mavi takım sahanın her yerinde.',
    en: 'Blue are all over them right now.',
  },
  {
    id: 'pressure_build',
    event: 'pressure',
    priority: 28,
    cooldownMs: 18000,
    durationMs: 2700,
    tension: [0.5, 1],
    tr: 'Baskı artıyor, tribünler gerildi.',
    en: 'The pressure is building, and the crowd feels it.',
  },

  // ------------------------------------------------------------ match flow
  {
    id: 'half_time',
    event: 'half',
    priority: 84,
    cooldownMs: 60000,
    durationMs: 2600,
    tension: null,
    tr: 'İlk yarı sona erdi. Takımlar soyunma odasına.',
    en: 'That is the first half. They head down the tunnel.',
  },
  {
    id: 'second_half',
    event: 'half',
    priority: 84,
    cooldownMs: 60000,
    durationMs: 2400,
    tension: null,
    tr: 'İkinci yarı başlıyor, taraflar yer değiştirdi.',
    en: 'Back under way, and they have changed ends.',
  },
  {
    id: 'golden_goal',
    event: 'golden-goal',
    priority: 94,
    cooldownMs: 60000,
    durationMs: 3200,
    tension: null,
    tr: 'Altın gol! Bir sonraki gol maçı bitiriyor!',
    en: 'Golden goal! The next one wins it!',
  },
  {
    id: 'final_whistle_win',
    event: 'match-end',
    priority: 90,
    cooldownMs: 60000,
    durationMs: 3000,
    tension: null,
    tr: 'Bitti! Maçın kazananı belli oldu!',
    en: 'That is full time! We have our winner!',
  },
  {
    id: 'final_whistle_draw',
    event: 'match-end',
    priority: 90,
    cooldownMs: 60000,
    durationMs: 2800,
    tension: null,
    tr: 'Bitti! Kazanan çıkmadı, puanlar paylaşıldı.',
    en: 'Full time, and neither side could break the deadlock.',
  },
  {
    id: 'final_whistle_rout',
    event: 'match-end',
    priority: 90,
    cooldownMs: 60000,
    durationMs: 2900,
    tension: null,
    tr: 'Farklı bir skorla bitti. Tek taraflı bir maçtı.',
    en: 'It ends in a rout. That was one-way traffic.',
  },
]);

/** id -> line, built once. */
export const LINE_BY_ID = Object.freeze(
  Object.fromEntries(LINES.map((l) => [l.id, l])),
);

/** event -> lines, in table order (which is also the deterministic tie-break). */
export const LINES_BY_EVENT = (() => {
  const m = Object.create(null);
  for (const line of LINES) (m[line.event] ||= []).push(line);
  return Object.freeze(m);
})();

/** Every event id the catalogue can react to. */
export const LINE_EVENTS = Object.freeze(Object.keys(LINES_BY_EVENT).sort());

/**
 * Structural validation of the table. Run by scripts/present-test.mjs and by
 * the clip generator, so a malformed line can never reach a recording session.
 * @returns {string[]} problems, empty when the table is sound
 */
export function validateLines(lines = LINES) {
  const issues = [];
  const seen = new Set();
  for (const l of lines) {
    if (!l || typeof l.id !== 'string' || !/^[a-z0-9_]+$/.test(l.id)) {
      issues.push(`bad id: ${JSON.stringify(l && l.id)}`);
      continue;
    }
    if (seen.has(l.id)) issues.push(`duplicate id: ${l.id}`);
    seen.add(l.id);
    if (typeof l.event !== 'string' || !l.event) issues.push(`${l.id}: no event`);
    if (!(l.priority >= 0 && l.priority <= 100)) issues.push(`${l.id}: priority out of range`);
    if (!(l.cooldownMs >= 0)) issues.push(`${l.id}: bad cooldownMs`);
    if (!(l.durationMs >= 500 && l.durationMs <= 8000)) {
      issues.push(`${l.id}: durationMs ${l.durationMs} outside 500..8000`);
    }
    if (l.tension !== null) {
      const t = l.tension;
      if (!Array.isArray(t) || t.length !== 2 || !(t[0] >= 0) || !(t[1] <= 1) || !(t[0] < t[1])) {
        issues.push(`${l.id}: bad tension window`);
      }
    }
    for (const lang of LANGUAGES) {
      const text = l[lang];
      if (typeof text !== 'string' || text.trim().length < 4) {
        issues.push(`${l.id}: missing ${lang} text`);
      }
    }
  }
  return issues;
}
