/* Static test: Field Observations depth — Slice 6.
 *
 * Covers two additions to the central Field Observations surface:
 *   1. Lightweight live count badges on the mode bar for the modes with
 *      countable client state (Remembered, Prepared, Offered). "Now" and
 *      "Worked" carry no badge. studioUpdateFoModeCounts() must read only
 *      already-loaded client state and never fetch/submit/call Nexus.
 *   2. A warm Worked landing/empty state that explains shaped material will
 *      return to the field later — without claiming functionality that does
 *      not exist.
 *
 * These are static/DOM assertions over the studio.html markup and inline
 * script; no server is required.
 *
 * Usage:  node tests/studio-fo-depth-counts-worked.test.js
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

const dom = new JSDOM(src);
const doc = dom.window.document;

// ---------------------------------------------------------------------------
// 1) Count badges present on the countable modes, absent on Now / Worked.
// ---------------------------------------------------------------------------
console.log('mode-bar count badges');

const bar = doc.getElementById('fo-mode-bar');
assert(bar !== null, 'mode bar (#fo-mode-bar) exists');

function btn(mode) { return bar.querySelector(`.fo-mode-btn[data-fo-mode="${mode}"]`); }

['remembered', 'prepared', 'offered'].forEach((mode) => {
  const badge = bar.querySelector(`.fo-mode-count[data-fo-count="${mode}"]`);
  assert(badge !== null, `${mode} has a count badge span`);
  assert(badge && btn(mode).contains(badge), `${mode} badge is inside its mode button`);
  assert(badge && badge.hasAttribute('hidden'), `${mode} badge starts hidden (zero-count default)`);
  assert(badge && badge.textContent.trim() === '', `${mode} badge starts empty`);
});

['now', 'worked'].forEach((mode) => {
  assert(bar.querySelector(`.fo-mode-count[data-fo-count="${mode}"]`) === null,
    `${mode} carries no count badge`);
});

// ---------------------------------------------------------------------------
// 2) The count updater reads client state only and is wired into the renders.
// ---------------------------------------------------------------------------
console.log('count updater is client-only and wired in');

assert(/function studioUpdateFoModeCounts\s*\(/.test(src),
  'studioUpdateFoModeCounts() is defined');

const updaterMatch = src.match(/function studioUpdateFoModeCounts[\s\S]*?\n}/);
const updater = updaterMatch ? updaterMatch[0] : '';
assert(updater !== '', 'studioUpdateFoModeCounts() body is extractable');
assert(/state\.fieldObservations\b/.test(updater) && /state\.fieldObservationMedia\b/.test(updater),
  'remembered count sums text + media state');
assert(/state\.fieldObservationProcessed\b/.test(updater) && /pdf_text/.test(updater),
  'prepared count reads processed pdf_text state');
assert(/state\.fieldObservationsOffered\b/.test(updater),
  'offered count reads the offered snapshot state');
assert(!/fetch\s*\(|rose-mirror|\.submit\s*\(/.test(updater),
  'count updater performs no fetch / submit / rose-mirror call');

// Wired into each read-only render so badges refresh with the state they mirror.
assert(/function studioRenderRememberedField[\s\S]{0,120}studioUpdateFoModeCounts/.test(src),
  'remembered render refreshes counts');
assert(/function studioRenderPreparedField[\s\S]{0,120}studioUpdateFoModeCounts/.test(src),
  'prepared render refreshes counts');
assert(/function studioRenderOfferedField[\s\S]{0,120}studioUpdateFoModeCounts/.test(src),
  'offered render refreshes counts');

// ---------------------------------------------------------------------------
// 3) Worked is a warm landing/empty state — no false claims, no auto-Nexus.
// ---------------------------------------------------------------------------
console.log('worked landing state');

const worked = doc.getElementById('fo-panel-worked');
assert(worked !== null, 'worked panel exists');
const workedEmpty = worked.querySelector('.fo-worked-empty');
assert(workedEmpty !== null, 'worked panel has a landing/empty block');
const workedText = worked.textContent.replace(/\s+/g, ' ').toLowerCase();
assert(workedText.includes('return') || workedText.includes('returned'),
  'worked copy uses "return to the field" language');
assert(workedText.includes('nothing has returned'),
  'worked states nothing has returned yet (no false claim of functionality)');
assert(/only ever sees what you (choose to )?offer/.test(workedText),
  'worked reaffirms Nexus only sees what is offered');

// The whole worked panel must not wire any Nexus submit / auto-call.
const workedHtml = worked.innerHTML;
assert(!/rose-mirror|fetch\s*\(/.test(workedHtml),
  'worked panel markup triggers no fetch / rose-mirror');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
