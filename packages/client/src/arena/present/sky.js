// Stadium variants (feature matrix #40) — the rendering half.
//
// This is the only file in present/ that imports three, and it does not build a
// scene: createScene() in view/scene.js already did that, and it is shared with
// the shipping game, so forking it to add a night preset would fork the game.
// Instead the variant is APPLIED to the scene that exists — lights retuned,
// materials tinted, one rain object added — and `dispose()` puts every value it
// touched back exactly as it found it.
//
// That "find the objects by what they are" traversal is deliberate. It costs one
// walk of a scene graph with a few hundred nodes, once, at match start, and in
// exchange the atmosphere agent and this one can both mount into the same view
// without either of them owning scene.js.
//
// COST
//   day/night      0 draw calls (light + material property writes)
//   theme          0 draw calls (colour writes)
//   rain           1 draw call, one LineSegments, animated entirely in the
//                  vertex shader from a single uTime uniform. No per-frame
//                  buffer upload, no CPU particle loop, no sorting.
//
// GAMEPLAY
//   None of it is readable from packages/core, none of it is written back, and
//   the ball is not tinted. A stadium variant cannot change a match.

import * as THREE from 'three';
import { resolveVariant } from './stadium.js';

/** Rain volume, metres. Comfortably larger than the pitch and the stands. */
const RAIN_BOX = Object.freeze({ x: 46, y: 26, z: 62 });
const RAIN_STREAK = 0.55; // metres of streak per drop

/**
 * Walk the scene once and label what createScene() built, by the only stable
 * property each of those objects has.
 */
function inventory(scene) {
  const found = {
    hemi: null,
    sun: null,
    stands: [],
    seats: [],
    boards: [],
    pylonHeads: [],
    ground: null,
    apron: null,
  };
  const standColour = 0x232c44;
  const seatColour = 0x2e3a5c;
  const headColour = 0xfff6d8;
  const apronColour = 0x101c2e;
  scene.traverse((o) => {
    if (o.isHemisphereLight && !found.hemi) found.hemi = o;
    else if (o.isDirectionalLight && !found.sun) found.sun = o;
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = o.material;
    const hex = m.color ? m.color.getHex() : -1;
    if (m.map && !found.ground && o.geometry?.type === 'PlaneGeometry') found.ground = o;
    else if (hex === apronColour) found.apron = o;
    else if (hex === standColour) found.stands.push(o);
    else if (hex === seatColour) found.seats.push(o);
    else if (hex === headColour && m.isMeshBasicMaterial) found.pylonHeads.push(o);
    else if (m.isMeshLambertMaterial && o.geometry?.type === 'BoxGeometry' && !m.map) {
      // ad boards: small lambert boxes that are neither stand nor seat
      const p = o.geometry.parameters || {};
      const thin = Math.min(p.width ?? 9, p.depth ?? 9) <= 0.2;
      if (thin) found.boards.push(o);
    }
  });
  return found;
}

/** Rain, as one LineSegments animated in the vertex shader. */
function buildRain(count, weather) {
  const positions = new Float32Array(count * 2 * 3);
  const seeds = new Float32Array(count * 2);
  const ends = new Float32Array(count * 2);
  // Deterministic scatter: a tiny LCG rather than Math.random, so two tabs in
  // the same room get the same rain and a screenshot test is reproducible.
  let s = 0x2545f491;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const x = (rnd() - 0.5) * RAIN_BOX.x;
    const y = rnd() * RAIN_BOX.y;
    const z = (rnd() - 0.5) * RAIN_BOX.z;
    const seed = rnd();
    for (let v = 0; v < 2; v++) {
      const o = (i * 2 + v) * 3;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;
      seeds[i * 2 + v] = seed;
      ends[i * 2 + v] = v;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, RAIN_BOX.y / 2, 0), 60);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: weather.fallSpeed },
      uWind: { value: weather.wind },
      uHeight: { value: RAIN_BOX.y },
      uStreak: { value: RAIN_STREAK },
      uColour: { value: new THREE.Color(0xbcd4ff) },
      uOpacity: { value: 0.42 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aEnd;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uWind;
      uniform float uHeight;
      uniform float uStreak;
      varying float vFade;
      void main() {
        float rate = uSpeed * (0.75 + 0.5 * aSeed);
        float y = mod(position.y - uTime * rate, uHeight);
        // the second vertex of each pair trails behind: that is the streak
        y += aEnd * uStreak;
        float x = position.x + uWind * (uHeight - y) * 0.05;
        vFade = smoothstep(0.0, 3.0, y) * (1.0 - aEnd * 0.55);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, position.z, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColour;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(uColour, uOpacity * vFade);
      }
    `,
  });
  const mesh = new THREE.LineSegments(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.name = 'present-rain';
  return { mesh, material, geo };
}

/**
 * Apply a stadium variant to a live scene.
 *
 * @param {{scene:object, renderer:object, variant:object, quality:string}} opts
 * @returns {{id:string, label:string, resolved:object, update:(dt:number)=>void,
 *            setQuality:(q:string)=>void, drawCallDelta:number,
 *            dispose:()=>void}}
 */
export function applyStadium(opts = {}) {
  const { scene, renderer } = opts;
  if (!scene) throw new Error('applyStadium: no scene');
  let resolved = resolveVariant(opts.variant, opts.quality);
  const found = inventory(scene);

  // ------------------------------------------------------------- originals
  const original = {
    background: scene.background ? scene.background.clone() : null,
    fog: scene.fog ? { color: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far } : null,
    hemi: found.hemi
      ? {
        sky: found.hemi.color.clone(),
        ground: found.hemi.groundColor.clone(),
        intensity: found.hemi.intensity,
      }
      : null,
    sun: found.sun
      ? {
        colour: found.sun.color.clone(),
        intensity: found.sun.intensity,
        position: found.sun.position.clone(),
        castShadow: found.sun.castShadow,
        mapSize: found.sun.shadow ? found.sun.shadow.mapSize.clone() : null,
      }
      : null,
    materials: new Map(),
    exposure: renderer ? renderer.toneMappingExposure : 1,
    pixelRatio: renderer ? renderer.getPixelRatio() : 1,
  };
  const remember = (mesh) => {
    if (!mesh || original.materials.has(mesh.material)) return;
    original.materials.set(mesh.material, mesh.material.color.clone());
  };
  for (const m of [...found.stands, ...found.seats, ...found.boards,
    ...found.pylonHeads, found.ground, found.apron]) remember(m);

  let rain = null;

  function applyLights() {
    const { time, theme, weather, tier } = resolved;
    if (scene.background && scene.background.isColor) scene.background.setHex(time.background);
    if (scene.fog) {
      scene.fog.color.setHex(time.fog).lerp(new THREE.Color(theme.fogTint), 0.35);
      scene.fog.near = time.fogNear;
      scene.fog.far = time.fogFar * (weather.particles > 0 ? 0.8 : 1);
    }
    if (found.hemi) {
      found.hemi.color.setHex(time.hemiSky);
      found.hemi.groundColor.setHex(time.hemiGround);
      found.hemi.intensity = resolved.hemiIntensity;
    }
    if (found.sun) {
      found.sun.color.setHex(time.sun);
      found.sun.intensity = resolved.sunIntensity;
      found.sun.position.set(...time.sunPosition);
      found.sun.castShadow = tier.shadowMap > 0;
      if (found.sun.shadow && tier.shadowMap > 0) {
        found.sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
        if (found.sun.shadow.map) {
          found.sun.shadow.map.dispose();
          found.sun.shadow.map = null;
        }
      }
    }
    if (renderer) {
      renderer.toneMappingExposure = time.exposure;
      renderer.setPixelRatio(Math.min(
        typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
        tier.pixelRatio,
      ));
      renderer.shadowMap.enabled = tier.shadowMap > 0;
    }
  }

  function applyTheme() {
    const { theme, time, weather, tier } = resolved;
    for (const m of found.stands) m.material.color.setHex(theme.stand);
    for (const m of found.seats) m.material.color.setHex(theme.seat);
    for (const m of found.boards) {
      // keep the per-board variety createScene picked, but pull it toward the
      // theme so a neon stadium does not keep four sponsor colours from 1998
      const base = original.materials.get(m.material);
      if (base) m.material.color.copy(base).lerp(new THREE.Color(theme.board), 0.55);
    }
    for (const m of found.pylonHeads) {
      m.material.color.setHex(time.pylons);
      m.visible = tier.pylonHeads || resolved.variant.time === 'gece';
    }
    if (found.ground) {
      const grass = new THREE.Color(theme.grass);
      // the map is the pitch texture; the colour multiplies it, so keep it near
      // white or the lines stop reading. Rain darkens it slightly.
      found.ground.material.color.copy(grass).lerp(new THREE.Color(0xffffff), 0.55)
        .multiplyScalar(1 - weather.wet * 0.25);
    }
    if (found.apron) {
      // The apron is a 400 m plane that fills most of the upper frame from the
      // broadcast camera, so it reads as "the world outside the stadium", not
      // as sky. By day that has to be dark grass or the shot looks like night
      // with the floodlights on; after dark it is the fog colour, which is what
      // makes the stadium feel like an island of light.
      found.apron.material.color.copy(
        resolved.variant.time === 'gunduz'
          ? new THREE.Color(theme.grass).multiplyScalar(0.45)
          : new THREE.Color(theme.fogTint),
      );
    }
  }

  function applyWeather() {
    if (rain) {
      scene.remove(rain.mesh);
      rain.geo.dispose();
      rain.material.dispose();
      rain = null;
    }
    if (resolved.particles > 0) {
      rain = buildRain(resolved.particles, resolved.weather);
      scene.add(rain.mesh);
    }
  }

  function applyAll() {
    applyLights();
    applyTheme();
    applyWeather();
  }

  applyAll();
  let elapsed = 0;

  return {
    get id() { return resolved.id; },
    get label() { return resolved.label; },
    get resolved() { return resolved; },
    /** Extra draw calls this variant costs. Reported by the screenshot sweep. */
    get drawCallDelta() { return rain ? 1 : 0; },

    /** One uniform write per frame. That is the whole particle system. */
    update(dt) {
      if (!rain) return;
      elapsed += Math.max(0, dt || 0);
      rain.material.uniforms.uTime.value = elapsed;
    },

    /** Manual override, from a settings menu or ?quality=. */
    setQuality(q) {
      resolved = resolveVariant(resolved.variant, q);
      applyAll();
      return resolved.quality;
    },

    setVariant(v) {
      resolved = resolveVariant(v, resolved.quality);
      applyAll();
      return resolved.id;
    },

    dispose() {
      if (rain) {
        scene.remove(rain.mesh);
        rain.geo.dispose();
        rain.material.dispose();
        rain = null;
      }
      if (original.background && scene.background) scene.background.copy(original.background);
      if (original.fog && scene.fog) {
        scene.fog.color.copy(original.fog.color);
        scene.fog.near = original.fog.near;
        scene.fog.far = original.fog.far;
      }
      if (found.hemi && original.hemi) {
        found.hemi.color.copy(original.hemi.sky);
        found.hemi.groundColor.copy(original.hemi.ground);
        found.hemi.intensity = original.hemi.intensity;
      }
      if (found.sun && original.sun) {
        found.sun.color.copy(original.sun.colour);
        found.sun.intensity = original.sun.intensity;
        found.sun.position.copy(original.sun.position);
        found.sun.castShadow = original.sun.castShadow;
        if (found.sun.shadow && original.sun.mapSize) {
          found.sun.shadow.mapSize.copy(original.sun.mapSize);
        }
      }
      for (const [material, colour] of original.materials) material.color.copy(colour);
      for (const m of found.pylonHeads) m.visible = true;
      if (renderer) {
        renderer.toneMappingExposure = original.exposure;
        renderer.setPixelRatio(original.pixelRatio);
        renderer.shadowMap.enabled = true;
      }
    },
  };
}
