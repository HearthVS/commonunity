/* Test: in-preview per-room inline tune flow for Personal Home.
 *
 * Personal Home renders four navigable rooms (Work / Lens / Field /
 * Call) seeded from Compass points + Field Observations captures. Until
 * now the preview was read-only — the biggest MVP gap was no direct
 * per-room edit/tune. This slice adds a subtle "Tune this room" action
 * that opens an inline editor seeded with the room's current copy and,
 * on save, writes back through the *existing* builder capture path
 * (state.builder.captures['site-<room>']) — the same source Studio
 * Spark and Field Observations already feed — so the preview re-reads
 * the tuned words on the next render. Cancel leaves state unchanged.
 *
 * Covers:
 *   1. A tune trigger + inline form exist for rooms, with conscious
 *      "tune / shape / tend" language (no edit/manage vocabulary).
 *   2. phRoomCaptureId maps each room to its existing site-<room> key.
 *   3. phWriteRoomCapture writes the {at, prompt, excerpt, builder}
 *      shape to state.builder.captures['site-<room>'] and persists via
 *      saveState() — proven functionally against a mock state.
 *   4. Save wiring reads the textarea and calls phWriteRoomCapture;
 *      cancel/empty is fail-safe (no write, state untouched).
 *   5. The preview reads the edited capture (site-<room> via
 *      lpCaptureText) and the editor seeds from the current room copy.
 *   6. Accessibility hooks: labelled textarea, keyboard-safe buttons.
 *   7. No file-manager / task-manager language on the new surface.
 *
 * Usage:  node tests/studio-home-room-inline-tune.test.js
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
// 1) Tune trigger + inline form exist, with conscious language.
// ---------------------------------------------------------------------------
console.log('room tune trigger + inline form exist with conscious language');

const roomFnRe = /function phRenderRoom\(model, key\) \{[\s\S]*?\n      return html;\n    \}/;
const roomFn = src.match(roomFnRe);
assert(roomFn !== null, 'phRenderRoom body isolated');
const roomBody = roomFn ? roomFn[0] : '';

assert(/data-ph-tune-open="' \+ key \+ '"/.test(roomBody),
  'each room renders a per-room tune trigger keyed to the room');
assert(/>Tune this room</.test(roomBody),
  'trigger copy reads "Tune this room" (conscious, in-place tending)');
assert(/data-ph-tune-form="' \+ key \+ '"/.test(roomBody),
  'an inline tune form is rendered when the room is being tuned');
assert(/phRoomEditing === key/.test(roomBody),
  'form is shown only for the room currently being tuned (local view state)');
assert(/data-ph-tune-input="' \+ key \+ '"/.test(roomBody) && /<textarea/.test(roomBody),
  'inline editor is a textarea seeded per-room');

// ---------------------------------------------------------------------------
// 2) phRoomCaptureId maps rooms to their existing site-<room> keys.
// ---------------------------------------------------------------------------
console.log('phRoomCaptureId maps rooms to the existing builder capture keys');

const capIdRe = /function phRoomCaptureId\(key\) \{[\s\S]*?\n    \}/;
const capIdFn = src.match(capIdRe);
assert(capIdFn !== null, 'phRoomCaptureId body isolated');
const capIdBody = capIdFn ? capIdFn[0] : '';
['work', 'lens', 'field', 'call'].forEach(function (k) {
  assert(new RegExp(k + ": 'site-" + k + "'").test(capIdBody),
    'room ' + k + ' maps to existing capture key site-' + k);
});

// ---------------------------------------------------------------------------
// 3) phWriteRoomCapture writes the correct shape + persists — functional.
// ---------------------------------------------------------------------------
console.log('phWriteRoomCapture writes to state.builder.captures[site-<room>] and persists');

// Extract the two helpers and run them in a sandbox with a mock state.
const writeFnRe = /function phWriteRoomCapture\(key, text\) \{[\s\S]*?\n    \}/;
const writeFn = src.match(writeFnRe);
assert(writeFn !== null, 'phWriteRoomCapture body isolated');

let saved = 0;
const win = { state: { builder: { captures: {} } } };
const sandbox = {
  window: win,
  saveState: function () { saved++; },
  phRoomFullName: function (k) {
    return { work: 'The Work', lens: 'The Lens', field: 'The Field', call: 'The Call' }[k] || '';
  },
  Date: Date, String: String
};
// eslint-disable-next-line no-new-func
const make = new Function(
  'window', 'saveState', 'phRoomFullName',
  capIdBody + '\n' + writeFn[0] + '\nreturn phWriteRoomCapture;'
);
const phWriteRoomCapture = make(sandbox.window, sandbox.saveState, sandbox.phRoomFullName);

const ok = phWriteRoomCapture('field', '  A room of quiet green light.  ');
assert(ok === true, 'write returns true for non-empty copy');
const arr = win.state.builder.captures['site-field'];
assert(Array.isArray(arr) && arr.length === 1,
  'a single capture is appended under the existing site-field key');
const entry = arr && arr[0];
assert(entry && entry.excerpt === 'A room of quiet green light.',
  'trimmed room copy is stored as the capture excerpt (what lpCaptureText reads)');
assert(entry && typeof entry.at === 'string' && /T/.test(entry.at),
  'capture carries an ISO timestamp — matches the Field Observations shape');
assert(entry && typeof entry.prompt === 'string' && /The Field/.test(entry.prompt),
  'capture prompt records the room it was tuned from');
assert(entry && entry.builder === 'personal-home',
  'capture is tagged with the personal-home builder source');
assert(saved === 1, 'saveState() is called so the tune persists through the existing mechanism');

// most-recent capture wins: a second tune appends (does not clobber).
phWriteRoomCapture('field', 'Now warmer, amber at the edges.');
assert(win.state.builder.captures['site-field'].length === 2,
  'a second tune appends — most-recent capture is what the preview reads');
assert(win.state.builder.captures['site-field'][1].excerpt === 'Now warmer, amber at the edges.',
  'the latest tuned copy is the most-recent capture');

// ---------------------------------------------------------------------------
// 4) Save wiring calls the writer; empty/cancel is fail-safe.
// ---------------------------------------------------------------------------
console.log('save wiring writes through the capture path; cancel/empty is fail-safe');

assert(/phWriteRoomCapture\(tuneKey, field\.value\)/.test(src),
  'submit wiring reads the textarea value and writes it via phWriteRoomCapture');
assert(/data-ph-tune-cancel="' \+ tuneKey \+ '"/.test(src) || /data-ph-tune-cancel/.test(src),
  'a cancel control is wired for the open form');

const cancelWireRe = /cancelBtn\.addEventListener\('click', function \(\) \{[\s\S]*?\}\);/;
const cancelWire = src.match(cancelWireRe);
assert(cancelWire !== null && !/phWriteRoomCapture/.test(cancelWire[0]),
  'cancel path never writes a capture (state left unchanged)');
assert(cancelWire !== null && /phRoomEditing = null/.test(cancelWire[0]),
  'cancel closes the editor by clearing phRoomEditing');

// empty save is a no-op write.
const before = JSON.stringify(win.state.builder.captures['site-call'] || null);
const emptyOk = phWriteRoomCapture('call', '   ');
assert(emptyOk === false, 'empty/whitespace copy does not write a capture (fail-safe)');
assert(JSON.stringify(win.state.builder.captures['site-call'] || null) === before,
  'state.builder.captures is untouched on an empty tune');

// ---------------------------------------------------------------------------
// 5) Preview reads the edited capture; editor seeds from current copy.
// ---------------------------------------------------------------------------
console.log('preview reads the edited capture and the editor seeds from current copy');

// wpPointSection already reads each room from its site-<room> capture id.
assert(/wpPointSection\(pf, 'field', 'site-field'\)/.test(src) &&
       /wpPointSection\(pw, 'work',  'site-work'\)/.test(src),
  'buildWebsitePreview reads each room from its site-<room> capture (tuned copy re-seeds)');
assert(/var cap = lpCaptureText\(captureId\);/.test(src),
  'section copy resolves through lpCaptureText on the same capture id we write to');
assert(/var seedText = intro \|\| '';/.test(roomBody),
  'the inline editor is seeded with the room current copy (its intro)');
assert(/renderWebsitePreview\(\);\n          if \(typeof showToast/.test(src) ||
       /phRoomEditing = null;\n          renderWebsitePreview\(\);/.test(src),
  'save re-renders the preview so the freshly-tuned copy is read back');

// ---------------------------------------------------------------------------
// 6) Accessibility hooks.
// ---------------------------------------------------------------------------
console.log('accessibility: labelled field + keyboard-safe buttons');

assert(/<label class="ph-room-tune-label" for="' \+ fieldId \+ '">/.test(roomBody),
  'the textarea has an associated <label for=…>');
assert(/aria-describedby="' \+ fieldId \+ '-hint"/.test(roomBody),
  'the textarea is described by its hint for assistive tech');
assert(/type="button" class="ph-room-tune-cancel"/.test(roomBody),
  'cancel is type="button" (does not submit the form)');
assert(/type="submit" class="ph-room-tune-save"/.test(roomBody),
  'save is a real submit control (Enter-key safe)');
assert(/aria-label="Tune ' \+ lpEscape\(label\) \+ ' in place"/.test(roomBody),
  'the tune trigger carries an explicit aria-label');

// ---------------------------------------------------------------------------
// 7) No forbidden vocabularies on the new surface.
// ---------------------------------------------------------------------------
console.log('no file-manager / task-manager language on the tune surface');

const tuneCssRe = /\.ph-room-tune \{[\s\S]*?\.ph-room-tune-hint \{[^}]*\}/;
const tuneCss = src.match(tuneCssRe);
const surface = roomBody + (capIdBody || '') + (writeFn ? writeFn[0] : '') + (tuneCss ? tuneCss[0] : '');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(surface),
  'no file-manager language on the tune surface');
assert(!/(task manager|to-?do|checklist|task list)/i.test(surface),
  'no task-manager language on the tune surface');

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Personal Home room inline tune test passed.');
