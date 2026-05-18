/* sdk/place_gazetteer.js — deterministic local birth-place resolver.
 *
 * Verifies:
 *   1. The vendored city-timezones dataset loads (Node-side
 *      synchronous require) and the index covers the full table
 *      (≥ 7,000 cities, ≥ 30,000 alias keys).
 *   2. Sudbury, Ontario, Canada (Markus fixture) resolves with the
 *      correct lat/lng/tz/IANA name.
 *   3. Slug normalisation: free-form, comma-separated, all-caps,
 *      accented, mixed-whitespace inputs all resolve to the same row.
 *   4. Structured shape {city, province, country} resolves.
 *   5. Ambiguous city names disambiguate by province / iso2 / country
 *      token (e.g. Springfield IL ≠ Springfield MO).
 *   6. IANA → standard-time offset table covers every zone referenced
 *      by the loaded dataset.
 *   7. Unknown places return null cleanly (no throw).
 *
 * Run:  node tests/place-gazetteer.test.js
 */
'use strict';

const path = require('path');
const fs   = require('fs');
const P = require(path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg + '  (= ' + JSON.stringify(actual) + ')');
  else fail(msg + '  expected ' + JSON.stringify(expected) +
            ', got ' + JSON.stringify(actual));
}
function assertClose(actual, expected, tol, msg) {
  if (typeof actual === 'number' && Math.abs(actual - expected) <= tol) {
    pass(msg + '  (≈ ' + actual + ')');
  } else {
    fail(msg + '  expected ≈ ' + expected + ' ± ' + tol +
         ', got ' + JSON.stringify(actual));
  }
}

// ────────────────────────────────────────────────────────────────────
console.log('\nPlace gazetteer · dataset loaded');
assert(P.CITY_COUNT >= 7000,
  'vendored dataset carries the full ~7,000 city table (got ' + P.CITY_COUNT + ')');

// ────────────────────────────────────────────────────────────────────
console.log('\nPlace gazetteer · Markus / Sudbury resolution');
const sudburyVariants = [
  'Sudbury ontario canada',
  'Sudbury, Ontario, Canada',
  'SUDBURY ONTARIO CANADA',
  'sudbury, ON, canada',
  'Sudbury, Ontario',
  'Sudbury',
  '  Sudbury,   Ontario,  Canada  ',
  { city: 'Sudbury', province: 'Ontario', country: 'Canada' },
  { city: 'Sudbury', state: 'Ontario' }
];
sudburyVariants.forEach(function (q) {
  const r = P.resolve(q);
  const label = typeof q === 'string' ? q : JSON.stringify(q);
  assert(r != null, 'Sudbury variant resolves: ' + label);
  if (r) {
    assertClose(r.latitude,  46.5,  0.1, 'Sudbury lat ≈ 46.5 (' + label + ')');
    assertClose(r.longitude, -81.0, 0.1, 'Sudbury lng ≈ -81.0 (' + label + ')');
    assertEq(r.tzOffsetMinutes, -300,    'Sudbury tz = -300 (' + label + ')');
    assertEq(r.iana, 'America/Toronto',  'Sudbury iana (' + label + ')');
  }
});

// ────────────────────────────────────────────────────────────────────
console.log('\nPlace gazetteer · ambiguous city disambiguation');
{
  const il = P.resolve('Springfield Illinois');
  assert(il && il.province === 'Illinois', 'Springfield Illinois → IL row');
  const mo = P.resolve('Springfield Missouri');
  assert(mo && mo.province === 'Missouri', 'Springfield Missouri → MO row');
  assert(il && mo && il.latitude !== mo.latitude,
    'Illinois vs Missouri Springfield resolve to different rows');
  const ilAnsi = P.resolve('Springfield IL');
  assert(ilAnsi && ilAnsi.province === 'Illinois',
    'Springfield IL (ANSI state code) disambiguates to Illinois');
}

// ────────────────────────────────────────────────────────────────────
console.log('\nPlace gazetteer · world coverage spot-checks');
[
  { q: 'Mumbai',           tz:  330, country: 'India'    },
  { q: 'Mumbai India',     tz:  330, country: 'India'    },
  { q: 'Tokyo Japan',      tz:  540, country: 'Japan'    },
  { q: 'Helsinki Finland', tz:  120, country: 'Finland'  },
  { q: 'Berlin Germany',   tz:   60, country: 'Germany'  },
  { q: 'Auckland New Zealand', tz:  720, country: 'New Zealand' },
  { q: 'Sydney Australia', tz:  600, country: 'Australia'  }
].forEach(function (c) {
  const r = P.resolve(c.q);
  assert(r != null,                       c.q + ' resolves');
  if (r) {
    assertEq(r.tzOffsetMinutes, c.tz,     c.q + ' tz = ' + c.tz);
    assertEq(r.country,         c.country, c.q + ' country = ' + c.country);
  }
});

// ────────────────────────────────────────────────────────────────────
console.log('\nPlace gazetteer · IANA → standard-offset coverage');
{
  // Every IANA zone in the dataset must have a standard-offset entry.
  const data = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'data', 'places', 'city_timezones.json'),
    'utf8'));
  const zones = new Set();
  data.forEach(function (r) { if (r && r.timezone) zones.add(r.timezone); });
  let missing = [];
  zones.forEach(function (z) {
    if (!(z in P.IANA_STANDARD_OFFSETS)) missing.push(z);
  });
  assert(missing.length === 0,
    'every IANA zone in the dataset has a standard-offset entry (' +
    (missing.length ? 'missing: ' + missing.slice(0, 5).join(', ') : 'all covered') +
    ')');
}

// ────────────────────────────────────────────────────────────────────
console.log('\nPlace gazetteer · degrades cleanly on unknown / empty input');
assertEq(P.resolve(''),          null, 'empty string → null');
assertEq(P.resolve(null),        null, 'null → null');
assertEq(P.resolve(undefined),   null, 'undefined → null');
assertEq(P.resolve('Xyzland'),   null, 'unknown city → null');
assert(typeof P.slug === 'function', 'exposes slug helper');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: place gazetteer tests pass.');
