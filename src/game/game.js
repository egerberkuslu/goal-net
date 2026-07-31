import { GOAL_W, GOAL_H, BALL_R } from '../core/constants.js';
import { DragInput, shotFromParams } from './input.js';

const HALF_W = GOAL_W / 2;

export class Game {
  constructor(world, camera, trajectory, dom) {
    this.world = world;
    this.camera = camera;
    this.trajectory = trajectory;
    this.dom = dom; // { score, msg, btnPenalty, btnFreekick, canvas }
    this.mode = 'penalty';
    this.goals = 0;
    this.shots = 0;
    this.state = 'ready'; // ready | flying | done
    this.timeScale = 1;
    this.slowUntil = 0;
    this.resetAt = 0;
    this.flightTime = 0;
    this.prevZ = 0;
    this.msgTimer = null;

    this.input = new DragInput(dom.canvas, {
      isReady: () => this.state === 'ready',
      onDrag: (p) => {
        if (!p || this.state !== 'ready') { this.trajectory.hide(); return; }
        const { vel, omega } = shotFromParams(p, world.ball.pos);
        this.trajectory.show(world.ball.pos, vel, omega);
      },
      onRelease: (p) => {
        this.trajectory.hide();
        if (this.state !== 'ready') return;
        const { vel, omega } = shotFromParams(p, world.ball.pos);
        world.shoot(vel, omega);
        this.state = 'flying';
        this.flightTime = 0;
        this.prevZ = world.ball.pos.z;
        this.shots++;
        this.updateScore();
      },
    });

    dom.btnPenalty.addEventListener('click', () => this.setMode('penalty'));
    dom.btnFreekick.addEventListener('click', () => this.setMode('freekick'));
    this.placeBall();
  }

  setMode(mode) {
    this.mode = mode;
    this.dom.btnPenalty.classList.toggle('active', mode === 'penalty');
    this.dom.btnFreekick.classList.toggle('active', mode === 'freekick');
    this.placeBall();
  }

  placeBall() {
    let x = 0, z = 11;
    if (this.mode === 'freekick') {
      x = (Math.random() * 2 - 1) * 9;
      z = 14 + Math.random() * 8;
    }
    this.world.placeBall(x, z);
    this.state = 'ready';
    this.timeScale = 1;
    this.positionCamera();
  }

  positionCamera() {
    const b = this.world.ball.pos;
    const dx = 0 - b.x, dz = 0 - b.z;
    const len = Math.hypot(dx, dz) || 1;
    this.camera.position.set(b.x - (dx / len) * 4.4, 1.9, b.z - (dz / len) * 4.4);
    this.lookTarget = { x: b.x * 0.35, y: 1.35, z: 0 };
    this.camera.lookAt(this.lookTarget.x, this.lookTarget.y, this.lookTarget.z);
  }

  showMessage(text, cls) {
    const m = this.dom.msg;
    m.textContent = text;
    m.className = `hud show ${cls}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { m.className = 'hud'; }, 1600);
  }

  updateScore() {
    this.dom.score.innerHTML = `Gol <b>${this.goals}</b> / Şut ${this.shots}`;
  }

  finish(scored, now) {
    if (this.state !== 'flying') return;
    this.state = 'done';
    if (scored) {
      this.goals++;
      this.updateScore();
      this.showMessage('GOOOL!', 'gol');
      this.timeScale = 0.3;
      this.slowUntil = now + 1.4;
      this.resetAt = now + 2.8;
    } else {
      this.showMessage('Kaçtı!', 'kacti');
      this.resetAt = now + 1.6;
    }
  }

  update(dt, now) {
    if (this.state === 'flying') {
      this.flightTime += dt;
      const b = this.world.ball.pos;

      for (const e of this.world.drainEvents()) {
        if (e.type === 'post') this.showMessage('Direk!', 'direk');
        if (e.type === 'crossbar') this.showMessage('Üst direk!', 'direk');
      }

      // goal: centre crossed the line inside the frame
      if (this.prevZ > 0 && b.z <= 0) {
        const t = this.prevZ / (this.prevZ - b.z);
        const xc = b.x, yc = b.y; // dt is small; crossing interp barely matters
        if (Math.abs(xc) < HALF_W - BALL_R * 0.2 && yc < GOAL_H - BALL_R * 0.2 && t >= 0) {
          this.finish(true, now);
        }
      }
      this.prevZ = b.z;

      const speed = this.world.ball.speed();
      const missed = b.z < -2.6 || Math.abs(b.x) > 26 || b.z > 34 ||
        (this.flightTime > 1 && speed < 0.35) || this.flightTime > 8;
      if (this.state === 'flying' && missed) this.finish(false, now);

      // camera gently tracks the ball in flight
      this.lookTarget.x += (b.x * 0.5 - this.lookTarget.x) * dt * 2.5;
      this.lookTarget.y += ((b.y * 0.4 + 1.0) - this.lookTarget.y) * dt * 2.5;
      this.camera.lookAt(this.lookTarget.x, this.lookTarget.y, this.lookTarget.z);
    }

    if (this.state === 'done') {
      if (this.timeScale < 1 && now > this.slowUntil) this.timeScale = 1;
      if (now > this.resetAt) this.placeBall();
    }
  }
}
