/* Static test: Field Observations depth — Slice 7 (Return to Field).
 *
 * Covers the first explicit bridge from Nexus work back into Field
 * Observations:
 *   1. A "Return to Field" action rendered beside each Nexus response. It is the
 *      ONLY path that returns Nexus work into the field and it fires solely on a
 *      human click — no auto-capture, no /rose-mirror, no submit.
 *   2. A client-only, member-scoped Worked snapshot
 *      (state.fieldObservationsWorked, mirrored to localStorage) that the return
 *      action feeds. It is distinct from Remembered/Prepared/Offered and is NOT
 *      persisted server-side or sent back to Nexus.
 *   3. The Worked mode gains a live count badge; the Worked panel renders
 *      returned material and otherwise falls back to the warm empty state.
 *
 * These are static/DOM assertions over the studio.html markup and inline
 * script; no server is required.
 *
 * Usage:  node tests/studio-fo-worked-return-to-field.test.js
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
// 1) Worked now carries a count badge alongside the other countable modes.
// ---------------------------------------------------------------------------
console.log('worked count badge');

const bar = doc.getElementById('fo-mode-bar');
assert(bar !== null, 'mode bar (#fo-mode-bar) exists');
function btn(mode) { return bar.querySelector(`.fo-mode-btn[data-fo-mode="${mode}"]`); }

const workedBadge = bar.querySelector('.fo-mode-count[data-fo-count="worked"]');
assert(workedBadge !== null, 'worked has a count badge span');
assert(workedBadge && btn('worked').contains(workedBadge), 'worked badge is inside its mode button');
assert(workedBadge && workedBadge.hasAttribute('hidden'), 'worked badge starts hidden (zero-count default)');
assert(workedBadge && workedBadge.textContent.trim() === '', 'worked badge starts empty');

// "Now" still carries no badge (only Now stays badge-less now).
assert(bar.querySelector('.fo-mode-count[data-fo-count="now"]') === null,
  'now carries no count badge');

// ---------------------------------------------------------------------------
// 2) The count updater now reads the worked snapshot, still client-only.
// ---------------------------------------------------------------------------
console.log('count updater reads worked state, client-only');

const updaterMatch = src.match(/function studioUpdateFoModeCounts[\s\S]*?\n}/);
const updater = updaterMatch ? updaterMatch[0] : '';
assert(updater !== '', 'studioUpdateFoModeCounts() body is extractable');
assert(/state\.fieldObservationsWorked\b/.test(updater),
  'worked count reads the worked snapshot state');
assert(!/fetch\s*\(|rose-mirror|\.submit\s*\(/.test(updater),
  'count updater performs no fetch / submit / rose-mirror call');

// ---------------------------------------------------------------------------
// 3) The Worked panel is a render host with a warm empty-state default.
// ---------------------------------------------------------------------------
console.log('worked panel render host + empty state preserved');

const worked = doc.getElementById('fo-panel-worked');
assert(worked !== null, 'worked panel exists');
const workedBody = doc.getElementById('fo-worked-body');
assert(workedBody !== null, 'worked panel has a render host (#fo-worked-body)');
const workedEmpty = worked.querySelector('.fo-worked-empty');
assert(workedEmpty !== null, 'worked panel keeps a landing/empty block as default');
const workedText = worked.textContent.replace(/\s+/g, ' ').toLowerCase();
assert(workedText.includes('return to field') || workedText.includes('return to the field') || workedText.includes('return'),
  'worked copy uses "Return to Field" language');
assert(workedText.includes('nothing has returned'),
  'worked default states nothing has returned yet (no false claim of functionality)');
assert(/only ever sees what you (choose to )?offer/.test(workedText),
  'worked reaffirms Nexus only sees what is offered');
// The whole worked panel markup must not wire any Nexus submit / auto-call.
assert(!/rose-mirror|fetch\s*\(/.test(worked.innerHTML),
  'worked panel markup triggers no fetch / rose-mirror');

// ---------------------------------------------------------------------------
// 4) Return-to-Field action exists ONLY as an explicit, human-click bridge.
// ---------------------------------------------------------------------------
console.log('return-to-field is explicit and non-automatic');

assert(/function studioMakeReturnToFieldBtn\s*\(/.test(src),
  'studioMakeReturnToFieldBtn() (the return action builder) is defined');
const btnMatch = src.match(/function studioMakeReturnToFieldBtn[\s\S]*?\n}/);
const btnFn = btnMatch ? btnMatch[0] : '';
assert(/Return to Field/.test(btnFn), 'button label reads "Return to Field"');
assert(/addEventListener\(\s*['"]click['"]/.test(btnFn),
  'return action is wired to a click handler (deliberate human action)');
assert(/studioReturnWorkedToField\s*\(/.test(btnFn),
  'clicking the return action records into the worked field');
// The builder must not itself submit, fetch, or call Nexus.
assert(!/fetch\s*\(|rose-mirror|mirror-send|\.submit\s*\(/.test(btnFn),
  'return action builder performs no fetch / submit / rose-mirror');

// It is appended beside rose responses (both the history render and the live
// streamed response), never for user messages.
assert((src.match(/studioMakeReturnToFieldBtn\(text\)/g) || []).length >= 2,
  'return action is attached to Nexus responses in both render paths');

// ---------------------------------------------------------------------------
// 5) The worked store is client-only (localStorage), never a server/Nexus call.
// ---------------------------------------------------------------------------
console.log('worked store is client-only and never re-sends to Nexus');

assert(/function studioReturnWorkedToField\s*\(/.test(src),
  'studioReturnWorkedToField() is defined');
const returnFnMatch = src.match(/function studioReturnWorkedToField[\s\S]*?\n}/);
const returnFn = returnFnMatch ? returnFnMatch[0] : '';
assert(/localStorage\.setItem/.test(returnFn),
  'returned work is stored client-side via localStorage');
assert(/state\.fieldObservationsWorked/.test(returnFn),
  'returned work populates the worked snapshot state');
assert(!/fetch\s*\(|rose-mirror|\.submit\s*\(/.test(returnFn),
  'returning work performs no fetch / submit / rose-mirror (no auto-send to Nexus)');

assert(/function studioRenderWorkedField\s*\(/.test(src),
  'studioRenderWorkedField() render is defined');
const renderMatch = src.match(/function studioRenderWorkedField[\s\S]*?\n}\n/);
const renderFn = renderMatch ? renderMatch[0] : '';
assert(!/fetch\s*\(|rose-mirror|mirror-send-btn/.test(renderFn),
  'worked render performs no fetch / submit / rose-mirror');

// Loaded on init and refreshed when the Worked mode is shown.
assert(/if \(typeof studioLoadWorked === 'function'\) studioLoadWorked\(\);/.test(src),
  'worked snapshot is primed on load');
assert(/mode === 'worked'[\s\S]{0,120}studioRenderWorkedField/.test(src),
  'worked render refreshes when its mode becomes visible');

// ---------------------------------------------------------------------------
// 6) No NEW automatic Nexus submit / rose-mirror path was introduced anywhere.
//    (Guards the core product rule: work returns to the field only by human
//    action, and nothing is auto-sent to Nexus.)
// ---------------------------------------------------------------------------
console.log('no new automatic rose-mirror / auto-submit path');

// studioReturnWorkedToField and the button builder — the entire return bridge —
// must contain zero references to the AI call route.
assert(!/rose-mirror/.test(returnFn) && !/rose-mirror/.test(btnFn) && !/rose-mirror/.test(renderFn),
  'the return-to-field bridge never references /rose-mirror');

// ---------------------------------------------------------------------------
console.log('');
if (failed) { console.error(`FAILED (${failed})`); process.exit(1); }
console.log('all checks passed');
