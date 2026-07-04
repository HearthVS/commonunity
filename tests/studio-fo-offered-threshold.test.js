/* Static test: Field Observations depth — Slice 13 (Offered as a threshold).
 *
 * Covers the clarity + controls pass over the central Offered mode, and the
 * normalization of Offered to session-only, in-memory state (no browser
 * storage — matching the Worked model, and the webapp constraint that rejects
 * localStorage / sessionStorage / indexedDB / cookies for this series):
 *   1. Offered reads as a threshold / review snapshot of intentional hand-offs,
 *      explicitly distinct from Remembered (durable) and Worked (returned) —
 *      not a durable archive or hidden log — and clears on reload.
 *   2. A safe, explicit "Release recent offerings" control clears ONLY the
 *      in-memory offered snapshot (state.fieldObservationsOffered) and refreshes
 *      the Offered render / mode counts. It confirms first, states it cannot be
 *      undone, and no-ops when nothing is offered.
 *   3. Clearing never touches Remembered observations/media, Prepared artifacts,
 *      or Worked returns.
 *   4. The re-place action stays explicit (populate-only) and the entire Offered
 *      code path (load / record / render / clear) uses NO browser storage, never
 *      auto-submits, and never triggers /rose-mirror.
 *
 * Static/DOM assertions over studio.html markup and its inline script; no
 * server required.
 *
 * Usage:  node tests/studio-fo-offered-threshold.test.js
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

// Extract the relevant function bodies once for scoped checks.
const grab = (name) => (src.match(new RegExp('function ' + name + '[\\s\\S]*?\\n}')) || [''])[0];
const render = grab('studioRenderOfferedField');
const clearFn = grab('studioClearOffered');
const loadFn = grab('studioLoadOffered');
const recordFn = grab('studioRecordOffered');

// Strip line comments so a comment *mentioning* a boundary (e.g. "no
// localStorage", "no /rose-mirror") is never mistaken for an actual call.
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '');
const STORAGE_RE = /localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie/;

// ---------------------------------------------------------------------------
// 1) Offered reads as a threshold snapshot, distinct from Remembered / Worked.
// ---------------------------------------------------------------------------
console.log('offered copy frames a threshold snapshot, not a durable archive');

const dom = new JSDOM(src);
const doc = dom.window.document;
const panel = doc.getElementById('fo-panel-offered');
assert(panel !== null, 'offered panel exists');
const panelText = panel.textContent.replace(/\s+/g, ' ').toLowerCase();

assert(/threshold/.test(panelText),
  'offered copy calls itself a threshold');
assert(/snapshot/.test(panelText),
  'offered copy calls itself a (review) snapshot');
assert(/remembered/.test(panelText) && /worked/.test(panelText),
  'offered copy names Remembered and Worked to distinguish itself from them');
assert(/durabl/.test(panelText),
  'offered copy contrasts itself with what is durable');
assert(/reload|session/.test(panelText),
  'offered copy signals it is session-scoped (clears on reload)');
assert(!/durable archive|permanent (record|archive|log)|hidden log/.test(panelText),
  'offered copy does not present itself as a durable archive / permanent log');
assert(/nexus only sees what you offer/.test(panelText),
  'offered panel reaffirms Nexus only sees what you offer');

// ---------------------------------------------------------------------------
// 2) An explicit "Release recent offerings" control exists and is wired.
// ---------------------------------------------------------------------------
console.log('an explicit release-offerings control exists and is wired');

assert(render !== '', 'studioRenderOfferedField() body is extractable');
assert(/fo-offered-clear-btn/.test(render),
  'the offered render emits a release control (.fo-offered-clear-btn)');
assert(/Release recent offerings|Clear recent offerings/.test(render),
  'the control uses aligned "Release recent offerings" / "Clear recent offerings" language');
assert(/studioClearOffered\s*\(/.test(render),
  'the release control click is wired to studioClearOffered()');

assert(clearFn !== '', 'studioClearOffered() is defined');
assert(/window\.confirm/.test(clearFn) && /cannot be undone|undone/.test(clearFn),
  'release confirms with the member and states it cannot be undone');
assert(/if\s*\(\s*!list\.length\s*\)\s*return/.test(clearFn),
  'release no-ops when nothing has been offered');

// ---------------------------------------------------------------------------
// 3) Clearing affects ONLY in-memory offered state + count, nothing durable.
// ---------------------------------------------------------------------------
console.log('release affects only offered state + count, never durable state');

assert(/state\.fieldObservationsOffered\s*=\s*\[\]/.test(clearFn),
  'release empties the offered snapshot (state.fieldObservationsOffered = [])');
assert(/studioRenderOfferedField\s*\(|studioUpdateFoModeCounts\s*\(/.test(clearFn),
  'release refreshes the offered render / mode counts');
// It must NOT touch Remembered, Prepared, Worked, or media state.
assert(!/state\.fieldObservations\b(?!Offered)/.test(clearFn),
  'release never mutates Remembered/durable observation state');
assert(!/state\.fieldObservationMedia\b/.test(clearFn),
  'release never touches media state');
assert(!/state\.fieldObservationProcessed\b/.test(clearFn),
  'release never touches Prepared (processed) state');
assert(!/state\.fieldObservationsWorked/.test(clearFn),
  'release never touches Worked state');

// The count updater still reads offered length as client-only state.
const updater = grab('studioUpdateFoModeCounts');
assert(/state\.fieldObservationsOffered\b/.test(updater),
  'the mode-count updater reads offered state so clearing drops its badge');

// ---------------------------------------------------------------------------
// 4) Session-only: the WHOLE offered path uses no browser storage; re-place
//    stays explicit; no auto-submit and no /rose-mirror.
// ---------------------------------------------------------------------------
console.log('offered is session-only (no storage) and preserves the consent boundary');

assert(loadFn !== '' && recordFn !== '', 'load + record bodies are extractable');
// No foOfferedKey helper / offered storage key survives anywhere in the file.
assert(!/foOfferedKey/.test(src),
  'the legacy foOfferedKey() storage-key helper is gone from studio.html');
assert(!/['"]fo-offered:/.test(src),
  'no "fo-offered:" storage key literal remains in studio.html');

// Every offered function is storage-free (comments stripped so the explicit
// "no localStorage" notes do not trip the check).
[['load', loadFn], ['record', recordFn], ['render', render], ['clear', clearFn]].forEach(([n, body]) => {
  assert(!STORAGE_RE.test(stripComments(body)),
    `studio offered ${n} path uses no localStorage / sessionStorage / indexedDB / cookies`);
});
// Record and clear both keep offered purely in JS state.
assert(/state\.fieldObservationsOffered\s*=/.test(recordFn),
  'record keeps offered material in in-memory state');
assert(/Array\.isArray\(state\.fieldObservationsOffered\)/.test(loadFn),
  'load initializes offered from in-memory state (not from storage)');

// Re-place stays an explicit, populate-only action.
assert(/fo-offered-replay-btn/.test(render) &&
  /Place in Nexus input again|Place in the Nexus input again/.test(render),
  'the re-place action remains an explicit "Place in Nexus input again" button');
assert(/studioPopulateNexusInput\(String\(item\.text/.test(render),
  're-place routes through studioPopulateNexusInput (populate-only, no offer arg)');

// No fetch / submit / rose-mirror anywhere in load / record / render / clear.
[['load', loadFn], ['record', recordFn], ['render', render], ['clear', clearFn]].forEach(([n, body]) => {
  const code = stripComments(body);
  assert(!/fetch\s*\(/.test(code), `offered ${n} path performs no fetch`);
  assert(!/rose-mirror/.test(code), `offered ${n} path never calls /rose-mirror`);
  assert(!/\.submit\s*\(/.test(code), `offered ${n} path never auto-submits`);
});

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
