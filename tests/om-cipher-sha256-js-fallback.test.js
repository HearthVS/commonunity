// Pure-JS SHA-256 fallback regression — the browser path.
//
// `sha256Hex` in sdk/om_cipher.js uses Node's `require("crypto")` when
// available and falls back to `sha256JS` in the browser (no `require`).
// The original `sha256JS` had an off-by-eight padding bug: it produced
// a buffer of length `64*ceil((N+9)/64) + 8` (NOT a multiple of 64),
// processed a phantom trailing block of garbage, and returned a
// deterministic-but-wrong digest. On the live site every Cipher seed
// surfaced this wrong value (e.g. Markus rendered `25345a79…` rather
// than the canonical `58b2ea61…`). Unit tests ran under Node, took the
// crypto fast-path, and missed the bug entirely.
//
// This test extracts `sha256JS` and asserts:
//   1. Markus's canonical seed string produces the canonical Markus seed
//      `58b2ea61…f388784` (and NOT the live-bug value `25345a79…b465`).
//   2. Parity with Node's `crypto.createHash('sha256')` for a range of
//      inputs that span the SHA-256 block boundaries (0, 1, 55, 56, 63,
//      64, 65, 100 byte messages) plus a UTF-8 case.
//
// Run:  node tests/om-cipher-sha256-js-fallback.test.js
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');

const src = fs.readFileSync(path.join(__dirname, '..', 'sdk', 'om_cipher.js'), 'utf8');

// Pull the sha256JS source out of the SDK and rebuild it in isolation
// so the test exercises the browser-fallback code path directly.
const m = src.match(/function sha256JS\([\s\S]*?\n\}\n/);
assert.ok(m, 'sha256JS function source not found in sdk/om_cipher.js');
const sha256JS = new Function(
  'return (' + m[0].replace('function sha256JS', 'function') + ')'
)();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

const CANONICAL_SEED_STRING = 'LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1';
const CANONICAL_MARKUS_SEED =
  '58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784';
const LIVE_BUG_SEED =
  '25345a7914a7fc06e6e14db1b57d9ae03b0dd59834f5fbea3a1ae7acff54b465';

console.log('sha256JS — Markus canonical seed (browser-fallback path)');

test('sha256JS(`LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1`) is the canonical Markus seed', () => {
  const got = sha256JS(CANONICAL_SEED_STRING);
  assert.equal(got, CANONICAL_MARKUS_SEED,
    'browser sha256 fallback must equal the canonical engine seed');
});

test('sha256JS does NOT produce the prior live-bug value `25345a79…b465`', () => {
  const got = sha256JS(CANONICAL_SEED_STRING);
  assert.notEqual(got, LIVE_BUG_SEED,
    'this is the regression — `25345a79…b465` came from the broken padding ' +
    'in the prior sha256JS implementation');
});

console.log('\nsha256JS — parity with Node crypto across block boundaries');

[
  '',
  'a',
  'abc',
  'LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1',   // 38 bytes — Markus seed string
  'LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3',         // 33 bytes
  'a'.repeat(55),   // one byte short of a full block after 0x80
  'a'.repeat(56),   // 0x80 forces a second block (length field doesn't fit)
  'a'.repeat(63),   // one byte short of a block
  'a'.repeat(64),   // exact block boundary
  'a'.repeat(65),   // 1 byte past block boundary
  'a'.repeat(100),  // multi-block, mid-block bit length
  // UTF-8: ensure NFC/UTF-8 byte length, not character count, drives padding.
  'café',
  '日本語',
].forEach(s => {
  test('parity for ' + JSON.stringify(s.length > 30 ? s.slice(0, 20) + '…' : s), () => {
    const fromJs = sha256JS(s);
    const fromNode = crypto.createHash('sha256').update(s, 'utf8').digest('hex');
    assert.equal(fromJs, fromNode,
      'sha256JS must produce identical output to Node crypto for input ' + JSON.stringify(s));
  });
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
