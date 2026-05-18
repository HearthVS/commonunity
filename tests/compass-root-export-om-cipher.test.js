/* Compass root path · buildCompassExport carries om_cipher block
 *
 * Regression for PR #36 follow-up: on the root Compass runtime
 * (DOM/state driven, not Studio's compassData.profile shape),
 * `buildCompassExport()` was throwing
 *   "Cannot read properties of undefined (reading 'profile')"
 * because the function expected a `state` arg and the user/repro
 * called it with none. PR #36 added om_cipher generation to
 * studio.html only; the root path produced no om_cipher block.
 *
 * This test reproduces the root Compass path:
 *   1. Build a state object matching what the root index.html holds
 *      after a normal setup → calc flow with Markus baseline.
 *   2. Extract buildCompassExport (and helpers) from index.html and
 *      execute against the real sdk/om_cipher.js engine in a fake
 *      window.
 *   3. Assert buildCompassExport() does not throw, returns an
 *      om_cipher block, and the block carries the Markus
 *      master-number-preserving Layer 1 + engine Gene Keys Layer 2
 *      + Layer 6 sigil SVG.
 *
 * Run: OM_CIPHER_ENABLED=true node tests/compass-root-export-om-cipher.test.js
 */
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const fs     = require('fs');
const path   = require('path');
const assert = require('node:assert/strict');

const om = require('../sdk/om_cipher.js');
const html = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'), 'utf8'
);

function extractFn(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = html.search(re);
  assert.ok(start > 0, 'could not locate function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

// Build a fake window with the engine + a `document` shim that returns
// empty strings for any DOM lookup. This forces _resolveCompassSource
// to fall back to the state object — which is what an automated
// non-DOM context (the failing prod path called from a console after
// state is hydrated by btn-calc) effectively looks like.
const fakeDoc = { getElementById: () => ({ value: '' }) };
const fakeWin = {
  CU_OM_CIPHER_ENABLED: true,
  cuOmCipher: om,
  document: fakeDoc,
};

const SRC_RESOLVE   = extractFn('_resolveCompassSource');
const SRC_MERGE_GK  = extractFn('_mergeCompassGeneKeysSlots');
const SRC_BUILD_OC  = extractFn('_buildOmCipherInputFromCompass');
const SRC_BUILD_EXP = extractFn('buildCompassExport');

new Function('window', 'document',
  SRC_RESOLVE + '\n' +
  SRC_MERGE_GK + '\n' +
  SRC_BUILD_OC + '\n' +
  SRC_BUILD_EXP + '\n' +
  'window._buildCompassExport_test = buildCompassExport;\n' +
  'window._resolveCompassSource_test = _resolveCompassSource;\n'
)(fakeWin, fakeDoc);

// Root Compass state after a normal setup + calc flow for Markus.
const markusState = {
  theme: 'A',
  tradition: 'GK',
  guide: 'Markus Lehto',
  companion: 'Markus',
  dob: '1973-11-18',
  tob: '03:21',
  pob: 'Sudbury ontario canada',
  gk_profile: {
    cs: 14, csLine: 2,
    us: 29, usLine: 4,
    ce: 8,  ceLine: 2,
    ue: 30, ueLine: 4,
  },
  points: {
    work:  { gk_num: 14, gk_line: 2 },
    lens:  { gk_num: 8,  gk_line: 2 },
    field: { gk_num: 29, gk_line: 4 },
    call:  { gk_num: 30, gk_line: 4 },
  },
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok  ' + name); passed++; }
  catch (e) { console.error('  FAIL ' + name + '\n      ' + (e.stack || e.message)); failed++; }
}

console.log('compass root · buildCompassExport om_cipher block');

// 1. Does not throw when called with explicit state.
let exported;
test('buildCompassExport(state) does not throw on root Compass shape', () => {
  exported = fakeWin._buildCompassExport_test(markusState);
  assert.ok(exported, 'returned an object');
});

// 2. Also does not throw when called with NO args (the user repro).
test('buildCompassExport() with no args does not throw (defaults to global state)', () => {
  // Simulate the global state being present.
  fakeWin.state = markusState;
  // We rely on the fact that the extracted function closes over a
  // free `state` identifier. Re-evaluate the function body inside a
  // scope where `state` is defined.
  const evald = new Function(
    'window', 'document', 'state',
    SRC_RESOLVE + '\n' + SRC_MERGE_GK + '\n' +
    SRC_BUILD_OC + '\n' + SRC_BUILD_EXP + '\n' +
    'return buildCompassExport();'
  )(fakeWin, fakeDoc, markusState);
  assert.ok(evald, 'returned an object with no args');
  assert.ok(evald.om_cipher, 'om_cipher present in no-arg call');
});

const oc = exported && exported.om_cipher;

test('export.om_cipher exists', () => {
  assert.ok(oc, 'om_cipher block present');
  assert.equal(oc.version, '1.1');
});

test('Layer 1 numerology preserves Markus master numbers (LP22 / Ex8 / SU6 / Pe11)', () => {
  assert.equal(oc.layer1.life_path.value, 22);
  assert.equal(oc.layer1.life_path.is_master, true);
  assert.equal(oc.layer1.expression.value, 8);
  assert.equal(oc.layer1.soul_urge.value, 6);
  assert.equal(oc.layer1.personality.value, 11);
  assert.equal(oc.layer1.personality.is_master, true);
});

test('Layer 1 omits Hebrew gematria and sealed personal_year', () => {
  const dump = JSON.stringify(oc.layer1).toLowerCase();
  assert.ok(!/hebrew/.test(dump), 'no hebrew gematria');
  assert.ok(!/personal_year/.test(dump), 'no sealed personal_year');
});

test('Layer 2 Gene Keys read from gk_profile (14.2 / 8.2 / 29.4 / 30.4)', () => {
  assert.equal(oc.layer2.gene_keys.cs.gate, 14);
  assert.equal(oc.layer2.gene_keys.cs.line, 2);
  assert.equal(oc.layer2.gene_keys.ce.gate, 8);
  assert.equal(oc.layer2.gene_keys.ce.line, 2);
  assert.equal(oc.layer2.gene_keys.us.gate, 29);
  assert.equal(oc.layer2.gene_keys.us.line, 4);
  assert.equal(oc.layer2.gene_keys.ue.gate, 30);
  assert.equal(oc.layer2.gene_keys.ue.line, 4);
});

test('Layer 6 sigil SVG exists in export.om_cipher', () => {
  assert.equal(oc.layer6.form, 'hex-lissajous-crack');
  assert.ok(typeof oc.layer6.svg === 'string' && oc.layer6.svg.startsWith('<svg'),
    'layer6 carries an SVG string starting with <svg');
});

console.log('\n' + (failed === 0 ? 'all passed' : (failed + ' failed')) +
  ' (' + passed + ' passed, ' + failed + ' failed)');
if (failed > 0) process.exit(1);
