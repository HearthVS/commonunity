/* Static test: Field Observations depth — Slice 13 (Offered as a threshold).
 *
 * Covers the clarity + controls pass over the central Offered mode:
 *   1. Offered reads as a threshold / review snapshot of intentional hand-offs,
 *      explicitly distinct from Remembered (durable) and Worked (returned) —
 *      not a durable archive or hidden log.
 *   2. A safe, explicit "Release recent offerings" control clears ONLY the
 *      offered snapshot (state.fieldObservationsOffered + its own localStorage
 *      key) and refreshes the Offered render / mode counts. It confirms first,
 *      states it cannot be undone, and no-ops when nothing is offered.
 *   3. Clearing never touches Remembered observations/media, Prepared artifacts,
 *      or Worked returns.
 *   4. The re-place action stays explicit (populate-only) and Offered's consent
 *      boundary is preserved: no fetch, no auto-submit, no /rose-mirror, and no
 *      NEW browser storage beyond the pre-existing offered localStorage mirror.
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
const renderMatch = src.match(/function studioRenderOfferedField[\s\S]*?\n}/);
const render = renderMatch ? renderMatch[0] : '';
const clearMatch = src.match(/function studioClearOffered[\s\S]*?\n}/);
const clearFn = clearMatch ? clearMatch[0] : '';

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
// It must not sell itself as a permanent store / archive / log.
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
// Safe: confirms first and states it cannot be undone; no-ops when empty.
assert(/window\.confirm/.test(clearFn) && /cannot be undone|undone/.test(clearFn),
  'release confirms with the member and states it cannot be undone');
assert(/if\s*\(\s*!list\.length\s*\)\s*return/.test(clearFn),
  'release no-ops when nothing has been offered');

// ---------------------------------------------------------------------------
// 3) Clearing affects ONLY offered state + count, nothing durable.
// ---------------------------------------------------------------------------
console.log('release affects only offered state + count, never durable state');

assert(/state\.fieldObservationsOffered\s*=\s*\[\]/.test(clearFn),
  'release empties the offered snapshot (state.fieldObservationsOffered = [])');
assert(/localStorage\.removeItem\(\s*foOfferedKey\(\)\s*\)/.test(clearFn),
  'release removes only the offered localStorage key (foOfferedKey)');
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
// It only removes storage; it never writes new offered records.
assert(!/localStorage\.setItem/.test(clearFn),
  'release only removes storage — it never writes offered records');

// The count updater still reads offered length as client-only state.
const updater = (src.match(/function studioUpdateFoModeCounts[\s\S]*?\n}/) || [''])[0];
assert(/state\.fieldObservationsOffered\b/.test(updater),
  'the mode-count updater reads offered state so clearing drops its badge');

// ---------------------------------------------------------------------------
// 4) Re-place stays explicit; consent boundary preserved (no new storage/Nexus).
// ---------------------------------------------------------------------------
console.log('re-place stays explicit and the consent boundary holds');

assert(/fo-offered-replay-btn/.test(render) &&
  /Place in Nexus input again|Place in the Nexus input again/.test(render),
  'the re-place action remains an explicit "Place in Nexus input again" button');
// Replay populates only — it passes no offer metadata and never submits.
assert(/studioPopulateNexusInput\(String\(item\.text/.test(render),
  're-place routes through studioPopulateNexusInput (populate-only, no offer arg)');

// Neither the render nor the clear path may fetch, submit, or call rose-mirror.
// Strip line comments first so a comment *mentioning* the boundary (e.g. "no
// /rose-mirror") is not mistaken for an actual call.
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '');
const renderCode = stripComments(render);
const clearCode = stripComments(clearFn);
assert(!/fetch\s*\(/.test(renderCode) && !/fetch\s*\(/.test(clearCode),
  'neither offered render nor release performs a fetch');
assert(!/rose-mirror/.test(renderCode) && !/rose-mirror/.test(clearCode),
  'neither offered render nor release calls /rose-mirror');
assert(!/\.submit\s*\(/.test(render) && !/\.submit\s*\(/.test(clearFn),
  'neither offered render nor release auto-submits');
// No NEW browser storage: the render never writes storage, and clear only
// removes the pre-existing offered key (never sessionStorage/indexedDB/cookies).
assert(!/localStorage\.setItem|sessionStorage|indexedDB|document\s*\.\s*cookie/.test(render),
  'offered render adds no browser storage');
assert(!/sessionStorage|indexedDB|document\s*\.\s*cookie/.test(clearFn),
  'release uses no sessionStorage / indexedDB / cookies');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
