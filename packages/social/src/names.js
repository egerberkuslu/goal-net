// Clan tags and the name filter (feature matrix #36).
//
// The filter's whole difficulty is Turkish. A naive substring blocklist over a
// diacritic-stripped string blocks "şikayet" (complaint), "sikke" (coin),
// "Kasımpaşa" and "götürmek" (to take), which is worse than having no filter at
// all: players cannot type their own language. Three mechanisms fix that.
//
// 1. NORMALISE aggressively, because that is where evasion lives. NFKD folds
//    fullwidth forms and ligatures; combining marks are dropped; Cyrillic and
//    Greek lookalikes are mapped to their Latin twin; leetspeak digits and
//    symbols are folded; everything that is not a letter or a digit is deleted,
//    so "s.i.k" and "s i k" collapse the same way; runs of one repeated letter
//    collapse to a single letter, so "siiik" collapses too. Two variants come
//    out: `leet` (digits folded to the letters they imitate) and `strip`
//    (digits deleted outright), because "s1k" needs the first and "sik2" needs
//    the second.
//
// 2. TWO TIERS of blocklist term. A term of four characters or more is matched
//    as a SUBSTRING, because that is long enough to be unambiguous. A term of
//    three or fewer is matched only against a WHOLE token or the whole name,
//    because three letters are an ordinary Turkish syllable: "sik" must block
//    "S1K" and "s.i.k" while letting "şikayet", "psikoloji" and "eksik"
//    through, and no substring rule can do both.
//
// 3. FORGIVE BY SPAN on the substring tier. A hit is only a hit if it is not
//    inside an occurrence of an allowlisted word: "nazik" (polite) contains
//    "nazi" at [0,4), the allowlisted "nazik" occupies [0,5), the hit is
//    covered, the name passes. "nazixnazik" still fails, because the hit at
//    [0,4) lies outside the allowlisted span at [5,10). A plain word-boundary
//    check cannot do this, since normalisation has already eaten the
//    boundaries.
//
// Everything is pure and case-folded with Turkish rules: İ, I and ı are one
// letter here. `normaliseName` is exported so a test can show its work.

const MAX_NAME = 20;
const MIN_NAME = 2;
const DEFAULT_NAME = 'Oyuncu';
const TAG_MIN = 3;
const TAG_MAX = 5;
/** A clan tag may be changed once a week. */
export const TAG_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Terms at or below this length are matched as whole tokens, not substrings. */
export const SHORT_TERM_LEN = 3;

const CTRL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g;
const COMBINING = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u0610-\u061a\u064b-\u065f\u1ab0-\u1aff\u20d0-\u20f0\ufe20-\ufe2f]/g;

// Characters that render as a Latin letter in almost every font, plus a plain
// transliteration for the Cyrillic letters that do not (so an all-Cyrillic name
// still normalises to something instead of vanishing).
const HOMOGLYPHS = new Map(Object.entries({
  // Cyrillic visual twins
  а: 'a', в: 'b', с: 'c', е: 'e', н: 'h', к: 'k', м: 'm', о: 'o', р: 'p',
  ѕ: 's', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ԁ: 'd', ѵ: 'v', ғ: 'f',
  // Cyrillic transliteration
  б: 'b', г: 'g', д: 'd', ж: 'zh', з: 'z', и: 'i', й: 'y', л: 'l', п: 'n',
  ф: 'f', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu',
  я: 'ya', ь: '', ъ: '',
  // Greek
  α: 'a', β: 'b', γ: 'y', δ: 'd', ε: 'e', ζ: 'z', η: 'n', θ: 'o', ι: 'i',
  κ: 'k', λ: 'l', μ: 'm', ν: 'v', ξ: 'e', ο: 'o', π: 'n', ρ: 'p', σ: 's',
  ς: 's', τ: 't', υ: 'u', φ: 'o', χ: 'x', ψ: 'y', ω: 'w',
  // Latin extended and decorative
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ħ: 'h', ƒ: 'f', ß: 'ss', æ: 'ae', œ: 'oe',
  ð: 'd', þ: 'p', ŋ: 'n', ĸ: 'k',
}));

// Leetspeak. Applied after homoglyph folding, so a Cyrillic "р" is already a
// "p" before "|" becomes an "l".
const LEET = new Map(Object.entries({
  0: 'o', 1: 'i', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g',
  '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't', '(': 'c', '<': 'c', '¡': 'i',
  '£': 'l', '€': 'e', '¥': 'y', '%': 'o', '&': 'a', '*': 'a', '·': '',
}));

/**
 * Turkish-aware lowercase. `İ`, `I` and `ı` all fold to `i`, because the
 * matcher treats dotted and dotless i as one letter and a single target letter
 * keeps the blocklist half the size.
 */
export function foldCase(s) {
  return s.replace(/[İIı]/g, 'i').toLowerCase();
}

/** NFKD + marks + case + homoglyphs. Punctuation and digits still present. */
function foldBase(input) {
  if (typeof input !== 'string') return '';
  const nfkd = foldCase(input.normalize('NFKD').replace(COMBINING, ''));
  let out = '';
  for (const ch of nfkd) {
    const homo = HOMOGLYPHS.get(ch);
    out += homo === undefined ? ch : homo;
  }
  return foldCase(out);
}

function condense(base, { digits }) {
  const leeted = digits === 'leet'
    ? [...base].map((ch) => {
      const l = LEET.get(ch);
      return l === undefined ? ch : l;
    }).join('')
    : base.replace(/[0-9]/g, '');
  return leeted.replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
}

/**
 * The matching form of a name. NOT for display — it is lossy on purpose.
 *
 *   normaliseName('Ｓ.Ｉ.Ｋ')  === 'sik'
 *   normaliseName('şikayet')   === 'sikayet'
 *   normaliseName('5 1 K')     === 'sik'
 */
export function normaliseName(input) {
  return condense(foldBase(input), { digits: 'leet' });
}

/**
 * Both condensed variants plus the token list, which is what the short-term
 * tier matches against. Exported for the test, which prints them.
 */
export function normaliseForms(input) {
  const base = foldBase(input);
  const leet = condense(base, { digits: 'leet' });
  const strip = condense(base, { digits: 'strip' });
  const tokens = new Set();
  for (const raw of base.split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    const a = condense(raw, { digits: 'leet' });
    const b = condense(raw, { digits: 'strip' });
    if (a) tokens.add(a);
    if (b) tokens.add(b);
  }
  if (leet) tokens.add(leet);
  if (strip) tokens.add(strip);
  return { leet, strip, tokens: [...tokens] };
}

// The blocklist is written in ordinary Turkish and normalised at load, so every
// entry is guaranteed to be in the same alphabet the matcher works in. Note
// that normalisation collapses doubles: "yarrak" and "yarak" are one entry.
const RAW_BLOCKLIST = [
  // TR
  'sik', 'amk', 'aq', 'oç', 'piç', 'göt', 'orospu', 'yarrak', 'siktir',
  'gavat', 'ibne', 'sürtük', 'kahpe', 'amcık', 'pezevenk', 'yavşak',
  // EN
  'fuck', 'shit', 'cunt', 'bitch', 'dick', 'whore', 'nigger', 'faggot',
  'rape', 'nazi', 'hitler',
];

const ALL_TERMS = [...new Set(RAW_BLOCKLIST.map(normaliseName))].filter(Boolean).sort();

/** Terms matched as substrings (4+ characters). */
export const BLOCKLIST_LONG = Object.freeze(ALL_TERMS.filter((t) => t.length > SHORT_TERM_LEN));
/** Terms matched only against a whole token or the whole name (<= 3 characters). */
export const BLOCKLIST_SHORT = Object.freeze(ALL_TERMS.filter((t) => t.length <= SHORT_TERM_LEN));
export const BLOCKLIST = Object.freeze(ALL_TERMS);

// Legitimate words whose normalised form contains a LONG blocklist term. Short
// terms need no allowlist: the whole-token rule already lets ordinary words
// through. Add here whenever a false positive is reported; never soften the
// blocklist instead.
const RAW_ALLOWLIST = [
  // "nazi" inside
  'nazik', 'nazikçe', 'nazir', 'nazilli', 'nazire',
  // "rape" inside
  'grape', 'grapes', 'drape', 'scrape', 'trapez', 'rapor', 'raporcu',
  // "dick" inside
  'dickens', 'dicki',
  // "shit" / "shid" inside
  'shitake', 'ashite',
  // "cunt" / "scunthorpe" class
  'scunthorpe', 'viscount',
  // "niger" (what "nigger" collapses to) inside a place name. The bare country
  // name is NOT allowlisted: allowlisting it would let the slur through, since
  // the two normalise to the same six letters. That is a known, accepted false
  // positive, and the only one in this table.
  'nigeria', 'nijerya', 'nigerya',
  // "fagot" (the collapse of faggot) is also the bassoon in Turkish, but a name
  // is not an orchestra, so it stays blocked; nothing is allowlisted for it.
  // general Turkish vocabulary that brushes the long terms
  'analiz', 'analist', 'asistan', 'klasik', 'psikoloji', 'psikolog',
];

export const ALLOWLIST = Object.freeze(
  [...new Set(RAW_ALLOWLIST.map(normaliseName))].filter(Boolean).sort(),
);

/** Every [start, end) span of `haystack` covered by an allowlisted word. */
function allowedSpans(haystack) {
  const spans = [];
  for (const word of ALLOWLIST) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(word, from);
      if (at < 0) break;
      spans.push([at, at + word.length]);
      from = at + 1;
    }
  }
  return spans;
}

const covered = (spans, start, end) => spans.some(([a, b]) => a <= start && b >= end);

function longHit(haystack) {
  if (!haystack) return null;
  const spans = allowedSpans(haystack);
  for (const term of BLOCKLIST_LONG) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(term, from);
      if (at < 0) break;
      if (!covered(spans, at, at + term.length)) return term;
      from = at + 1;
    }
  }
  return null;
}

/**
 * Which blocklist term a name trips on, or null. Exported so a test can report
 * the exact term rather than "it failed".
 */
export function blockedTerm(name) {
  const forms = normaliseForms(name);
  const short = new Set(BLOCKLIST_SHORT);
  for (const token of forms.tokens) if (short.has(token)) return token;
  return longHit(forms.leet) || longHit(forms.strip);
}

/**
 * Display-safe cleanup: control characters out, angle brackets out (so the text
 * can never read as markup even if a renderer forgets textContent), whitespace
 * collapsed, length capped. Same discipline as src/mp/protocol.js sanitizeName,
 * reimplemented here so @goalnet/social stays dependency-free.
 */
export function sanitiseName(name) {
  if (typeof name !== 'string') return DEFAULT_NAME;
  const clean = name
    .replace(CTRL_CHARS, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, MAX_NAME).trim() || DEFAULT_NAME;
}

/**
 * isAllowedName(name) -> { ok, reason, term, display, normalised }
 *
 * Reasons: 'empty', 'too-short', 'too-long', 'no-letters', 'blocked'.
 */
export function isAllowedName(name) {
  const display = sanitiseName(name);
  const normalised = normaliseName(display);
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, reason: 'empty', term: null, display, normalised };
  }
  if (name.trim().length > MAX_NAME) {
    return { ok: false, reason: 'too-long', term: null, display, normalised };
  }
  if (display.length < MIN_NAME) {
    return { ok: false, reason: 'too-short', term: null, display, normalised };
  }
  if (!normalised) return { ok: false, reason: 'no-letters', term: null, display, normalised };
  const term = blockedTerm(display);
  if (term) return { ok: false, reason: 'blocked', term, display, normalised };
  return { ok: true, reason: null, term: null, display, normalised };
}

/** Turkish-aware uppercase for tags: i -> İ, ı -> I. */
function upperTr(s) {
  return s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

/**
 * A clan tag: 3-5 characters, letters and digits only (Turkish letters
 * welcome), shown uppercased, and run through the same filter as a name.
 * Returns { ok, reason, tag }.
 */
export function isAllowedTag(tag) {
  if (typeof tag !== 'string') return { ok: false, reason: 'empty', tag: '', term: null };
  const trimmed = tag.replace(CTRL_CHARS, '').trim();
  if (!trimmed) return { ok: false, reason: 'empty', tag: '', term: null };
  if (!/^[A-Za-zÇĞİÖŞÜçğıöşü0-9]+$/.test(trimmed)) {
    return { ok: false, reason: 'charset', tag: '', term: null };
  }
  if (trimmed.length < TAG_MIN) return { ok: false, reason: 'too-short', tag: '', term: null };
  if (trimmed.length > TAG_MAX) return { ok: false, reason: 'too-long', tag: '', term: null };
  const term = blockedTerm(trimmed);
  if (term) return { ok: false, reason: 'blocked', tag: '', term };
  return { ok: true, reason: null, tag: upperTr(trimmed), term: null };
}

/** `[TAG] Name`, or just `Name` when there is no usable tag. Never throws. */
export function formatDisplayName(profile = {}) {
  const name = sanitiseName(profile && profile.name);
  const tag = isAllowedTag(profile && profile.tag);
  return tag.ok ? `[${tag.tag}] ${name}` : name;
}

/**
 * Tag change cooldown. `lastChangedAt` of null means "never changed".
 * Pure: `now` is an argument.
 */
export function canChangeTag(lastChangedAt, now, cooldownMs = TAG_COOLDOWN_MS) {
  if (!Number.isFinite(lastChangedAt)) return { ok: true, waitMs: 0 };
  const waitMs = Math.max(0, lastChangedAt + cooldownMs - now);
  return waitMs > 0 ? { ok: false, waitMs } : { ok: true, waitMs: 0 };
}

export const NAME_LIMITS = Object.freeze({ MIN_NAME, MAX_NAME, TAG_MIN, TAG_MAX, DEFAULT_NAME });
