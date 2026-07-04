/* Static test: Field Observations depth — Slice 14 (Release from Prepared).
 *
 * Covers the member-initiated removal of a stale/incorrect prepared artifact
 * from the Prepared tray:
 *   1. Each Prepared card carries an explicit "Release from Prepared" action,
 *      wired to studioReleaseFromPrepared and targeting the processed
 *      artifact id (never the source media id).
 *   2. Release deletes ONLY the derived processed artifact through the
 *      member-scoped server route (DELETE /field-observations/processed/{id}) —
 *      it never deletes media or the remembered observation.
 *   3. The destructive effect is confirmed and its copy makes clear the
 *      original PDF / remembered observation are untouched.
 *   4. After a release the client drops the artifact from state, clears any
 *      pending Offer selection, and re-renders so Prepared state/count update.
 *   5. Consent boundary preserved: the release path performs no auto-submit,
 *      no /rose-mirror call, and adds no browser storage.
 *
 * Static/DOM assertions over studio.html markup and its inline script; no
 * server required.
 *
 * Usage:  node tests/studio-fo-prepared-release.test.js
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

const render = (src.match(/function studioRenderPreparedField[\s\S]*?\n}/) || [''])[0];
const release = (src.match(/async function studioReleaseFromPrepared[\s\S]*?\n}/) || [''])[0];

// ---------------------------------------------------------------------------
// 1) Prepared cards expose an explicit, id-targeted Release action.
// ---------------------------------------------------------------------------
console.log('prepared cards expose a Release from Prepared action');

assert(render !== '', 'studioRenderPreparedField() body is extractable');
assert(/Release from Prepared/.test(render),
  'the Prepared tray renders a "Release from Prepared" action');
assert(/fo-prepared-release-btn/.test(render),
  'the release button carries the fo-prepared-release-btn hook');
assert(/data-id="\$\{pid\}"/.test(render) && /const pid = studioNexusEscape\(p\.id\)/.test(render),
  'the release button targets the processed artifact id (p.id), not the media id');
assert(/studioReleaseFromPrepared\(btn\.dataset\.id\)/.test(render),
  'release button wires to studioReleaseFromPrepared with the artifact id');

// ---------------------------------------------------------------------------
// 2) Release deletes ONLY the processed artifact via the member-scoped route.
// ---------------------------------------------------------------------------
console.log('release deletes only the processed artifact, member-scoped');

assert(release !== '', 'studioReleaseFromPrepared() body is extractable');
assert(/\/field-observations\/processed\//.test(release),
  'release hits the processed-artifact route');
assert(/method:\s*'DELETE'/.test(release),
  'release uses the DELETE method');
assert(/encodeURIComponent\(procId\)/.test(release),
  'release deletes by the processed artifact id');
// It must NOT touch the media-delete or the observation-delete routes.
assert(!/\/attachments\//.test(release),
  'release never calls the media (attachments) route — source media is safe');
assert(!/studioDeleteFieldObservation\b/.test(release),
  'release never deletes the remembered observation');
// foMediaQuery carries the member cipher scope on the request.
assert(/foMediaQuery\(\)/.test(release),
  'release passes the member scope query (foMediaQuery) to the server');

// ---------------------------------------------------------------------------
// 3) The destructive effect is confirmed with honest copy.
// ---------------------------------------------------------------------------
console.log('release confirms with honest copy');

assert(/confirm\(/.test(release),
  'release asks for confirmation before deleting');
const confirmMatch = release.match(/confirm\(\s*'([^']*)'/);
const confirmCopy = confirmMatch ? confirmMatch[1].toLowerCase() : '';
assert(/untouched|stay untouched/.test(confirmCopy),
  'confirm copy states the original PDF / observations stay untouched');
assert(/cannot be undone|undone/.test(confirmCopy),
  'confirm copy makes clear the release cannot be undone');

// ---------------------------------------------------------------------------
// 4) After release: state drops the artifact, selection clears, views refresh.
// ---------------------------------------------------------------------------
console.log('release updates state and re-renders');

assert(/state\.fieldObservationProcessed\s*=\s*\(state\.fieldObservationProcessed[\s\S]*?filter/.test(release),
  'release removes the artifact from state.fieldObservationProcessed');
assert(/studioSelectedProcessedText\.delete\(/.test(release),
  'release clears any pending Offer selection for the released artifact');
assert(/studioRenderPreparedField\(\)/.test(release),
  'release re-renders the Prepared tray (state + count refresh)');

// ---------------------------------------------------------------------------
// 5) Consent boundary: no auto-submit, no /rose-mirror, no browser storage.
// ---------------------------------------------------------------------------
console.log('release preserves the consent boundary');

assert(!/rose-mirror|\.submit\s*\(/.test(release),
  'release never calls /rose-mirror and never auto-submits');
assert(!/localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie/.test(release),
  'release adds no browser storage');

// ---------------------------------------------------------------------------
// 6) DOM sanity: the Prepared panel/host still exist (no regression).
// ---------------------------------------------------------------------------
console.log('prepared panel wiring intact');

const dom = new JSDOM(src);
const doc = dom.window.document;
assert(doc.getElementById('fo-panel-prepared') !== null, 'prepared panel exists');
assert(doc.getElementById('fo-prepared-body') !== null, 'prepared body host exists');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
