// Browser-runtime fidelity test for the OM Cipher engine.
//
// All existing fixture tests `require('../sdk/om_cipher.js')` in Node,
// where `sha256Hex` short-circuits to Node's `crypto` module. The live
// Studio loads the same source as a plain <script> with no `require`,
// so the engine falls back to the in-file `sha256JS` implementation.
//
// This test loads sdk/om_cipher.js into a sandbox that mimics the
// browser globals — `window` present, `require` absent — and runs the
// engine end-to-end against the Markus Studio fixture. It asserts that
// `rec.seed` equals the canonical `58b2ea61…f388784`, which is the
// exact contract live acceptance now checks.
//
// The pre-fix bug: `sha256JS` mis-computed pad length and emitted
// `25345a7914a7fc06…b465` for Markus. The post-fix runtime must emit
// `58b2ea613f7d3c75…f388784` instead.
//
// Run:  node tests/om-cipher-browser-runtime.test.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

const SDK = fs.readFileSync(path.join(__dirname, '..', 'sdk', 'om_cipher.js'), 'utf8');
const LAYER6 = fs.readFileSync(
  path.join(__dirname, '..', 'sdk', 'om_cipher_layer6_data.js'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));

const CANONICAL_SEED = '58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784';
const CANONICAL_SEED_STRING = 'LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1';
const LIVE_BUG_SEED = '25345a7914a7fc06e6e14db1b57d9ae03b0dd59834f5fbea3a1ae7acff54b465';

// Build a sandbox that looks like a browser to the SDK loader:
// - `window` is defined
// - `module` and `require` are NOT defined (forces the in-file sha256JS path)
const sandbox = {
  window: {},
  globalThis: undefined,    // SDK probes `typeof window !== "undefined"` before this anyway
  console: console,
  setTimeout: setTimeout,
  Math: Math, Date: Date, JSON: JSON,
  String: String, Number: Number, Object: Object, Array: Array,
  Uint8Array: Uint8Array, Uint32Array: Uint32Array,
  encodeURIComponent: encodeURIComponent, unescape: unescape,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Load Layer 6 sidecar (defines window.cuOmCipherLayer6).
vm.runInContext(LAYER6, sandbox);
// Load the engine. With `require` absent and `window` present, the SDK
// hangs itself off window.cuOmCipher.
vm.runInContext(SDK, sandbox);

const cuOmCipher = sandbox.window.cuOmCipher;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('om_cipher — browser-runtime path (no require, sha256JS in use)');

test('window.cuOmCipher exposed by browser load', () => {
  assert.ok(cuOmCipher, 'engine attached to window');
  assert.equal(typeof cuOmCipher.generate, 'function');
  assert.equal(typeof cuOmCipher.sha256Hex, 'function');
});

test('sha256Hex(canonical seed string) is the canonical Markus seed', () => {
  const got = cuOmCipher.sha256Hex(CANONICAL_SEED_STRING);
  assert.equal(got, CANONICAL_SEED,
    'in the browser path, sha256Hex must equal the canonical seed');
  assert.notEqual(got, LIVE_BUG_SEED,
    'must NOT produce the prior live-bug value 25345a79…b465');
});

test('generate(Markus fixture) returns canonical engine seed (not 25345a79…)', () => {
  // Build the same input the in-page cuBuildOmCipherInput would, but
  // strip the heavy Compass narrative payload since the canonical seed
  // only depends on the layered identity values.
  const cd = FIXTURE.compassData;
  const input = {
    birth_date: cd.dob,
    birth_time: cd.tob,
    birth_place: { city: 'Sudbury', province: 'Ontario', country: 'Canada' },
    legal_name: cd.guide,
    preferred_name: cd.companion,
    compass: {
      work:  { gk_num: cd.gk_profile.cs, gk_line: cd.gk_profile.csLine },
      lens:  { gk_num: cd.gk_profile.ce, gk_line: cd.gk_profile.ceLine },
      field: { gk_num: cd.gk_profile.us, gk_line: cd.gk_profile.usLine },
      call:  { gk_num: cd.gk_profile.ue, gk_line: cd.gk_profile.ueLine },
    },
  };
  const rec = cuOmCipher.generate(input, { featureFlag: true });
  assert.ok(!rec.pending, 'engine produced a record, not a pending stub');
  assert.equal(rec.seed_string, CANONICAL_SEED_STRING,
    'canonical seed string matches Markus baseline');
  assert.equal(rec.seed, CANONICAL_SEED,
    'rec.seed equals canonical Markus seed under the browser sha256 path');
  assert.notEqual(rec.seed, LIVE_BUG_SEED,
    'rec.seed must NOT be the prior bug value 25345a79…b465 — this is the ' +
    'exact regression the live page surfaced');
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
