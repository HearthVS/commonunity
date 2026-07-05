/* Static + functional test: Studio Spark Awaiting target-tag reflection.
 *
 * Closes the readiness loop opened by PR #119 (seeded-field band) and
 * PR #120 (Spark draw biases toward Awaiting rooms). When no room is
 * active and the draw lands on a room the readiness model still marks
 * Awaiting (section source === 'empty'), the Spark widget's "For · …"
 * target tag now says so — a subtle "· Awaiting" suffix plus an
 * is-awaiting class — so the person sees *why* this prompt rose.
 *
 * Covers:
 *   1. sparkRoomAwaiting() helper is defined and gates on both no
 *      active room AND the room being Awaiting.
 *   2. renderSpark() wires the helper into the target tag: toggles the
 *      is-awaiting class and appends the "· Awaiting" suffix.
 *   3. Scoped CSS state (.spark-tag.target.is-awaiting) exists and
 *      leans on shared tokens; no file-manager language introduced.
 *   4. Functional — sparkRoomAwaiting only fires at the entrance for an
 *      Awaiting room, and fails safe to false when the model is
 *      unavailable (empty awaiting list).
 *
 * Static/DOM assertions over the studio.html markup + a functional
 * extraction of the pure helper; no server is required.
 *
 * Usage:  node tests/studio-spark-awaiting-tag.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

// ---------------------------------------------------------------------------
// 1) Helper exists and gates on entrance + Awaiting.
// ---------------------------------------------------------------------------
console.log('sparkRoomAwaiting() helper is defined and gated');

assert(/function\s+sparkRoomAwaiting\s*\(/.test(src), 'sparkRoomAwaiting() defined');

const helperRe = /function sparkRoomAwaiting\(s, activeKey, awaiting\) \{[\s\S]*?\n    \}/;
const helperMatch = src.match(helperRe);
assert(helperMatch !== null, 'sparkRoomAwaiting body isolated');
const helperBody = helperMatch ? helperMatch[0] : '';
assert(/if \(activeKey\) return false;/.test(helperBody),
  'helper returns false when a room is active (only reflects at the entrance)');
assert(/awaiting\.indexOf\(s\.section\)/.test(helperBody),
  'helper checks the Spark\'s room against the Awaiting list');

// ---------------------------------------------------------------------------
// 2) renderSpark wires the helper into the target tag.
// ---------------------------------------------------------------------------
console.log('renderSpark() reflects Awaiting on the target tag');

const drawRe = /function renderSpark\(s, reanimate\) \{[\s\S]*?\n    \}/;
const drawMatch = src.match(drawRe);
assert(drawMatch !== null, 'renderSpark body isolated');
const render = drawMatch ? drawMatch[0] : '';

assert(/sparkRoomAwaiting\(s, getActiveRoomKey\(\), phAwaitingRooms\(\)\)/.test(render),
  'renderSpark computes Awaiting state from the live readiness model');
assert(/awaitingHere \? ' · Awaiting' : ''/.test(render),
  'target tag appends the "· Awaiting" suffix only when Awaiting');
assert(/targetEl\.classList\.toggle\('is-awaiting', awaitingHere\)/.test(render),
  'target tag toggles the is-awaiting class with the same flag');

// ---------------------------------------------------------------------------
// 3) CSS state exists; conscious language preserved.
// ---------------------------------------------------------------------------
console.log('is-awaiting CSS state exists and avoids file-manager language');

const cssRe = /\.spark-tag\.target\.is-awaiting\s*\{([^}]*)\}/;
const css = src.match(cssRe);
assert(css !== null, '.spark-tag.target.is-awaiting rule exists');
assert(css !== null && /--rose-color/.test(css[1]),
  'is-awaiting state tints from the shared --rose-color token');

// Guard the vocabulary of the new surface (helper + render logic + CSS).
const surface = helperBody + render + (css ? css[0] : '');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(surface),
  'no file-manager language in the Awaiting tag surface');
assert(/Awaiting/.test(render), 'surface uses the conscious "Awaiting" readiness vocabulary');

// ---------------------------------------------------------------------------
// 4) Functional — helper fires only at the entrance and fails safe.
// ---------------------------------------------------------------------------
console.log('sparkRoomAwaiting fires only at the entrance for an Awaiting room');

let sparkRoomAwaiting = null;
if (helperMatch) {
  // eslint-disable-next-line no-new-func
  sparkRoomAwaiting = new Function(helperBody + '\nreturn sparkRoomAwaiting;')();
}
assert(typeof sparkRoomAwaiting === 'function', 'sparkRoomAwaiting evaluates to a function');

if (typeof sparkRoomAwaiting === 'function') {
  const spark = { section: 'lens' };

  assert(sparkRoomAwaiting(spark, null, ['work', 'lens']) === true,
    'entrance + room Awaiting → true (explains the biased prompt)');
  assert(sparkRoomAwaiting(spark, null, ['work', 'field']) === false,
    'entrance + room not Awaiting → false');
  assert(sparkRoomAwaiting(spark, 'lens', ['work', 'lens']) === false,
    'a room is active → false even if that room is Awaiting');
  assert(sparkRoomAwaiting(spark, null, []) === false,
    'empty Awaiting list (model unavailable) → false (fails safe)');
  assert(sparkRoomAwaiting(null, null, ['lens']) === false,
    'missing Spark → false (fails safe)');
}

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Studio Spark Awaiting target-tag test passed.');
