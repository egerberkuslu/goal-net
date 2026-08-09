// The scoreboard over the far stand, showing the actual match.
//
// The downloaded model (vendor-assets/CREDITS.md) is a housing: a frame with a
// blank face. It looked like a scoreboard and said nothing, which from the
// broadcast camera is worse than not having one — the eye goes to it and finds
// a prop. So the housing stays as geometry and this draws the live panel that
// hangs on its face.
//
// It is a canvas texture on one quad, repainted only when the numbers actually
// change. A scoreboard that repaints every frame would be a 512 x 256 texture
// upload sixty times a second for a clock that ticks once.

import * as THREE from 'three';

const W = 512;
const H = 256;

/** Panel size in metres, matched to the housing's face. */
const PANEL_W = 5.4;
const PANEL_H = 2.7;

const TEAM_COLORS = ['#e23b3b', '#3b6de2'];

export class ScoreboardView {
  /**
   * @param {THREE.Scene} scene
   * @param {{x:number, y:number, z:number, yaw?:number}} at where the housing is
   */
  constructor(scene, at) {
    this.canvas = typeof document !== 'undefined'
      ? document.createElement('canvas') : null;
    if (!this.canvas) return;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) { this.canvas = null; return; }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), this.material);
    this.mesh.position.set(at.x, at.y, at.z + 0.16);   // just off the housing
    if (at.yaw) this.mesh.rotation.y = at.yaw;
    this.mesh.name = 'scoreboard:panel';
    scene.add(this.mesh);

    this.last = '';
    this.draw(['0', '0'], '', ['KIRMIZI', 'MAVİ']);
  }

  /**
   * Repaint, but only when something changed.
   *
   * @param {number[]} score
   * @param {string} clock already formatted, so the board and the HUD can never
   *   disagree about what the time is
   * @param {string[]} [names] team labels
   */
  update(score, clock, names) {
    if (!this.canvas) return;
    const key = `${score[0]}-${score[1]}-${clock}`;
    if (key === this.last) return;
    this.last = key;
    this.draw([String(score[0]), String(score[1])], clock, names);
  }

  draw(score, clock, names = ['KIRMIZI', 'MAVİ']) {
    const g = this.ctx;
    g.clearRect(0, 0, W, H);

    // housing face: dark, slightly warm, with a lit border
    g.fillStyle = '#0a0f1c';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(150,180,255,0.35)';
    g.lineWidth = 4;
    g.strokeRect(4, 4, W - 8, H - 8);

    // the clock across the top, in the bulb-orange every ground uses
    g.fillStyle = '#ffb648';
    g.font = 'bold 54px "Consolas", ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(clock || '--:--', W / 2, 48);

    // teams and the score
    g.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? W * 0.25 : W * 0.75;
      g.fillStyle = TEAM_COLORS[i];
      g.fillText(names[i], x, 116);
      g.fillStyle = '#ffffff';
      g.font = 'bold 96px "Consolas", ui-monospace, monospace';
      g.fillText(score[i], x, 188);
      g.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = 'bold 60px "Consolas", ui-monospace, monospace';
    g.fillText('-', W / 2, 184);

    this.texture.needsUpdate = true;
  }

  dispose() {
    if (!this.mesh) return;
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.texture.dispose();
    this.material.dispose();
  }
}
