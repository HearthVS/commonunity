/* Regression test: stUdio identity pass.
 *
 * Two focused changes to the Studio setup/home page:
 *   1. stUdio gets its own tab favicon (favicon-studio.svg) so its
 *      browser tab is distinguishable from cOMpass. studio.html must
 *      reference it, server.py must serve it, and the SVG must exist
 *      and be a simple, legible U-vessel + glow mark.
 *   2. The entrance "Studio Path · three levels" panel is made
 *      discreet/collapsible — rendered as a <details> so it no longer
 *      dominates the right rail, while preserving the L1/L2/L3 info and
 *      the four existing actions.
 *
 * Usage:  node tests/studio-identity-favicon-and-path-collapse.test.js
 * Deps:   none (static source assertions)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const studio = fs.readFileSync(path.join(root, 'studio.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.py'), 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

// ── 1. Favicon ──────────────────────────────────────────────
console.log('favicon');
const favPath = path.join(root, 'favicon-studio.svg');
assert(fs.existsSync(favPath), 'favicon-studio.svg exists at repo root');

const fav = fs.existsSync(favPath) ? fs.readFileSync(favPath, 'utf8') : '';
assert(/<svg[\s\S]*<\/svg>/.test(fav), 'favicon-studio.svg is an <svg> document');
assert(/aria-label="CommonUnity Studio"/.test(fav),
  'favicon-studio.svg is labelled for Studio (distinct from cOMpass)');
assert(/<radialGradient|<linearGradient/.test(fav),
  'favicon-studio.svg carries an accent glow gradient');

assert(/href="\.\/favicon-studio\.svg"/.test(studio),
  'studio.html references ./favicon-studio.svg as its tab icon');
assert(!/href="\.\/favicon\.svg"/.test(studio),
  'studio.html no longer points at the shared cOMpass favicon.svg');

assert(/@app\.get\("\/favicon-studio\.svg"\)/.test(server),
  'server.py exposes a /favicon-studio.svg route');

// ── 2. Studio Path panel made discreet/collapsible ─────────
console.log('studio-path-collapse');

// The container is now a <details> (collapsible) rather than an
// always-open <div>.
const detailsMatch = studio.match(
  /<details[^>]*class="studio-path-trail"[^>]*id="entrance-studio-path"[^>]*>/);
assert(!!detailsMatch,
  'entrance Studio Path panel is a collapsible <details> element');

// A <summary> carries the compact eyebrow as the collapsed affordance.
assert(/<summary class="studio-path-trail-summary">/.test(studio),
  'panel has a <summary> row for the collapsed state');
assert(/studio-path-trail-summary[\s\S]*Studio Path · three levels/.test(studio),
  'summary keeps the "Studio Path · three levels" label');

// Collapsed by default: the <details> must NOT carry the `open`
// attribute, so the rail starts compact.
assert(!!detailsMatch && !/\bopen\b/.test(detailsMatch[0]),
  'panel is collapsed by default (no open attribute) — keeps the rail clean');

// All three levels and all four actions are preserved inside the body.
const body = (studio.match(/studio-path-trail-body[\s\S]*?<\/details>/) || [''])[0];
assert(/L1[\s\S]*Living Profile/.test(body), 'L1 Living Profile preserved');
assert(/L2[\s\S]*Personal Home/.test(body), 'L2 Personal Home preserved');
assert(/L3[\s\S]*Personal OS/.test(body), 'L3 Personal OS preserved');
['studio-path-open-entrance', 'living-profile-open-entrance',
 'website-preview-open-entrance', 'studio-window-open-entrance'
].forEach(function (id) {
  assert(body.indexOf('id="' + id + '"') !== -1,
    'action preserved inside panel: #' + id);
});

// CSS reflects the collapsible treatment.
assert(/\.studio-path-trail\[open\]/.test(studio),
  'CSS styles the open state of the collapsible panel');
assert(/studio-path-trail-chevron/.test(studio),
  'CSS provides a chevron affordance for the summary');

if (failed) {
  console.error('\nFAILED: ' + failed + ' assertion(s).');
  process.exit(1);
}
console.log('\nOK: studio identity favicon + path-collapse test passed.');
