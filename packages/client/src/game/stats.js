import { PITCH_HALF_L } from '../core/constants.js';

// Match statistics, kept per team as [red, blue]. Everything is derived from
// the events the world already emits plus a cheap per-frame sample of the
// ball, so nothing in the simulation has to know that stats exist.
//
// Shots      — a kick that sends the ball goalward with real pace.
// On target  — that shot reaches the goal-line region inside the frame, or is
//              stopped by the keeper, or goes in.
// Saves      — a keeper is on the ball while it is travelling at his own goal
//              faster than SAVE_SPEED.
// Possession — seconds the ball spends with each side's last touch.
// Fouls      — reported by the game layer when a tackle is given against a team.

const SHOT_SPEED = 6;    // goalward pace a kick needs to count as a shot
const SAVE_SPEED = 8;    // goalward pace that makes a keeper touch a save
const SHOT_LIFE = 3.5;   // seconds a shot stays live for the on-target test
const SAVE_COOLDOWN = 1; // one keeper contact is one save, not twenty

const TEAM_NAMES = ['KIRMIZI', 'MAVİ'];

export class MatchStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.shots = [0, 0];
    this.onTarget = [0, 0];
    this.saves = [0, 0];
    this.possession = [0, 0]; // seconds
    this.fouls = [0, 0];
    this.pending = null;      // the shot currently in flight
    this.saveCool = 0;
  }

  foul(team) {
    if (team === 0 || team === 1) this.fouls[team]++;
  }

  // Called for every 'kick' event while the match is live.
  onKick(team, world) {
    if (team !== 0 && team !== 1) return;
    const sign = world.attackSign(team);
    const b = world.ball;
    // goalward pace, and the kick is not taken from behind the goal line
    if (b.vel.z * sign < SHOT_SPEED) return;
    if (Math.abs(b.pos.z) > PITCH_HALF_L) return;
    this.shots[team]++;
    this.pending = { team, life: 0, onTarget: false };
  }

  // Called when a goal is credited. Every goal is an attempt on target, so a
  // scramble or a deflection with no shot on the books books one now: the
  // table can never read fewer shots than goals.
  onGoal(team) {
    if (!this.markOnTarget(team)) {
      this.shots[team]++;
      this.onTarget[team]++;
    }
    this.pending = null;
  }

  // true when this team has a shot in flight that is (now, or already) on
  // target — so a second trigger for the same shot cannot count it twice.
  markOnTarget(team) {
    const p = this.pending;
    if (!p || p.team !== team) return false;
    if (!p.onTarget) {
      p.onTarget = true;
      this.onTarget[team]++;
    }
    return true;
  }

  // One sample per frame of live play.
  update(dt, world) {
    const b = world.ball;
    const t = b.lastTouch;
    if (t === 0 || t === 1) this.possession[t] += dt;

    if (this.pending) {
      const p = this.pending;
      p.life += dt;
      const sign = world.attackSign(p.team);
      const goalZ = sign * PITCH_HALF_L;
      const reached = (goalZ - b.pos.z) * sign < 1.2;
      const insideFrame = Math.abs(b.pos.x) < world.config.goalW / 2 + 0.2 &&
        b.pos.y < world.config.goalH + 0.2;
      if (b.vel.z * sign > 2 && reached && insideFrame) this.markOnTarget(p.team);
      if (p.life > SHOT_LIFE) this.pending = null;
    }

    this.saveCool = Math.max(0, this.saveCool - dt);
    if (this.saveCool > 0) return;
    for (const p of world.players) {
      if (p.role !== 'keeper') continue;
      const ownSign = -world.attackSign(p.team); // toward this keeper's goal
      if (b.vel.z * ownSign < SAVE_SPEED) continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (d > 1.3 || b.pos.y > 2.6) continue;
      this.saves[p.team]++;
      this.saveCool = SAVE_COOLDOWN;
      this.markOnTarget(1 - p.team); // the shot it stopped was on target
      break;
    }
  }

  // Possession as whole percentages that always add up to 100.
  possessionPct() {
    const total = this.possession[0] + this.possession[1];
    if (total <= 0) return [50, 50];
    const red = Math.round((this.possession[0] / total) * 100);
    return [red, 100 - red];
  }

  rows() {
    const pct = this.possessionPct();
    return [
      ['Şut', this.shots[0], this.shots[1]],
      ['İsabetli şut', this.onTarget[0], this.onTarget[1]],
      ['Kurtarış', this.saves[0], this.saves[1]],
      ['Topa sahip olma', `%${pct[0]}`, `%${pct[1]}`],
      ['Faul', this.fouls[0], this.fouls[1]],
    ];
  }

  // Draws (or redraws) the end-of-match table inside the #end overlay. Owns a
  // single container so repeated matches replace the panel instead of stacking.
  renderPanel(endEl) {
    if (!endEl || typeof document === 'undefined') return null;
    let box = this.panel;
    if (!box || box.parentNode !== endEl) {
      box = document.createElement('div');
      box.id = 'statsPanel';
      this.panel = box;
      // dark glass, same language as the lobby panels
      Object.assign(box.style, {
        margin: '4px 0 22px', padding: '14px 22px', borderRadius: '14px',
        background: 'rgba(8, 14, 30, .55)',
        border: '1px solid rgba(120, 150, 220, .18)',
        backdropFilter: 'blur(6px)', minWidth: '320px', color: '#fff',
      });
      // sits above the "Tekrar Oyna" button
      const again = endEl.querySelector('#btnAgain');
      endEl.insertBefore(box, again ?? null);
    }
    box.textContent = '';

    const table = document.createElement('table');
    Object.assign(table.style, {
      borderCollapse: 'collapse', width: '100%', fontSize: '15px',
    });
    const cell = (text, opts = {}) => {
      const td = document.createElement(opts.head ? 'th' : 'td');
      td.textContent = String(text);
      Object.assign(td.style, {
        padding: '7px 12px', textAlign: opts.align ?? 'center',
        color: opts.color ?? '#fff',
        fontWeight: opts.head || opts.align === 'left' ? '700' : '600',
        borderBottom: '1px solid rgba(120, 150, 220, .14)',
      });
      return td;
    };

    const head = document.createElement('tr');
    head.appendChild(cell('', { head: true }));
    head.appendChild(cell(TEAM_NAMES[0], { head: true, color: '#ff8a8a' }));
    head.appendChild(cell(TEAM_NAMES[1], { head: true, color: '#8aa8ff' }));
    table.appendChild(head);

    for (const [label, red, blue] of this.rows()) {
      const tr = document.createElement('tr');
      tr.appendChild(cell(label, { align: 'left', color: '#9fb0d8' }));
      tr.appendChild(cell(red));
      tr.appendChild(cell(blue));
      table.appendChild(tr);
    }
    box.appendChild(table);
    return box;
  }
}
