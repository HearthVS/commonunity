/* Studio API_BASE same-origin guard.
 *
 * The Nexus connection failure ("Something interrupted the connection")
 * came from Studio, served on commonunity.io, calling a hardcoded
 * cross-origin API host. Member access rides on a host-scoped SameSite=Lax
 * cookie, so the cross-origin fetch dropped it and POST /rose-mirror
 * returned 403. API_BASE must resolve relative to location.origin so calls
 * stay same-origin and the cookie travels with them.
 *
 * Usage:  node tests/studio-api-base-same-origin.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('static-source checks');

// API_BASE must not be a bare hardcoded cross-origin assignment anymore.
assert(!/const\s+API_BASE\s*=\s*['"]https?:\/\//.test(src),
  'API_BASE is not assigned a hardcoded absolute URL');

// It must be resolved through the helper.
assert(/const\s+API_BASE\s*=\s*resolveApiBase\(\)/.test(src),
  'API_BASE is derived from resolveApiBase()');

// The resolver must prefer the serving origin for HTTP(S) contexts.
assert(/function\s+resolveApiBase\(/.test(src),
  'resolveApiBase helper is defined');
assert(/return\s+location\.origin/.test(src),
  'resolveApiBase returns location.origin for same-origin calls');
assert(/\^https\?:\$/.test(src),
  'resolveApiBase gates the origin path on an http(s) protocol');

// Overrides and static fallback are preserved.
assert(/window\.CU_API_BASE/.test(src),
  'window.CU_API_BASE override is honored');
assert(/meta\[name="cu-api-base"\]/.test(src),
  'a <meta name="cu-api-base"> override is honored');
assert(/API_BASE_PROD_DEFAULT\s*=\s*['"]https:\/\//.test(src),
  'a production default remains only as a static/file:// fallback');

// The rose-mirror call must go through API_BASE, never a hardcoded host.
assert(/fetch\(`\$\{API_BASE\}\/rose-mirror`/.test(src),
  'POST /rose-mirror is built from API_BASE');
assert(!/fetch\(\s*['"`]https?:\/\/[^`'"]*\/rose-mirror/.test(src),
  'no rose-mirror fetch targets a hardcoded absolute URL');

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: Studio API_BASE resolves same-origin.');
}
