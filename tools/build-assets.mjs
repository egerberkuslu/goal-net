#!/usr/bin/env node
// Bake the procedural stadium into a compressed GLB.
//
//   node tools/build-assets.mjs                 build, compress, report
//   node tools/build-assets.mjs --tier mobile   the 1K-texture mobile row
//   node tools/build-assets.mjs --raw           stop after the uncompressed GLB
//   node tools/build-assets.mjs --json          machine-readable report only
//
// WHAT THIS IS AND IS NOT
//
// It is not an exporter for art somebody made. There is no Blender in this
// environment and no Mixamo download to retarget — brain/40-progress/HUMAN-QUEUE.md
// has both, and they are still open. So the stadium is authored in code, and
// this script is what makes that a real asset pipeline rather than a claim:
// it imports the SAME module the runtime imports, packages/client/src/arena/
// assets/stadiumSpec.js, and pushes the result through the exact chain
// rendering-optimization.md specifies.
//
//   1. stadiumSpec.js          typed arrays, no three.js, no DOM
//   2. sharp                   the two textures as PNG, drawn from the same
//                              numbers textures.js draws them from
//   3. @gltf-transform/core    assemble a glTF document and write a GLB
//   4. gltf-transform dedup    drop duplicate accessors and materials
//   5. gltf-transform draco    KHR_draco_mesh_compression, edgebreaker
//   6. gltf-transform etc1s    KHR_texture_basisu, KTX2/ETC1S textures
//
// Steps 5 and 6 are the two extensions the acceptance criterion names, and the
// script verifies both are present in the output rather than assuming the CLI
// did what it was asked.
//
// TOOLCHAIN NOTE
//
// Step 6 shells out to `ktx` from KTX-Software. It is not installed system-wide
// here (that needs sudo, see HUMAN-QUEUE.md), so the script also looks for a
// vendored copy under tools/vendor/. Install it properly with
// `sudo apt install ktx-tools` or from the Khronos release and the vendored
// copy becomes unnecessary.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import sharp from 'sharp';

import { buildStadiumSpec } from '../packages/client/src/arena/assets/stadiumSpec.js';
import { BOARD_PANELS, GRAIN_DOTS } from '../packages/client/src/arena/assets/textures.js';
import { QUALITY } from '../packages/client/src/arena/assets/quality.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist-assets');
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : fallback;
};
const tier = typeof flag('tier') === 'string' ? flag('tier') : 'desktop';
const rawOnly = !!flag('raw', false);
const jsonOnly = !!flag('json', false);

const log = (...a) => { if (!jsonOnly) console.log(...a); };

// -------------------------------------------------------------- toolchain ---

const VENDOR = join(root, 'tools', 'vendor');

/** Find a CLI: PATH first, then anything vendored under tools/vendor. */
function findTool(name) {
  try {
    execFileSync('sh', ['-c', `command -v ${name}`], { stdio: 'pipe' });
    return { cmd: name, env: {} };
  } catch { /* not on PATH */ }
  if (!existsSync(VENDOR)) return null;
  const stack = [VENDOR];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch { continue; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === name) {
        const lib = join(dirname(dirname(p)), 'lib');
        return {
          cmd: p,
          env: existsSync(lib)
            ? { LD_LIBRARY_PATH: `${lib}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}` }
            : {},
          vendored: true,
        };
      }
    }
  }
  return null;
}

const gltfTransform = join(root, 'node_modules', '.bin', 'gltf-transform');

function runTransform(args, extraEnv = {}) {
  return execFileSync(gltfTransform, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: jsonOnly ? 'pipe' : 'inherit',
  });
}

// --------------------------------------------------------------- textures ---

/** The turf, drawn with the same stripes and the same seeded grain as
 *  textures.js draws in a canvas. Deterministic: two runs are byte-identical. */
async function turfPng(size) {
  const height = size;
  const width = Math.round(size * (30 / 48));
  const px = Buffer.alloc(width * height * 3);
  const stripes = 16;
  const A = [0x2c, 0x8a, 0x3c];
  const B = [0x33, 0x98, 0x4a];
  for (let y = 0; y < height; y++) {
    const band = Math.floor(y * stripes / height) % 2 ? A : B;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      px[o] = band[0]; px[o + 1] = band[1]; px[o + 2] = band[2];
    }
  }
  let seed = 0x9e3779b9;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < GRAIN_DOTS; i++) {
    const x = (rand() * width) | 0;
    const y = (rand() * height) | 0;
    const dark = rand() > 0.5;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const xx = Math.min(width - 1, x + dx);
        const yy = Math.min(height - 1, y + dy);
        const o = (yy * width + xx) * 3;
        for (let c = 0; c < 3; c++) {
          px[o + c] = dark
            ? Math.max(0, px[o + c] - 13)
            : Math.min(255, px[o + c] + 10);
        }
      }
    }
  }
  return sharp(px, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
}

/** The hoarding atlas: four flat brand panels with a highlight band. */
async function boardsPng(size) {
  const width = size;
  const height = Math.round(size / 8);
  const panelW = Math.floor(width / BOARD_PANELS.length);
  const px = Buffer.alloc(width * height * 3);
  const hex = (s) => [
    parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16),
  ];
  for (let i = 0; i < BOARD_PANELS.length; i++) {
    const bg = hex(BOARD_PANELS[i].bg);
    const fg = hex(BOARD_PANELS[i].fg);
    for (let y = 0; y < height; y++) {
      const band = y >= height * 0.62 && y < height * 0.68;
      for (let x = i * panelW; x < Math.min(width, (i + 1) * panelW); x++) {
        const o = (y * width + x) * 3;
        // A block of the foreground colour stands in for the wordmark: the GLB
        // is a background asset and a text raster would need a font this
        // environment cannot be relied on to have.
        const inMark = y > height * 0.28 && y < height * 0.58
          && x > i * panelW + panelW * 0.12 && x < i * panelW + panelW * 0.88;
        const c = inMark ? fg : bg;
        px[o] = band ? Math.min(255, c[0] + 24) : c[0];
        px[o + 1] = band ? Math.min(255, c[1] + 24) : c[1];
        px[o + 2] = band ? Math.min(255, c[2] + 24) : c[2];
      }
    }
  }
  return sharp(px, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
}

// ------------------------------------------------------------------ glTF ----

function addMesh(doc, buffer, mesh, material) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor(`${mesh.name}_P`).setType('VEC3').setArray(mesh.position).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor(`${mesh.name}_N`).setType('VEC3').setArray(mesh.normal).setBuffer(buffer))
    .setIndices(doc.createAccessor(`${mesh.name}_I`).setType('SCALAR').setArray(mesh.index).setBuffer(buffer))
    .setMaterial(material);
  if (mesh.uv?.length) {
    prim.setAttribute('TEXCOORD_0', doc.createAccessor(`${mesh.name}_T`).setType('VEC2').setArray(mesh.uv).setBuffer(buffer));
  }
  if (mesh.color?.length) {
    prim.setAttribute('COLOR_0', doc.createAccessor(`${mesh.name}_C`).setType('VEC3').setArray(mesh.color).setBuffer(buffer));
  }
  return doc.createMesh(mesh.name).addPrimitive(prim);
}

async function buildDocument(spec, textureSize) {
  // The two extensions are applied by the CLI passes, not here: this document
  // is the plain, uncompressed source they consume. Naming them keeps the
  // dependency explicit and lets the verifier below check the output for them.
  void KHRDracoMeshCompression;
  void KHRTextureBasisu;
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('stadium');

  const turf = await turfPng(textureSize);
  const boards = await boardsPng(textureSize);
  const turfTex = doc.createTexture('turf').setImage(turf).setMimeType('image/png');
  const boardTex = doc.createTexture('boards').setImage(boards).setMimeType('image/png');

  const vertexMat = doc.createMaterial('shell')
    .setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(0.9)
    .setMetallicFactor(0);
  const boardMat = doc.createMaterial('boards')
    .setBaseColorTexture(boardTex)
    .setRoughnessFactor(0.8)
    .setMetallicFactor(0)
    .setDoubleSided(true);
  const turfMat = doc.createMaterial('turf')
    .setBaseColorTexture(turfTex)
    .setRoughnessFactor(1)
    .setMetallicFactor(0);
  const frameMat = doc.createMaterial('frames')
    .setBaseColorFactor([1, 1, 1, 1])
    .setRoughnessFactor(0.35)
    .setMetallicFactor(0.1);

  // the merged statics: one node each
  for (const [key, material] of [
    ['shell', vertexMat], ['lines', vertexMat], ['goals', frameMat], ['boards', boardMat],
  ]) {
    const mesh = addMesh(doc, buffer, spec.meshes[key], material);
    scene.addChild(doc.createNode(key).setMesh(mesh));
  }

  // the turf itself, so the GLB is a whole stadium and not a bowl with a hole
  const L = spec.layout;
  const hx = L.apronHalfX;
  const hz = L.apronHalfZ;
  const turfMesh = addMesh(doc, buffer, {
    name: 'turf',
    position: new Float32Array([-hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz]),
    normal: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    index: new Uint16Array([0, 1, 2, 0, 2, 3]),
  }, turfMat);
  scene.addChild(doc.createNode('turf').setMesh(turfMesh));

  // The repeated pieces are ONE mesh referenced by many nodes. glTF's own form
  // of instancing, understood by every loader, and Draco compresses the single
  // mesh once rather than once per copy.
  for (const [key, table] of [['seat', spec.instances.seats], ['lamp', spec.instances.lamps]]) {
    const mesh = addMesh(doc, buffer, spec.meshes[key], vertexMat);
    for (let i = 0; i < table.count; i++) {
      const node = doc.createNode(`${key}_${i}`)
        .setMesh(mesh)
        .setTranslation([table.position[i * 3], table.position[i * 3 + 1], table.position[i * 3 + 2]]);
      const yaw = table.rotationY[i];
      node.setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]);
      scene.addChild(node);
    }
  }
  return doc;
}

// ------------------------------------------------------------------- main ---

function bytes(path) { return statSync(path).size; }
function kb(n) { return `${(n / 1024).toFixed(1)} KB`; }

/** Read a GLB's JSON chunk without a full parse, to verify the extensions. */
function glbExtensions(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  return {
    used: json.extensionsUsed || [],
    required: json.extensionsRequired || [],
    meshes: json.meshes?.length || 0,
    nodes: json.nodes?.length || 0,
    images: (json.images || []).map((i) => i.mimeType || 'unknown'),
  };
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const quality = QUALITY[tier] || QUALITY.desktop;
  const spec = buildStadiumSpec({ detail: quality.stadium });

  log(`\n=== stadium spec (tier: ${tier})`);
  for (const [k, v] of Object.entries(spec.stats.triangles)) {
    log(`    ${k.padEnd(10)} ${String(v).padStart(8)} triangles`);
  }
  log(`    seats ${spec.stats.seatCount}, lamps ${spec.stats.lampCount}, runtime draw calls ${spec.stats.drawCalls}`);

  const doc = await buildDocument(spec, quality.textureSize);
  const io = new NodeIO();
  const rawPath = join(outDir, 'stadium.raw.glb');
  writeFileSync(rawPath, await io.writeBinary(doc));
  log(`\n=== raw GLB   ${kb(bytes(rawPath))}`);

  const report = {
    tier,
    triangles: spec.stats.triangles,
    seatCount: spec.stats.seatCount,
    drawCalls: spec.stats.drawCalls,
    sizes: { raw: bytes(rawPath) },
    steps: [],
  };

  if (rawOnly) {
    writeFileSync(join(outDir, 'stadium-report.json'), JSON.stringify(report, null, 2));
    if (jsonOnly) console.log(JSON.stringify(report, null, 2));
    return report;
  }

  // 1. dedup: identical accessors and materials collapse before compression
  const dedupPath = join(outDir, 'stadium.dedup.glb');
  runTransform(['dedup', rawPath, dedupPath]);
  report.sizes.dedup = bytes(dedupPath);
  report.steps.push({ step: 'dedup', bytes: report.sizes.dedup });
  log(`=== dedup     ${kb(report.sizes.dedup)}`);

  // 2. KTX2 / ETC1S for the colour textures.
  //
  // TEXTURES BEFORE GEOMETRY, and this order is not a preference. The etc1s
  // pass has to read the whole document, and gltf-transform DECODES Draco to
  // do it — it says so, in a warning — and does not put it back. Running draco
  // first therefore produces a GLB with KTX2 textures and no geometry
  // compression at all, which measures as a 60% size REGRESSION. Compressing
  // the textures first and Draco last is the only ordering where both
  // extensions survive into the artefact.
  const ktx = findTool('ktx');
  const texPath = join(outDir, 'stadium.ktx.glb');
  if (!ktx) {
    log('\n!!! ktx (KTX-Software) not found on PATH or in tools/vendor.');
    log('    The GLB will be Draco-compressed but its textures stay PNG.');
    log('    Fix: sudo apt install ktx-tools, or unpack a KTX-Software release');
    log('    into tools/vendor/ (see brain/40-progress/HUMAN-QUEUE.md).');
    writeFileSync(texPath, readFileSync(dedupPath));
    report.ktx = false;
  } else {
    const env = { ...ktx.env };
    if (ktx.cmd !== 'ktx') env.PATH = `${dirname(ktx.cmd)}:${process.env.PATH}`;
    runTransform(['etc1s', dedupPath, texPath, '--quality', '128'], env);
    report.ktx = true;
    report.ktxVendored = !!ktx.vendored;
  }
  report.sizes.ktx2 = bytes(texPath);
  report.steps.push({ step: 'etc1s', bytes: report.sizes.ktx2 });
  log(`=== etc1s     ${kb(report.sizes.ktx2)}`);

  // 3. Draco, edgebreaker — the method rendering-optimization.md names. Last,
  //    so nothing downstream has a reason to decode it again.
  const finalPath = join(outDir, 'stadium.glb');
  runTransform(['draco', texPath, finalPath, '--method', 'edgebreaker']);
  report.sizes.final = bytes(finalPath);
  report.steps.push({ step: 'draco', bytes: report.sizes.final });

  // What KTX2 actually buys, stated honestly.
  //
  // On DISK, ETC1S is roughly a wash against a well-packed PNG of flat art —
  // the numbers above show it. The win is VRAM: an RGBA8 texture is uploaded
  // and kept at 4 bytes a texel forever, while a KTX2/ETC1S texture transcodes
  // to the GPU's own block format (BC1 on desktop, ETC2 or ASTC on mobile) at
  // half a byte. For the 2K turf that is 10.5 MB of video memory against 1.3.
  // On a phone with a 1 GB budget shared with the browser, that is the whole
  // reason rendering-optimization.md asks for it.
  const texels = (w, h) => w * h * 1.333; // + mip chain
  const turfTexels = texels(Math.round(quality.textureSize * (30 / 48)), quality.textureSize);
  const boardTexels = texels(quality.textureSize, Math.round(quality.textureSize / 8));
  report.textureMemory = {
    rgba8Bytes: Math.round((turfTexels + boardTexels) * 4),
    transcodedBytes: Math.round((turfTexels + boardTexels) * 0.5),
  };
  log(`    texture VRAM: ${kb(report.textureMemory.rgba8Bytes)} as RGBA8 -> ${kb(report.textureMemory.transcodedBytes)} transcoded`);

  const ext = glbExtensions(finalPath);
  report.extensions = ext.used;
  report.images = ext.images;
  report.meshCount = ext.meshes;
  report.nodeCount = ext.nodes;
  report.draco = ext.used.includes('KHR_draco_mesh_compression');
  report.basisu = ext.used.includes('KHR_texture_basisu');

  log(`=== final     ${kb(report.sizes.final)}   (${((1 - report.sizes.final / report.sizes.raw) * 100).toFixed(1)}% smaller than raw)`);
  log(`    extensions: ${ext.used.join(', ') || 'none'}`);
  log(`    images:     ${ext.images.join(', ') || 'none'}`);
  log(`    meshes ${ext.meshes}, nodes ${ext.nodes}`);
  log(`    -> ${finalPath}\n`);

  writeFileSync(join(outDir, 'stadium-report.json'), JSON.stringify(report, null, 2));
  if (jsonOnly) console.log(JSON.stringify(report, null, 2));
  return report;
}

main().catch((err) => {
  console.error('build-assets failed:', err.message);
  process.exit(1);
});
