/* Test: "Tuned in hOMe" provenance signal for Personal Home rooms.
 *
 * PR #124 gave Personal Home rooms an inline tune flow that writes copy
 * back through the existing builder capture path, tagging each capture
 * with builder:'personal-home'. Until now that marker was invisible: a
 * room the person shaped directly in hOMe looked identical to one seeded
 * from Compass or answered in Field Observations (both surface as the
 * "captured"/"mixed" source tag).
 *
 * This slice adds a subtle, read-only provenance signal — "Tuned in
 * hOMe" — shown only when a room's *most-recent* site-<room> capture
 * carries the personal-home builder marker. It reuses the same
 * "latest capture wins" rule lpCaptureText uses, so the signal clears
 * the moment newer content arrives from another source. No schema,
 * backend, or source-model changes.
 *
 * Covers:
 *   1. phRoomTunedInHome exists and is functionally correct against a
 *      mock state: latest personal-home capture → true.
 *   2. A room whose latest capture is NOT personal-home (Field
 *      Observations / Studio Spark shape) → false (signal does not
 *      leak onto non-tuned rooms).
 *   3. Missing / empty / malformed captures fail safe → false.
 *   4. phRenderRoom renders the "Tuned in hOMe" marker guarded by
 *      phRoomTunedInHome(key), alongside the existing source tag.
 *   5. Conscious-interface tone; no file-manager / task-manager
 *      language on the new surface.
 *
 * Usage:  node tests/studio-home-room-tuned-provenance.test.js
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
// Isolate the two helpers and run them in a sandbox with a mock state.
// ---------------------------------------------------------------------------
console.log('phRoomTunedInHome resolves provenance from the latest capture');

const capIdRe = /function phRoomCaptureId\(key\) \{[\s\S]*?\n    \}/;
const capIdFn = src.match(capIdRe);
assert(capIdFn !== null, 'phRoomCaptureId body isolated');

const tunedFnRe = /function phRoomTunedInHome\(key\) \{[\s\S]*?\n    \}/;
const tunedFn = src.match(tunedFnRe);
assert(tunedFn !== null, 'phRoomTunedInHome body isolated');

const win = { state: { builder: { captures: {} } } };
// eslint-disable-next-line no-new-func
const make = new Function(
  'window',
  (capIdFn ? capIdFn[0] : '') + '\n' + (tunedFn ? tunedFn[0] : '') +
  '\nreturn phRoomTunedInHome;'
);
const phRoomTunedInHome = make(win);

// 1) Latest capture is a personal-home tune → true.
win.state.builder.captures['site-field'] = [
  { at: '2026-07-01T00:00:00.000Z', excerpt: 'Seeded from Compass.', builder: 'compass' },
  { at: '2026-07-02T00:00:00.000Z', excerpt: 'Shaped in hOMe.', builder: 'personal-home' }
];
assert(phRoomTunedInHome('field') === true,
  'room whose most-recent capture is a personal-home tune shows the signal');

// 2) Latest capture from another source → false (does not leak).
console.log('signal does not appear for seeded/captured rooms from other sources');
win.state.builder.captures['site-work'] = [
  { at: '2026-07-01T00:00:00.000Z', excerpt: 'Tuned once.', builder: 'personal-home' },
  { at: '2026-07-03T00:00:00.000Z', excerpt: 'Later answered in Field Observations.', builder: 'field-observation' }
];
assert(phRoomTunedInHome('work') === false,
  'a later Field-Observation capture clears the tuned signal (latest wins)');

win.state.builder.captures['site-lens'] = [
  { at: '2026-07-01T00:00:00.000Z', excerpt: 'From a Studio Spark.' } // no builder marker
];
assert(phRoomTunedInHome('lens') === false,
  'a capture with no builder marker is not treated as tuned-in-hOMe');

// 3) Missing / empty / malformed → fail safe to false.
console.log('missing / empty / malformed captures fail safe');
assert(phRoomTunedInHome('call') === false,
  'a room with no captures at all does not show the signal');
win.state.builder.captures['site-call'] = [];
assert(phRoomTunedInHome('call') === false,
  'an empty capture array fails safe');
win.state.builder.captures['site-call'] = [null];
assert(phRoomTunedInHome('call') === false,
  'a null/malformed capture entry fails safe (no throw)');
assert(phRoomTunedInHome('nope') === false,
  'an unknown room key (no capture id) fails safe');

// A torn-down state must not throw.
const bareWin = {};
const phRoomTunedInHomeBare = (new Function(
  'window',
  (capIdFn ? capIdFn[0] : '') + '\n' + (tunedFn ? tunedFn[0] : '') +
  '\nreturn phRoomTunedInHome;'
))(bareWin);
assert(phRoomTunedInHomeBare('field') === false,
  'missing window.state.builder.captures fails safe to false');

// ---------------------------------------------------------------------------
// 4) phRenderRoom renders the marker, guarded by phRoomTunedInHome(key).
// ---------------------------------------------------------------------------
console.log('phRenderRoom renders the "Tuned in hOMe" marker, guarded by the check');

const roomFnRe = /function phRenderRoom\(model, key\) \{[\s\S]*?\n      return html;\n    \}/;
const roomFn = src.match(roomFnRe);
assert(roomFn !== null, 'phRenderRoom body isolated');
const roomBody = roomFn ? roomFn[0] : '';

assert(/if \(phRoomTunedInHome\(key\)\) \{/.test(roomBody),
  'the marker is rendered only when phRoomTunedInHome(key) is true');
assert(/>Tuned in hOMe</.test(roomBody),
  'the provenance marker reads "Tuned in hOMe" (conscious-interface tone)');
assert(/class="ph-room-tuned"/.test(roomBody),
  'the marker uses a dedicated ph-room-tuned class (subtle, source-aligned)');
assert(/lpSourceTag\(sec\.source\)/.test(roomBody),
  'the existing source tag is preserved — the marker augments, not replaces');

// The marker must sit inside the guard block, not render unconditionally.
const guardBlock = roomBody.match(/if \(phRoomTunedInHome\(key\)\) \{([\s\S]*?)\}/);
assert(guardBlock !== null && /ph-room-tuned/.test(guardBlock[1]),
  'the ph-room-tuned span is emitted from inside the provenance guard');

// ---------------------------------------------------------------------------
// 5) Styling exists + no forbidden vocabulary on the new surface.
// ---------------------------------------------------------------------------
console.log('subtle styling present; no file-manager / task-manager language');

assert(/\.ph-room-tuned \{[\s\S]*?\}/.test(src),
  'a .ph-room-tuned style rule exists (subtle provenance chip)');

const tunedCss = src.match(/\.ph-room-tuned \{[\s\S]*?\.ph-room-tuned::before[^}]*\}/);
const surface = roomBody + (tunedFn ? tunedFn[0] : '') + (tunedCss ? tunedCss[0] : '');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(surface),
  'no file-manager language on the provenance surface');
assert(!/(task manager|to-?do|checklist|task list)/i.test(surface),
  'no task-manager language on the provenance surface');

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Personal Home room tuned-provenance signal test passed.');
