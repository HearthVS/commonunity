/* Regression test: Field Observations depth modes.
 *
 * Field Observations is the central user interface, and Archive is a deeper
 * remembered layer of it — not a separate file manager. This test locks in the
 * UI/interaction architecture added for that correction:
 *
 *   1. A central depth-mode nav — Now / Remembered / Prepared / Offered /
 *      Worked — with matching central panels. Now keeps the existing
 *      capture/upload surface; Offered/Worked are future states.
 *   2. Central depth containers (#fo-central-remembered, #fo-central-prepared)
 *      that surface the same member-scoped state the Archive reads.
 *   3. The side Archive reframed into a compact memory index that opens the
 *      central depth views and shows counts.
 *   4. Reframed language: Remembered / Prepared / Bring forward / Offer to
 *      Nexus / "How would you like to meet this material?".
 *   5. The Nexus hand-off is still a pure trust boundary — it never calls
 *      /rose-mirror and never auto-submits.
 *
 * Usage:  node tests/studio-field-observations-depth.test.js
 * Deps:   jsdom (for DOM parsing of the studio.html markup)
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
const dom = new JSDOM(src);
const doc = dom.window.document;

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

// ---------------------------------------------------------------------------
// 1) Central depth-mode nav — Now / Remembered / Prepared / Offered / Worked.
// ---------------------------------------------------------------------------
console.log('central depth-mode nav');

const nav = doc.getElementById('fo-depth-nav');
assert(nav !== null, 'depth-mode nav (#fo-depth-nav) exists in the central surface');

const tabModes = Array.from(doc.querySelectorAll('.fo-depth-tab')).map(t => t.getAttribute('data-mode'));
['now', 'remembered', 'prepared', 'offered', 'worked'].forEach(mode => {
  assert(tabModes.indexOf(mode) !== -1, 'depth tab exists for mode "' + mode + '"');
});

const nowTab = doc.querySelector('.fo-depth-tab[data-mode="now"]');
assert(nowTab && nowTab.classList.contains('is-active'),
  'Now is the default active depth tab');

['offered', 'worked'].forEach(mode => {
  const t = doc.querySelector('.fo-depth-tab[data-mode="' + mode + '"]');
  assert(t && t.getAttribute('data-future') === '1',
    '"' + mode + '" tab is marked as a future state (data-future="1")');
});

// ---------------------------------------------------------------------------
// 2) Central depth panels + containers.
// ---------------------------------------------------------------------------
console.log('\ncentral depth panels + containers');

['now', 'remembered', 'prepared', 'offered', 'worked'].forEach(mode => {
  const p = doc.getElementById('fo-panel-' + mode);
  assert(p !== null && p.classList.contains('fo-depth-panel'),
    'central panel #fo-panel-' + mode + ' exists');
});

const nowPanel = doc.getElementById('fo-panel-now');
assert(nowPanel && nowPanel.classList.contains('is-active'),
  'Now panel is active by default');

assert(doc.getElementById('fo-central-remembered') !== null,
  'Remembered central container (#fo-central-remembered) exists');
assert(doc.getElementById('fo-central-prepared') !== null,
  'Prepared central container (#fo-central-prepared) exists');

// Now must still contain the existing capture/upload/text surface — the whole
// point is that Now preserves current behaviour.
['workbench-input', 'btn-save-entry', 'fo-media-dropzone', 'fo-media-input', 'fo-media-list', 'workbench-entries']
  .forEach(id => {
    const el = doc.getElementById(id);
    assert(el !== null && nowPanel.contains(el),
      'capture surface element #' + id + ' is preserved inside the Now panel');
  });

// Offered/Worked render a future/empty state, not data controls.
['offered', 'worked'].forEach(mode => {
  const p = doc.getElementById('fo-panel-' + mode);
  assert(p && p.querySelector('.fo-future-state') !== null,
    mode + ' panel shows an empty/future state');
});

// ---------------------------------------------------------------------------
// 3) Side Archive as a compact memory index.
// ---------------------------------------------------------------------------
console.log('\nside Archive compact memory index');

const index = doc.getElementById('archive-memory-index');
assert(index !== null, 'compact memory index (#archive-memory-index) exists in the Archive drawer');

const drawerBody = doc.getElementById('archive-drawer-body');
assert(index && drawerBody && drawerBody.contains(index),
  'memory index lives inside the Archive drawer body');

['remembered', 'prepared', 'offered', 'worked'].forEach(depth => {
  const item = doc.querySelector('.memory-index-item[data-depth="' + depth + '"]');
  assert(item !== null, 'memory index has a "' + depth + '" quick-nav item');
});

['memory-count-remembered', 'memory-count-prepared', 'memory-count-offered', 'memory-count-worked']
  .forEach(id => assert(doc.getElementById(id) !== null, 'memory index count element #' + id + ' exists'));

// ---------------------------------------------------------------------------
// 4) Reframed language.
// ---------------------------------------------------------------------------
console.log('\nreframed language');

const actionsTitle = doc.querySelector('.archive-actions-title');
assert(actionsTitle && /How would you like to meet this material\?/.test(actionsTitle.textContent),
  'action layer asks "How would you like to meet this material?"');
assert(actionsTitle && !/What do you want to do with these files\?/.test(actionsTitle.textContent),
  'old file-manager prompt "What do you want to do with these files?" is gone from the UI');
assert(/Bring forward/.test(src), 'uses "Bring forward" language');
assert(/Offer to Nexus/.test(src), 'uses "Offer to Nexus" language');

const remTab = doc.querySelector('.fo-depth-tab[data-mode="remembered"]');
assert(remTab && /Remembered/.test(remTab.textContent), 'Remembered tab is labelled "Remembered"');
const prepTab = doc.querySelector('.fo-depth-tab[data-mode="prepared"]');
assert(prepTab && /Prepared/.test(prepTab.textContent), 'Prepared tab is labelled "Prepared"');

// ---------------------------------------------------------------------------
// 5) Nexus hand-off remains a pure trust boundary.
// ---------------------------------------------------------------------------
console.log('\nNexus hand-off trust boundary');

// Grab the body of studioPopulateNexusInput — the single shared hand-off. It
// must not reference /rose-mirror and must not click/submit the send button.
function fnBody(name) {
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return null;
}

const populate = fnBody('studioPopulateNexusInput');
assert(populate !== null, 'located studioPopulateNexusInput()');
if (populate) {
  assert(!/rose-mirror/.test(populate),
    'studioPopulateNexusInput never calls /rose-mirror');
  assert(!/mirror-send-btn/.test(populate),
    'studioPopulateNexusInput never touches the send button');
  assert(!/\.submit\s*\(|requestSubmit\s*\(/.test(populate),
    'studioPopulateNexusInput never auto-submits a form');
}

// The bring/offer entry points must route through studioPopulateNexusInput and
// never call /rose-mirror themselves.
['studioBringObservationIntoNexus', 'studioBringSelectedTextToNexus', 'studioBringProcessedTextIntoNexus']
  .forEach(name => {
    const body = fnBody(name);
    assert(body !== null, 'located ' + name + '()');
    if (body) {
      assert(/studioPopulateNexusInput/.test(body),
        name + ' hands off via studioPopulateNexusInput (populate-only)');
      assert(!/rose-mirror/.test(body), name + ' never calls /rose-mirror');
    }
  });

if (failed > 0) {
  console.error('\nFAIL: ' + failed + ' assertion(s) failed.');
  process.exit(1);
} else {
  console.log('\nOK: studio-field-observations-depth test passed.');
}
