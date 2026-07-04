/* Static test: Field Observations depth — Slice 9 (Release from Worked).
 *
 * Covers the explicit, destructive counterpart to "Return to Field": a member
 * can remove a returned Worked item from the field.
 *   1. Each Worked card renders a clearly destructive "Release from Worked"
 *      action (aligned language, not file-manager "Delete", made irreversible
 *      in copy).
 *   2. Releasing a durable (persisted) worked item reuses the EXISTING
 *      member-scoped Field Observations delete endpoint
 *      (DELETE /api/studio/field-observations/{id}) with the worked item id.
 *   3. Release only ever touches Worked state
 *      (state.fieldObservationsWorked / state.fieldObservationsWorkedServer)
 *      and refreshes the Worked render + mode counts — it never touches
 *      state.fieldObservations (Remembered) or media.
 *   4. The consent boundary is preserved: no browser storage, no /rose-mirror,
 *      no auto-submit, no Nexus call.
 *
 * Static/DOM assertions over the studio.html markup and inline script; no
 * server is required.
 *
 * Usage:  node tests/studio-fo-worked-release.test.js
 * Deps:   jsdom
 */
'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (_) {
  try { JSDOM = require('/tmp/node_modules/jsdom').JSDOM; }
  catch (e) {
    console.error('jsdom not installed — run: npm i jsdom');
    process.exit(2);
  }
}

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

function slice(start, end) {
  const i = src.indexOf(start);
  if (i < 0) return '';
  const j = src.indexOf(end, i + start.length);
  return j < 0 ? src.slice(i) : src.slice(i, j);
}

// ---------------------------------------------------------------------------
// 1) The release action is defined with aligned, clearly-destructive language.
// ---------------------------------------------------------------------------
console.log('release action exists with aligned destructive language');

assert(/function studioReleaseWorkedItem\s*\(/.test(src),
  'studioReleaseWorkedItem() is defined');

const releaseFn = slice('async function studioReleaseWorkedItem', '\n}\n');
assert(releaseFn !== '', 'studioReleaseWorkedItem() body is extractable');

// The Worked render emits a release button per card and wires it.
const renderFn = slice('function studioRenderWorkedField', 'async function studioReleaseWorkedItem');
assert(/fo-worked-release-btn/.test(renderFn),
  'each worked card renders a release button (.fo-worked-release-btn)');
assert(/Release from Worked|Remove from Worked/.test(renderFn),
  'release button uses aligned "Release from Worked" / "Remove from Worked" language (not file-manager "Delete")');
assert(/studioReleaseWorkedItem\s*\(/.test(renderFn),
  'the release button click is wired to studioReleaseWorkedItem()');
// The destructive nature is made explicit before acting.
assert(/window\.confirm/.test(releaseFn) && /cannot be undone|undone/.test(releaseFn),
  'release confirms with the member and states it cannot be undone');

// ---------------------------------------------------------------------------
// 2) Persisted worked items are deleted through the EXISTING delete endpoint.
// ---------------------------------------------------------------------------
console.log('release reuses the existing member-scoped delete endpoint for durable rows');

assert(/DELETE/.test(releaseFn) && /field-observations\/\$\{encodeURIComponent\(wid\)\}/.test(releaseFn),
  'durable release calls DELETE /api/studio/field-observations/{id} with the worked id');
assert(/method:\s*'DELETE'/.test(releaseFn),
  'release uses the DELETE method (the existing observation delete route)');
// It is member-scoped like every other Field Observations call.
assert(/foCipherId\s*\(/.test(releaseFn) && /cipher_id=/.test(releaseFn),
  'release stays member-scoped via cipher_id, matching the delete contract');

// ---------------------------------------------------------------------------
// 3) Release updates ONLY Worked state + counts, never Remembered/media.
// ---------------------------------------------------------------------------
console.log('release updates only Worked state and counts');

assert(/state\.fieldObservationsWorkedServer\s*=\s*\(state\.fieldObservationsWorkedServer/.test(releaseFn),
  'durable release drops the row from the Worked server snapshot');
assert(/state\.fieldObservationsWorked\s*=\s*\(state\.fieldObservationsWorked/.test(releaseFn),
  'session-only release drops the row from the in-memory Worked list');
assert(/studioRenderWorkedField\s*\(/.test(releaseFn) && /studioUpdateFoModeCounts\s*\(/.test(releaseFn),
  'release refreshes the Worked render and the mode counts');
// It must NOT touch Remembered observations or media state.
assert(!/state\.fieldObservations\b(?!Worked)/.test(releaseFn),
  'release never mutates Remembered state (state.fieldObservations)');
assert(!/state\.fieldObservationMedia\b/.test(releaseFn),
  'release never touches media state (state.fieldObservationMedia)');

// ---------------------------------------------------------------------------
// 4) Consent boundary preserved: no browser storage, no auto-Nexus.
// ---------------------------------------------------------------------------
console.log('release preserves the consent boundary (no storage, no auto-Nexus)');

const STORAGE_RE = /localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie/;
assert(!STORAGE_RE.test(releaseFn),
  'release uses no localStorage / sessionStorage / indexedDB / cookies');
assert(!/rose-mirror/.test(releaseFn) && !/\.submit\s*\(/.test(releaseFn),
  'release never calls /rose-mirror and never auto-submits (no Nexus path)');

// The DOM still exposes a single worked panel host; release is additive markup.
const dom = new JSDOM(src);
const worked = dom.window.document.getElementById('fo-panel-worked');
assert(worked !== null, 'worked panel still present');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
