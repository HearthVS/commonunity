/* Static test: Field Observations depth — Slice 10 (per-mode ambience).
 *
 * Covers the subtle visual differentiation of the central Field Observations
 * depth modes (Now, Remembered, Prepared, Offered, Worked):
 *   1. Each mode owns a distinct style hook: a per-mode --fo-mode-tint on both
 *      the mode button and the surface's [data-fo-active-mode] state.
 *   2. The active tab and the surface frame borrow the active mode's tint, and
 *      the reflective modes carry an ambient wash — restrained, readable.
 *   3. The mode switcher sets [data-fo-active-mode] on the notepad surface.
 *   4. All prior behaviour handlers (Slices 6-9) remain wired.
 *   5. The consent boundary is preserved: the ambience work introduces no
 *      browser storage beyond the pre-existing mode memory, and no auto-Nexus.
 *
 * Static/DOM assertions over the studio.html markup and inline script; no
 * server is required.
 *
 * Usage:  node tests/studio-fo-mode-ambience.test.js
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

const MODES = ['now', 'remembered', 'prepared', 'offered', 'worked'];

// ---------------------------------------------------------------------------
// 1) Each mode declares a distinct per-mode tint hook (button + surface).
// ---------------------------------------------------------------------------
console.log('each mode owns a distinct --fo-mode-tint style hook');

MODES.forEach((mode) => {
  const btnRe = new RegExp(
    `\\.fo-mode-btn\\[data-fo-mode="${mode}"\\][^{]*\\{[^}]*--fo-mode-tint`);
  assert(btnRe.test(src),
    `${mode} button defines its own --fo-mode-tint`);
  const surfRe = new RegExp(
    `\\.notepad-surface\\[data-fo-active-mode="${mode}"\\][^{]*\\{[^}]*--fo-mode-tint`);
  assert(surfRe.test(src),
    `${mode} surface state defines its own --fo-mode-tint`);
});

// The four reflective modes must resolve to visibly different hues (Now stays
// neutral on the app accent). Pull each surface tint value and confirm no two
// reflective modes collide.
function surfaceTint(mode) {
  const m = src.match(new RegExp(
    `\\.notepad-surface\\[data-fo-active-mode="${mode}"\\][^{]*\\{\\s*--fo-mode-tint:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}
const reflective = ['remembered', 'prepared', 'offered', 'worked'];
const tints = reflective.map(surfaceTint);
assert(tints.every((t) => t && /hsl\(/.test(t)),
  'reflective modes use explicit hsl() tints');
assert(new Set(tints).size === reflective.length,
  'each reflective mode uses a distinct tint value');

// ---------------------------------------------------------------------------
// 2) The active tab + frame consume the tint; reflective modes get a wash.
// ---------------------------------------------------------------------------
console.log('active tab, frame, and ambient wash consume the mode tint');

assert(/\.fo-mode-btn\.active\s*\{[^}]*var\(--fo-mode-tint/.test(src),
  'the active tab colour/border derive from --fo-mode-tint');
assert(/\.notepad-surface\[data-fo-active-mode\]\s+\.fo-mode-bar\s*\{[^}]*--fo-mode-tint/.test(src),
  'the mode bar frame border derives from --fo-mode-tint');
assert(/data-fo-active-mode="remembered"[\s\S]{0,360}background-image:\s*linear-gradient/.test(src),
  'reflective modes carry a subtle ambient wash (linear-gradient)');
assert(/data-fo-active-mode="remembered"[\s\S]{0,360}border-color:\s*color-mix[^;]*--fo-mode-tint/.test(src),
  'reflective modes tint the surface frame border with the mode tint');
// "Now" is the grounded home: it must not receive the reflective wash block.
assert(!/data-fo-active-mode="now"[\s\S]{0,360}background-image:\s*linear-gradient/.test(src),
  'Now stays grounded/neutral — no ambient wash');

// ---------------------------------------------------------------------------
// 3) The switcher applies [data-fo-active-mode] to the notepad surface.
// ---------------------------------------------------------------------------
console.log('mode switcher tints the surface');

assert(/bar\.closest\('\.notepad-surface'\)/.test(src),
  'switcher resolves the enclosing notepad surface');
assert(/setAttribute\('data-fo-active-mode',\s*mode\)/.test(src),
  'switcher sets data-fo-active-mode to the active mode');

// DOM sanity: the surface actually wraps the mode bar, so the hook can attach.
const dom = new JSDOM(src);
const doc = dom.window.document;
const bar = doc.getElementById('fo-mode-bar');
assert(bar !== null, 'mode bar (#fo-mode-bar) exists');
assert(bar && bar.closest('.notepad-surface') !== null,
  'mode bar is nested inside a .notepad-surface (attribute target present)');
MODES.forEach((mode) => {
  const btn = bar.querySelector(`.fo-mode-btn[data-fo-mode="${mode}"]`);
  assert(btn !== null, `${mode} mode button still present`);
});

// ---------------------------------------------------------------------------
// 4) All prior Slice 6-9 behaviour handlers remain wired (no regression).
// ---------------------------------------------------------------------------
console.log('prior behaviour handlers remain present');

[
  'studioUpdateFoModeCounts',      // Slice 6 — mode counts
  'studioRenderRememberedField',   // Remembered mirror
  'studioRenderPreparedField',     // Prepared / PDF text
  'studioRenderOfferedField',      // Offered snapshot
  'studioRenderWorkedField',       // Worked landing
  'studioReleaseWorkedItem',       // Slice 9 — Release from Worked
].forEach((fn) => {
  assert(new RegExp(`function ${fn}\\s*\\(`).test(src),
    `${fn}() still defined`);
});
assert(/data-fo-count="worked"/.test(src), 'worked count badge still present');
assert(/fo-worked-release-btn/.test(src), 'release-from-worked action still present');

// ---------------------------------------------------------------------------
// 5) Consent boundary: ambience adds no new storage and no auto-Nexus.
// ---------------------------------------------------------------------------
console.log('ambience preserves the consent boundary');

// The mode switcher is allowed exactly its pre-existing localStorage memory of
// the chosen mode (fo-mode). Confirm no NEW storage surface was introduced by
// counting localStorage uses inside the switcher IIFE.
function switcherBody() {
  const i = src.indexOf("const FO_MODE_KEY = 'fo-mode'");
  if (i < 0) return '';
  const j = src.indexOf('})();', i);
  return j < 0 ? src.slice(i) : src.slice(i, j);
}
const switcher = switcherBody();
assert(switcher !== '', 'mode switcher body is extractable');
assert(!/sessionStorage|indexedDB|document\s*\.\s*cookie/.test(switcher),
  'switcher uses no sessionStorage / indexedDB / cookies');
assert((switcher.match(/localStorage/g) || []).length <= 2,
  'switcher keeps only its pre-existing fo-mode localStorage memory');
assert(!/rose-mirror|\.submit\s*\(/.test(switcher),
  'switcher never calls /rose-mirror and never auto-submits (no Nexus path)');
assert(!/fetch\s*\(/.test(switcher),
  'switcher performs no fetch (view-only mode change)');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
