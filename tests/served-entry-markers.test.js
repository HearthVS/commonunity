// Served-entry markers regression.
//
// Catches the class of bug we hit on 2026-05-18: PR #24 landed on
// main, the Railway deploy kept serving a stale build, and no test
// surfaced the divergence. The repo-side fix can only assert that the
// served entry HTML carries the markers PR #24 introduced — we cannot
// catch a stuck Railway redeploy from here, but we can prevent the
// markers from quietly being dropped by future edits to the same file.
//
// If this test fails, either PR #24 invariants were removed from
// index.html (bug) or the served entry file changed (intentional —
// update this list).
//
// Run:  node tests/served-entry-markers.test.js

'use strict';

const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '..', 'index.html');
const sdkPath   = path.resolve(__dirname, '..', 'sdk', 'astronomy.js');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('index.html (server.py / route) carries PR #24 modal markers');
const src = fs.readFileSync(indexPath, 'utf8');
ok('om-cipher-card blocks present',          /class="om-cipher-card/.test(src));
ok('glowing info-button present',            /class="info-button/.test(src));
ok('Birth Coordinates section present',      /Birth\s*[Cc]oordinates/.test(src));
ok('Lahiri (Vedic ayanamsha) label present', /Lahiri/.test(src));
ok('sdk/astronomy.js loaded as a script',    /<script[^>]*src="[^"]*sdk\/astronomy\.js/.test(src));

console.log('\nsdk/astronomy.js is in the repo (mounted at /sdk by server.py)');
ok('sdk/astronomy.js file exists', fs.existsSync(sdkPath));
if (fs.existsSync(sdkPath)) {
  const astroSrc = fs.readFileSync(sdkPath, 'utf8');
  ok('exports identity-chart helpers',
     /computeIdentityChart|computeSun|computeMoon/.test(astroSrc));
}

console.log('\nserver.py mounts /sdk so the static script is reachable');
const serverPath = path.resolve(__dirname, '..', 'server.py');
const serverSrc = fs.readFileSync(serverPath, 'utf8');
ok('app.mount("/sdk", StaticFiles(...)) is present',
   /app\.mount\(\s*["']\/sdk["']\s*,\s*StaticFiles/.test(serverSrc));

console.log('\nhash-hiding invariant (PR #23) — no visible Cipher seed / fingerprint in served entry');
// In index.html the Cipher seed surface uses hidden attribute and
// inline display:none. Match the pattern, not the literal string.
const seedHits = src.match(/Cipher seed/g) || [];
const visibleSeedRule = /Cipher seed[^<]*<\/[^>]+>\s*(?!<[^>]+hidden)/.test(src);
ok('"Cipher seed" surface, if rendered, is either gated by hidden / display:none',
   seedHits.length === 0 ||
   /data-cu-om-cipher-seed-hash[^>]*hidden|data-cu-om-cipher-seed-hash[^>]*display\s*:\s*none/.test(src) ||
   !/<[^>]*data-cu-om-cipher-seed-hash[^>]*>(?![^<]*hidden)/.test(src));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: Served-entry marker regressions pass.');
}
