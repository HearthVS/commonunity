// Studio must load the Layer 6 sidecar BEFORE the Om Cipher SDK so that
// in the browser the SDK's module-load-time `_loadLayer6Data()` can read
// `window.cuOmCipherLayer6`. If the sidecar tag is missing or loads after
// the SDK, mantra / story / contemplation render as pending even though
// the data file is deployed.
//
// Run: node tests/om-cipher-studio-sidecar-load.test.js

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const STUDIO = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
const SDK_PATH = path.join(__dirname, '..', 'sdk', 'om_cipher.js');
const SIDECAR_PATH = path.join(__dirname, '..', 'sdk', 'om_cipher_layer6_data.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('Om Cipher — Studio sidecar load order');

test('studio.html includes the Layer 6 sidecar script tag', () => {
  assert.ok(
    /<script src="\/sdk\/om_cipher_layer6_data\.js"><\/script>/.test(STUDIO),
    'sidecar <script> tag missing from studio.html',
  );
});

test('sidecar script tag precedes the Om Cipher SDK script tag', () => {
  const sidecarIdx = STUDIO.indexOf('/sdk/om_cipher_layer6_data.js');
  const sdkIdx = STUDIO.indexOf('/sdk/om_cipher.js');
  assert.ok(sidecarIdx >= 0, 'sidecar tag missing');
  assert.ok(sdkIdx >= 0, 'sdk tag missing');
  assert.ok(
    sidecarIdx < sdkIdx,
    'sidecar must load BEFORE om_cipher.js (sidecar=' + sidecarIdx +
      ', sdk=' + sdkIdx + ')',
  );
});

console.log('\nOm Cipher — browser-context render (sidecar + SDK)');

// Simulate the browser load order: evaluate the sidecar first to populate
// `window.cuOmCipherLayer6`, then evaluate the SDK in a context that has
// no `require`. The SDK's `_loadLayer6Data()` must fall through to the
// window global. We then call generate() on the Markus fixture and assert
// the Layer 6 outputs surface.
test('Markus fixture renders Layer 6 outputs through window.cuOmCipherLayer6', () => {
  const win = {};
  const sandbox = {
    window: win,
    console,
    process: { env: { OM_CIPHER_ENABLED: 'true' } },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Each <script> tag in the browser runs in its own top-level scope; vm
  // runInContext shares one global scope, so wrap each source in an IIFE
  // to mirror the browser (avoids top-level `const` collisions like
  // `_exports` being declared in both files).
  const wrap = (src) => '(function(){\n' + src + '\n})();';

  // Sidecar: populates window.cuOmCipherLayer6.
  vm.runInContext(wrap(fs.readFileSync(SIDECAR_PATH, 'utf8')), sandbox,
    { filename: 'om_cipher_layer6_data.js' });
  assert.ok(win.cuOmCipherLayer6, 'sidecar must expose window.cuOmCipherLayer6');
  assert.ok(win.cuOmCipherLayer6.MANTRA_TABLE, 'mantra table present');

  // SDK: must read window.cuOmCipherLayer6 (no `require` in sandbox).
  vm.runInContext(wrap(fs.readFileSync(SDK_PATH, 'utf8')), sandbox,
    { filename: 'om_cipher.js' });
  assert.ok(win.cuOmCipher, 'SDK must expose window.cuOmCipher');
  assert.equal(typeof win.cuOmCipher.generate, 'function');

  const rec = win.cuOmCipher.generate({
    legal_name: 'Markus Lehto',
    preferred_name: 'Markus',
    birth_date: '1973-11-18',
    birth_time: '03:21',
    birth_place: {
      city: 'Sudbury', province: 'Ontario', country: 'Canada',
      lat: 46.4917, lng: -80.9930,
    },
  }, { featureFlag: true });

  assert.ok(!rec.pending, 'record must not be pending');
  assert.equal(
    rec.metadata.om_cipher_mantra.mantra,
    'I hold the form until the form holds others.',
  );
  assert.ok(
    /You carry the paradox of power and service/.test(
      rec.metadata.archetypal_story_seed.seed,
    ),
    'story seed must carry the canonical Markus opening',
  );
  assert.equal(
    rec.metadata.cipher_contemplation.phrase,
    'I do less now, and allow more.',
  );
  assert.equal(rec.metadata.cipher_name, 'Markus of the Autumn Gate');
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
