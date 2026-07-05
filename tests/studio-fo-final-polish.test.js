/* Static test: Field Observations depth — final UI polish.
 *
 * Covers the last, presentational-only refinements to the central Field
 * Observations depth surface, layered on top of Slice 10 (per-mode ambience):
 *   1. The active mode tab lifts a faint underglow keyed to the mode's own
 *      --fo-mode-tint (active-state polish for mode changes).
 *   2. Keyboard focus on a mode tab borrows that same --fo-mode-tint, so
 *      tabbing feels part of the atmosphere (focus-visible accessibility).
 *   3. Switching modes settles the incoming panel in with a brief fade
 *      (fo-panel-settle), gated behind prefers-reduced-motion.
 *   4. The polish is CSS-only: prior Slice 6-10 behaviour handlers remain, and
 *      the mode switcher gains no new storage, fetch, or Nexus path.
 *
 * Static/DOM assertions over the studio.html markup and inline script; no
 * server is required.
 *
 * Usage:  node tests/studio-fo-final-polish.test.js
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

// ---------------------------------------------------------------------------
// 1) Active tab lifts a tint-keyed underglow.
// ---------------------------------------------------------------------------
console.log('active mode tab carries a tint-keyed underglow');

assert(/\.fo-mode-btn\.active\s*\{[^}]*text-shadow[^}]*--fo-mode-tint/.test(src),
  '.fo-mode-btn.active glow is keyed to --fo-mode-tint');

// ---------------------------------------------------------------------------
// 2) Keyboard focus borrows the mode's own tint (focus-visible).
// ---------------------------------------------------------------------------
console.log('keyboard focus borrows the active mode tint');

const focusRe = /\.fo-mode-btn:focus-visible\s*\{([^}]*)\}/;
const focusMatch = src.match(focusRe);
assert(focusMatch !== null, '.fo-mode-btn:focus-visible rule exists');
assert(focusMatch !== null && /--fo-mode-tint/.test(focusMatch[1]),
  ':focus-visible styling is keyed to --fo-mode-tint');

// ---------------------------------------------------------------------------
// 3) Incoming panel settles in with a reduced-motion-safe fade.
// ---------------------------------------------------------------------------
console.log('mode change settles the incoming panel in gently');

assert(/\.fo-mode-panel:not\(\[hidden\]\)\s*\{[^}]*animation:\s*fo-panel-settle/.test(src),
  'visible panel runs the fo-panel-settle animation');
assert(/@keyframes\s+fo-panel-settle\s*\{/.test(src),
  'fo-panel-settle keyframes are defined');
assert(
  /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^]*?\.fo-mode-panel:not\(\[hidden\]\)\s*\{\s*animation:\s*none/.test(src),
  'the settle animation is disabled under prefers-reduced-motion');

// ---------------------------------------------------------------------------
// 4) DOM sanity: hooks attach to the real tab/panel structure.
// ---------------------------------------------------------------------------
console.log('polish hooks attach to the real depth structure');

const dom = new JSDOM(src);
const doc = dom.window.document;
const bar = doc.getElementById('fo-mode-bar');
assert(bar !== null, 'mode bar (#fo-mode-bar) still present');
const MODES = ['now', 'remembered', 'prepared', 'offered', 'worked'];
MODES.forEach((mode) => {
  assert(bar && bar.querySelector(`.fo-mode-btn[data-fo-mode="${mode}"]`) !== null,
    `${mode} mode tab still present`);
  assert(doc.getElementById('fo-panel-' + mode) !== null,
    `${mode} panel still present`);
});

// ---------------------------------------------------------------------------
// 5) Behaviour is untouched: prior handlers remain, switcher stays view-only.
// ---------------------------------------------------------------------------
console.log('polish adds no behaviour, storage, or Nexus path');

[
  'studioUpdateFoModeCounts',
  'studioRenderRememberedField',
  'studioRenderPreparedField',
  'studioRenderOfferedField',
  'studioRenderWorkedField',
  'studioReleaseWorkedItem',
].forEach((fn) => {
  assert(new RegExp(`function ${fn}\\s*\\(`).test(src),
    `${fn}() still defined`);
});

function switcherBody() {
  const i = src.indexOf("const FO_MODE_KEY = 'fo-mode'");
  if (i < 0) return '';
  const j = src.indexOf('})();', i);
  return j < 0 ? src.slice(i) : src.slice(i, j);
}
const switcher = switcherBody();
assert(switcher !== '', 'mode switcher body is extractable');
assert(!/sessionStorage|indexedDB|document\s*\.\s*cookie/.test(switcher),
  'switcher still uses no sessionStorage / indexedDB / cookies');
assert((switcher.match(/localStorage/g) || []).length <= 2,
  'switcher keeps only its pre-existing fo-mode localStorage memory');
assert(!/rose-mirror|\.submit\s*\(|fetch\s*\(/.test(switcher),
  'switcher never fetches, submits, or calls /rose-mirror (no Nexus path)');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
