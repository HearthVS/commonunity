// Compass export includes the v1.1 structured om_cipher block.
//
// Loads the Markus Studio export fixture, mounts the studio.html
// `studioSaveJSON` body's om_cipher-derivation block in a fake-window
// harness, and asserts that:
//
//   1. exportData.om_cipher is populated from the canonical engine.
//   2. The exported block carries Layer 1..6 with the Markus values.
//   3. The block does NOT contain Hebrew gematria fields or
//      personal_year inside any of the sealed layers.
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-export-block.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const fs   = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const om   = require('../sdk/om_cipher.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));

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

const SRC_MERGE   = extractFn('cuMergeGeneKeysSlots');
const SRC_BUILD   = extractFn('cuBuildOmCipherInput');

// Compose a fake window from the Studio export.
const fakeWin = {
  CU_OM_CIPHER_ENABLED: true,
  cuOmCipher: om,
  state: {
    person: FIXTURE.person || null,
    birthData: FIXTURE.birthData || null,
    compassData: FIXTURE.compassData || {},
  },
};

// Mount cuMergeGeneKeysSlots + cuBuildOmCipherInput into the fake window
// so the export integration code (below) has the same surface it expects
// at runtime.
new Function('window', SRC_MERGE + '\nwindow.cuMergeGeneKeysSlots = cuMergeGeneKeysSlots;')(fakeWin);
new Function(
  'window', 'cuBuildPublishPayload',
  'var cuMergeGeneKeysSlots = window.cuMergeGeneKeysSlots;\n' +
  SRC_BUILD + '\n' +
  'window.cuBuildOmCipherInput = cuBuildOmCipherInput;'
)(fakeWin, function () { return null; });

// Mimic the studioSaveJSON contribution block by running the same logic
// against the fake window. (We can't execute the surrounding function as-
// is because it touches lots of unrelated state.)
function buildExportContribution(win) {
  const out = {};
  try {
    if (typeof win.cuBuildOmCipherInput === 'function'
        && typeof win.cuOmCipher === 'object'
        && typeof win.cuOmCipher.generate === 'function') {
      const _ocInput = win.cuBuildOmCipherInput(null);
      if (_ocInput) {
        const _ocRec = win.cuOmCipher.generate(_ocInput, { featureFlag: true });
        if (_ocRec && !_ocRec.pending && _ocRec.om_cipher_block) {
          out.om_cipher = _ocRec.om_cipher_block;
        }
      }
    }
  } catch (_) { /* graceful */ }
  return out;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('om_cipher block — Studio export integration');

const contribution = buildExportContribution(fakeWin);
const blk = contribution.om_cipher;

test('exportData.om_cipher populated from canonical engine', () => {
  assert.ok(blk, 'om_cipher block present on exported data');
  assert.equal(blk.version, '1.1');
});

test('exported block carries Markus Layer 1 numerology (LP22 / Ex8 / SU6 / Pe11)', () => {
  assert.equal(blk.layer1.life_path.value, 22);
  assert.equal(blk.layer1.expression.value, 8);
  assert.equal(blk.layer1.soul_urge.value, 6);
  assert.equal(blk.layer1.personality.value, 11);
  assert.equal(blk.layer1.personality.is_master, true);
  assert.equal(blk.layer1.gematria_ordinal, 143);
  assert.equal(blk.layer1.gematria_ordinal_root, 8);
});

test('exported block carries Markus Layer 2 GK (14.2 / 8.2 / 29.4 / 30.4)', () => {
  assert.equal(blk.layer2.gene_keys.cs.gate, 14);
  assert.equal(blk.layer2.gene_keys.cs.line, 2);
  assert.equal(blk.layer2.gene_keys.ce.gate, 8);
  assert.equal(blk.layer2.gene_keys.ce.line, 2);
  assert.equal(blk.layer2.gene_keys.us.gate, 29);
  assert.equal(blk.layer2.gene_keys.us.line, 4);
  assert.equal(blk.layer2.gene_keys.ue.gate, 30);
  assert.equal(blk.layer2.gene_keys.ue.line, 4);
});

test('exported block omits Hebrew gematria & sealed personal_year inside layers', () => {
  const layers = {
    layer1: blk.layer1, layer2: blk.layer2, layer3: blk.layer3,
    layer4: blk.layer4, layer5: blk.layer5, layer6: blk.layer6,
  };
  const dump = JSON.stringify(layers).toLowerCase();
  assert.ok(!/hebrew/.test(dump));
  assert.ok(!/personal_year/.test(dump));
});

test('exported block carries a hex-lissajous-crack sigil SVG', () => {
  assert.equal(blk.layer6.form, 'hex-lissajous-crack');
  assert.ok(blk.layer6.svg.startsWith('<svg'));
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
