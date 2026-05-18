// Root Compass buildCompassExport — om_cipher block + safe-when-undefined.
//
// Reproduces the live failure path the user hit:
//   1. Open root index.html, visible Setup, fill Markus inputs.
//   2. Click #btn-calc, #btn-open-compass, #btn-open-om-cipher.
//   3. From the page console: `buildCompassExport()` (no argument).
//
// Before this fix, that threw `Cannot read properties of undefined
// (reading 'profile')`. After the fix it must:
//   - default `s` to `window.state`,
//   - return an export object,
//   - include `out.om_cipher` (v1.1 structured block) populated from
//     canonical root-Compass state via the SDK.
//
// Run: OM_CIPHER_ENABLED=true node tests/compass-export-om-cipher-block.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const fs   = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const om   = require('../sdk/om_cipher.js');

// ── Extract buildCompassExport source from index.html ──────────────
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

const SRC = extractFn('buildCompassExport');

// ── Build a fake browser-ish runtime that mounts the function ───────
// `state` is the global root-Compass state (`const state = { ... }`
// in index.html). buildCompassExport(s) defaults `s` to that global.
function makeRunner(state) {
  const win = { cuOmCipher: om, CU_OM_CIPHER_ENABLED: true };
  // Expose `state` and `window` as closure variables the function
  // captures from index.html's top-level scope.
  const fn = new Function(
    'window', 'state',
    SRC + '\nreturn buildCompassExport;'
  );
  return fn(win, state);
}

// ── State shape produced by the visible Setup → Calc path (Markus). ──
// Mirrors index.html `const state = { ... }` after the user has filled
// guide-name, companion-name, dob, tob, pob, hit #btn-calc (which
// writes state.gk_profile) and the per-point GK pre-fill that follows.
function makeMarkusState() {
  return {
    theme: 'A',
    tradition: 'GK',
    guide: 'Markus Lehto',
    companion: 'Markus',
    dob: '1973-11-18',
    tob: '03:21',
    pob: 'Sudbury ontario canada',
    gk_profile: {
      cs: 14, csLine: 2, csLon: '235.649',
      us: 29, usLine: 4, usLon: '147.649',
      ce:  8, ceLine: 2, ceLon: '55.649',
      ue: 30, ueLine: 4, ueLon: '327.649',
    },
    points: {
      work:  { raw: '', gk_num: '14', gk_line: '', insights: [], highlights: [], qa_answers: {} },
      lens:  { raw: '', gk_num: '8',  gk_line: '', insights: [], highlights: [], qa_answers: {} },
      field: { raw: '', gk_num: '29', gk_line: '', insights: [], highlights: [], qa_answers: {} },
      call:  { raw: '', gk_num: '30', gk_line: '', insights: [], highlights: [], qa_answers: {} },
    },
  };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('buildCompassExport — visible setup path (Markus)');

const markusState = makeMarkusState();
const buildCompassExport = makeRunner(markusState);

test('buildCompassExport() with no argument does not throw', () => {
  // The live console call site uses zero arguments; before the fix
  // this threw `Cannot read properties of undefined (reading 'profile')`.
  const out = buildCompassExport();
  assert.ok(out && typeof out === 'object',
    'export object must be returned, got: ' + typeof out);
});

test('buildCompassExport() defaults to global state and returns expected shape', () => {
  const out = buildCompassExport();
  assert.ok(out.profile, 'export carries a profile block');
  // The profile-shape legacy logic derives first/last/full_name from
  // s.companion (the preferred / display name), which in the live
  // setup path is a single token ("Markus"). This is pre-existing
  // behaviour; the OM Cipher structured block separately reads the
  // multi-token s.guide so its gematria still matches "Markus Lehto".
  assert.equal(out.profile.first_name, 'Markus');
  assert.equal(out.profile.birthdate,  '1973-11-18');
});

test('buildCompassExport(undefined) is equivalent to no-arg call', () => {
  const a = buildCompassExport();
  const b = buildCompassExport(undefined);
  assert.equal(a.profile.legal_name, b.profile.legal_name);
});

test('buildCompassExport(null) does not throw (tolerates bad input)', () => {
  const out = buildCompassExport(null);
  assert.ok(out && typeof out === 'object');
});

test('buildCompassExport({}) does not throw on empty input (no SDK call)', () => {
  // Empty state has no birth_date — the engine bails out gracefully and
  // out.om_cipher is omitted. The rest of the export must still build.
  const out = buildCompassExport({});
  assert.ok(out && typeof out === 'object');
  assert.equal(out.om_cipher, undefined,
    'om_cipher omitted when birth_date is missing');
});

// ── Structured om_cipher block surfaced on the export ──────────────
console.log('\nbuildCompassExport — om_cipher v1.1 block (Markus)');

const exportObj = buildCompassExport();

test('export carries om_cipher (v1.1) block', () => {
  assert.ok(exportObj.om_cipher, 'om_cipher block present on export');
  assert.equal(exportObj.om_cipher.version, '1.1');
});

test('Layer 1 — life_path 22, expression 8, soul_urge 6, personality 11 (master)', () => {
  const l1 = exportObj.om_cipher.layer1;
  assert.equal(l1.life_path.value, 22);
  assert.equal(l1.life_path.is_master, true);
  assert.equal(l1.expression.value, 8);
  assert.equal(l1.soul_urge.value, 6);
  assert.equal(l1.personality.value, 11);
  assert.equal(l1.personality.is_master, true);
});

test('Layer 1 — birthday_number raw=18, reduced=9; gematria_ordinal=143/8', () => {
  const l1 = exportObj.om_cipher.layer1;
  assert.equal(l1.birthday_number.raw, 18);
  assert.equal(l1.birthday_number.reduced, 9);
  assert.equal(l1.gematria_ordinal, 143);
  assert.equal(l1.gematria_ordinal_root, 8);
});

test('Layer 2 — canonical Gene Keys 14.2 / 8.2 / 29.4 / 30.4', () => {
  const gk = exportObj.om_cipher.layer2.gene_keys;
  assert.equal(gk.cs.gate, 14); assert.equal(gk.cs.line, 2);
  assert.equal(gk.ce.gate,  8); assert.equal(gk.ce.line, 2);
  assert.equal(gk.us.gate, 29); assert.equal(gk.us.line, 4);
  assert.equal(gk.ue.gate, 30); assert.equal(gk.ue.line, 4);
  assert.equal(gk.cs.label, 'Life Work');
  assert.equal(gk.ce.label, 'Evolution');
  assert.equal(gk.us.label, 'Radiance');
  assert.equal(gk.ue.label, 'Purpose');
});

test('export omits Hebrew gematria and sealed personal_year inside layers', () => {
  const layers = {
    l1: exportObj.om_cipher.layer1, l2: exportObj.om_cipher.layer2,
    l3: exportObj.om_cipher.layer3, l4: exportObj.om_cipher.layer4,
    l5: exportObj.om_cipher.layer5, l6: exportObj.om_cipher.layer6,
  };
  const dump = JSON.stringify(layers).toLowerCase();
  assert.ok(!/hebrew/.test(dump));
  assert.ok(!/personal_year/.test(dump));
});

test('Layer 6 — hex-lissajous-crack sigil SVG generated', () => {
  const l6 = exportObj.om_cipher.layer6;
  assert.equal(l6.form, 'hex-lissajous-crack');
  assert.ok(l6.svg && l6.svg.startsWith('<svg'));
  assert.ok(/cu-om-cipher-sigil-hex/.test(l6.svg));
});

// ── Graceful behaviour when SDK is not loaded ──────────────────────
console.log('\nbuildCompassExport — graceful when SDK absent');

test('export omits om_cipher when window.cuOmCipher is not loaded', () => {
  const noSdkRunner = (function () {
    const win = {}; // no cuOmCipher
    const fn = new Function('window', 'state', SRC + '\nreturn buildCompassExport;');
    return fn(win, makeMarkusState());
  })();
  const out = noSdkRunner();
  assert.ok(out && typeof out === 'object',
    'export still produced when SDK absent');
  assert.equal(out.om_cipher, undefined,
    'om_cipher omitted when SDK is not loaded — no throw, no broken export');
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
