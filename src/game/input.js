// Drag-to-shoot: drag speed -> power, vertical -> loft, horizontal -> aim,
// curvature of the drag path -> side spin (falso).
export class DragInput {
  constructor(element, callbacks) {
    this.el = element;
    this.cb = callbacks; // { onDrag(params), onRelease(params), isReady() }
    this.samples = null;
    element.addEventListener('pointerdown', (e) => this.down(e));
    element.addEventListener('pointermove', (e) => this.move(e));
    element.addEventListener('pointerup', (e) => this.up(e));
    element.addEventListener('pointercancel', () => { this.samples = null; });
  }

  down(e) {
    if (!this.cb.isReady()) return;
    this.el.setPointerCapture(e.pointerId);
    this.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  }

  move(e) {
    if (!this.samples) return;
    this.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    const p = this.params();
    if (p) this.cb.onDrag(p);
  }

  up() {
    if (!this.samples) return;
    const p = this.params();
    this.samples = null;
    if (p) this.cb.onRelease(p);
    else this.cb.onDrag(null);
  }

  params() {
    const s = this.samples;
    if (s.length < 3) return null;
    const first = s[0], last = s[s.length - 1];
    const dx = last.x - first.x;
    const dy = first.y - last.y; // screen up is positive
    const dur = (last.t - first.t) / 1000;
    if (dur < 0.04 || dy < 8) return null;

    let pathLen = 0;
    for (let i = 1; i < s.length; i++) {
      pathLen += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    }
    const pxPerSec = pathLen / dur;
    const speed = Math.min(30, Math.max(11, 8 + pxPerSec / 90));

    const h = Math.min(innerHeight, 900);
    const elevation = Math.min(0.72, 0.06 + (dy / h) * 1.25);
    const yaw = (dx / innerWidth) * 1.5;

    // signed max perpendicular deviation of the path from its chord
    const chordLen = Math.hypot(dx, -dy) || 1;
    let dev = 0;
    for (const p of s) {
      const c = ((last.x - first.x) * (p.y - first.y) -
                 (last.y - first.y) * (p.x - first.x)) / chordLen;
      if (Math.abs(c) > Math.abs(dev)) dev = c;
    }
    const curl = Math.max(-1, Math.min(1, dev / 120)); // >0: path bows right

    return { speed, elevation, yaw, curl };
  }
}

// Convert drag params into a world-space velocity + spin for a ball at ballPos.
export function shotFromParams(p, ballPos, goalCenter = { x: 0, y: 1.0, z: 0 }) {
  let dirX = goalCenter.x - ballPos.x;
  let dirZ = goalCenter.z - ballPos.z;
  const dLen = Math.hypot(dirX, dirZ) || 1;
  dirX /= dLen; dirZ /= dLen;
  // rotate around Y: positive yaw (drag right) aims right of the goal centre
  const a = -p.yaw;
  const rx = dirX * Math.cos(a) + dirZ * Math.sin(a);
  const rz = -dirX * Math.sin(a) + dirZ * Math.cos(a);
  const cosE = Math.cos(p.elevation), sinE = Math.sin(p.elevation);
  const vel = {
    x: rx * cosE * p.speed,
    y: sinE * p.speed,
    z: rz * cosE * p.speed,
  };
  // side spin from path curvature (bow right -> ball curls right needs -Y spin)
  // plus a touch of backspin around the axis perpendicular to the shot
  const sideSpin = -p.curl * 55;
  const back = 6 + p.elevation * 12;
  const omega = {
    x: -rz * back,
    y: sideSpin,
    z: rx * back,
  };
  return { vel, omega };
}
