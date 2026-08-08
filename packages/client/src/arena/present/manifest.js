// The clip manifest: line id + language -> one audio file.
//
// The manifest is DERIVED from lines.js rather than hand-written, so a line and
// its clip can never drift apart: adding a line adds two manifest entries (tr
// and en) and the generator immediately reports the two missing files.
//
// File naming is `<id>.<lang>.<ext>`, flat, no directories per language. That
// keeps the recording hand-off trivial ("send me a folder of these names") and
// makes the manifest reproducible from the table alone.
//
// Placeholder clips are WAV because a 12-line generator can write a WAV header
// and nothing else; the real recordings are expected as OPUS or MP3 (see
// brain/40-progress/HUMAN-QUEUE.md). `CLIP_FORMATS` is the resolution order the
// player walks, so dropping real .opus files next to the placeholders replaces
// them without touching a line of code.

import { LANGUAGES, LINES, validateLines } from './lines.js';

/** Extensions the player will try, best quality first. */
export const CLIP_FORMATS = Object.freeze(['opus', 'mp3', 'wav']);

/** Where clips live relative to this module. */
export const CLIP_DIR = 'clips';

/**
 * @typedef {{id:string, lang:string, line:string, durationMs:number,
 *            file:string, candidates:string[], text:string}} ClipEntry
 */

/** `id::lang` — the manifest key. One string, so it can index a plain object. */
export const clipKey = (id, lang) => `${id}::${lang}`;

/**
 * Build the manifest. Pure: same table in, same object out.
 * @param {{languages?:string[], formats?:string[]}} options
 * @returns {{version:number, generatedFrom:string, entries:Record<string,ClipEntry>,
 *            ids:string[], languages:string[], totalMs:number}}
 */
export function buildManifest(options = {}) {
  const languages = options.languages || LANGUAGES;
  const formats = options.formats || CLIP_FORMATS;
  const entries = Object.create(null);
  let totalMs = 0;
  for (const line of LINES) {
    for (const lang of languages) {
      const base = `${line.id}.${lang}`;
      entries[clipKey(line.id, lang)] = Object.freeze({
        id: line.id,
        lang,
        line: line.id,
        durationMs: line.durationMs,
        file: `${base}.${formats[formats.length - 1]}`,
        candidates: formats.map((ext) => `${base}.${ext}`),
        text: line[lang],
      });
      totalMs += line.durationMs;
    }
  }
  return {
    version: 1,
    generatedFrom: 'arena/present/lines.js',
    entries,
    ids: LINES.map((l) => l.id),
    languages: [...languages],
    totalMs,
  };
}

/** The manifest every runtime path uses. */
export const CLIP_MANIFEST = buildManifest();

/** One entry, or null. */
export function clipFor(manifest, id, lang) {
  return manifest?.entries?.[clipKey(id, lang)] || null;
}

/**
 * Structural check of a manifest against the line table.
 * @returns {string[]} problems, empty when sound
 */
export function validateManifest(manifest = CLIP_MANIFEST) {
  const issues = validateLines();
  if (!manifest || typeof manifest !== 'object') return [...issues, 'manifest is not an object'];
  const seenFiles = new Set();
  for (const line of LINES) {
    for (const lang of manifest.languages || LANGUAGES) {
      const entry = clipFor(manifest, line.id, lang);
      if (!entry) {
        issues.push(`missing manifest entry: ${line.id} (${lang})`);
        continue;
      }
      if (entry.durationMs !== line.durationMs) {
        issues.push(`${line.id} (${lang}): duration ${entry.durationMs} != line ${line.durationMs}`);
      }
      if (entry.text !== line[lang]) issues.push(`${line.id} (${lang}): text drifted from the table`);
      if (seenFiles.has(entry.file)) issues.push(`duplicate file: ${entry.file}`);
      seenFiles.add(entry.file);
    }
  }
  return issues;
}

/**
 * The recording sheet a human needs: one row per clip, in table order. Written
 * into brain/40-progress/HUMAN-QUEUE.md by tools/make-clips.mjs so the queue is
 * never a stale copy of the table.
 */
export function recordingSheet(manifest = CLIP_MANIFEST) {
  const rows = [];
  for (const line of LINES) {
    for (const lang of manifest.languages || LANGUAGES) {
      const entry = clipFor(manifest, line.id, lang);
      if (!entry) continue;
      rows.push({
        file: entry.file,
        id: line.id,
        lang,
        seconds: (line.durationMs / 1000).toFixed(1),
        event: line.event,
        text: entry.text,
      });
    }
  }
  return rows;
}
