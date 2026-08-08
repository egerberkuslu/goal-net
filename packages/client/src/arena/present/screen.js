// The end-of-match screen (feature matrix #41).
//
// Draws the summary createMatchRecorder().summary() produced into whatever
// element it is given — the arena's #arenaEnd overlay in practice. It owns one
// container and replaces its contents, so a second match does not stack a
// second table under the first.
//
// Visual language is copied from the arena's existing overlays (dark glass,
// #9fb0d8 labels, red/blue team columns) rather than invented, so the screen
// looks like part of the game and not like a debug dump.
//
// Every number on it is explained on the screen itself: the xG column carries
// the model's name and the MVP row prints the weights it used. A score nobody
// can audit is a score nobody trusts.

import { MVP_WEIGHTS } from './stats.js';
import { COEFF } from './xg.js';

const TEAM_NAMES = ['KIRMIZI', 'MAVİ'];
const TEAM_COLOURS = ['#ff8a8a', '#8aa8ff'];

const ROWS = [
  ['Şut', (t) => t.shots],
  ['İsabetli şut', (t) => t.onTarget],
  ['xG (lite)', (t) => t.xg.toFixed(2)],
  ['Kurtarış', (t) => t.saves],
  ['Top kazanma', (t) => t.tacklesWon],
  ['Pas', (t) => t.passes],
  ['Topa sahip olma', (t) => `%${t.possessionPct}`],
];

function el(tag, style, text) {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style);
  if (text != null) node.textContent = String(text);
  return node;
}

/**
 * @param {HTMLElement} host where the panel is inserted
 * @param {{before?:HTMLElement|null, id?:string}} options
 */
export function createStatsScreen(host, options = {}) {
  let box = null;

  function ensure() {
    if (box && box.parentNode === host) return box;
    box = el('div', {
      margin: '4px 0 18px',
      padding: '16px 22px',
      borderRadius: '14px',
      background: 'rgba(8, 14, 30, .55)',
      border: '1px solid rgba(120, 150, 220, .18)',
      backdropFilter: 'blur(6px)',
      minWidth: '340px',
      maxWidth: '640px',
      color: '#fff',
      textAlign: 'left',
    });
    box.id = options.id || 'arenaStatsPanel';
    host.insertBefore(box, options.before || null);
    return box;
  }

  function cell(text, opts = {}) {
    const td = el(opts.head ? 'th' : 'td', {
      padding: '6px 12px',
      textAlign: opts.align || 'center',
      color: opts.color || '#fff',
      fontWeight: opts.head || opts.align === 'left' ? '700' : '600',
      borderBottom: '1px solid rgba(120, 150, 220, .14)',
      fontSize: opts.small ? '13px' : '15px',
      whiteSpace: 'nowrap',
    }, text);
    return td;
  }

  return {
    get element() { return box; },

    /**
     * @param {object} summary createMatchRecorder().summary()
     * @param {{fouls?:boolean, rating?:object|null, title?:string}} extra
     */
    render(summary, extra = {}) {
      if (typeof document === 'undefined' || !host) return null;
      const panel = ensure();
      panel.textContent = '';

      const table = el('table', { borderCollapse: 'collapse', width: '100%' });
      const head = el('tr');
      head.appendChild(cell('', { head: true }));
      for (const t of [0, 1]) {
        head.appendChild(cell(TEAM_NAMES[t], { head: true, color: TEAM_COLOURS[t] }));
      }
      table.appendChild(head);

      const rows = extra.fouls ? [...ROWS, ['Faul', (t) => t.fouls]] : ROWS;
      for (const [label, read] of rows) {
        const tr = el('tr');
        tr.appendChild(cell(label, { align: 'left', color: '#9fb0d8' }));
        tr.appendChild(cell(read(summary.teams[0])));
        tr.appendChild(cell(read(summary.teams[1])));
        table.appendChild(tr);
      }
      panel.appendChild(table);

      // ------------------------------------------------------------- MVP
      const mvp = summary.mvp;
      const mvpBox = el('div', {
        marginTop: '14px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'rgba(60, 90, 180, .18)',
        border: '1px solid rgba(120, 150, 220, .22)',
      });
      if (mvp) {
        mvpBox.appendChild(el('div', {
          fontSize: '12px', letterSpacing: '2px', color: '#9fb0d8', fontWeight: '700',
        }, 'MAÇIN OYUNCUSU'));
        mvpBox.appendChild(el('div', {
          fontSize: '22px', fontWeight: '800', margin: '2px 0 4px',
          color: TEAM_COLOURS[mvp.team],
        }, `${mvp.name} — ${mvp.mvp.toFixed(2)}`));
        mvpBox.appendChild(el('div', { fontSize: '13px', color: '#cfd8ff' },
          `${mvp.goals} gol · ${mvp.assists} asist · ${mvp.saves} kurtarış · `
          + `${mvp.tacklesWon} top kazanma · xG ${mvp.xg.toFixed(2)} · ${mvp.passes} pas`));
        mvpBox.appendChild(el('div', {
          fontSize: '11px', color: '#7f8ec0', marginTop: '6px', lineHeight: '1.5',
        }, formulaText()));
      } else {
        mvpBox.appendChild(el('div', { fontSize: '13px', color: '#9fb0d8' },
          'Kimse istatistik üretmedi — maçın oyuncusu seçilmedi.'));
      }
      panel.appendChild(mvpBox);

      // ------------------------------------------------- top three players
      const top = summary.players.filter((p) => p.mvp > 0).slice(0, 3);
      if (top.length > 1) {
        const list = el('table', {
          borderCollapse: 'collapse', width: '100%', marginTop: '10px',
        });
        for (const p of top) {
          const tr = el('tr');
          tr.appendChild(cell(p.name, { align: 'left', color: TEAM_COLOURS[p.team], small: true }));
          tr.appendChild(cell(`${p.goals}G ${p.assists}A`, { small: true, color: '#9fb0d8' }));
          tr.appendChild(cell(`xG ${p.xg.toFixed(2)}`, { small: true, color: '#9fb0d8' }));
          tr.appendChild(cell(p.mvp.toFixed(2), { small: true }));
          list.appendChild(tr);
        }
        panel.appendChild(list);
      }

      // -------------------------------------------------- rating (#33/#34)
      if (extra.rating) {
        const r = extra.rating;
        panel.appendChild(el('div', {
          marginTop: '10px', fontSize: '13px', color: '#9fb0d8',
        }, `Puan: ${r.display ?? '—'}${r.tier ? ` · ${r.tier}` : ''}`
          + `${r.delta != null ? ` (${r.delta >= 0 ? '+' : ''}${r.delta})` : ''}`));
      }

      panel.appendChild(el('div', {
        marginTop: '10px', fontSize: '11px', color: '#63709c', lineHeight: '1.5',
      }, xgText()));

      return panel;
    },

    clear() {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      box = null;
    },
  };
}

/** The MVP formula, printed so the number can be checked by hand. */
export function formulaText(w = MVP_WEIGHTS) {
  return `MVP = ${w.goals}×gol ${sign(w.assists)}×asist ${sign(w.saves)}×kurtarış `
    + `${sign(w.xg)}×xG ${sign(w.tacklesWon)}×top kazanma ${sign(w.onTarget)}×isabet `
    + `${sign(w.passes)}×pas ${sign(w.fouls)}×faul ${sign(w.ownGoals)}×kendi kalesine`;
}

/** The xG model, one line. */
export function xgText(c = COEFF) {
  return `xG-lite = lojistik(${c.intercept} ${sign(c.dist)}×mesafe `
    + `${sign(c.angle)}×kale açısı ${sign(c.press)}×baskı `
    + `${sign(c.cover)}×kaleci kapama ${sign(c.power)}×şut gücü)`;
}

const sign = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v)}`;
