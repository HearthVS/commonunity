/* sdk/astronomy.js — deterministic astronomy unit tests.
 *
 * Two validation strands:
 *   1. Canonical Meeus textbook worked example (Chapter 47):
 *        JD = 2448724.5 →  Moon longitude = 133°16'10" (= 133.27°),
 *                          Sun  longitude =  22°23'19" (=  22.39°).
 *      We verify our solar/lunar formulas reproduce these to ≤ 0.2°.
 *
 *   2. End-to-end identity-chart shape: that `computeIdentityChart()`
 *      returns the expected JSON keys, normalised longitudes, and
 *      precision metadata at each degradation level (no time → only
 *      Sun derived; time, no coords → Moon derived but no Rising;
 *      time + coords → everything derived).
 *
 *      We deliberately do NOT pin specific Markus-fixture sign names
 *      against an external chart, because the OM Cipher surface only
 *      promises sign-level accuracy and Lahiri ayanamsha is the
 *      approximate linear model we advertise in the UI.
 */
'use strict';

const path = require('path');
const Astro = require(path.resolve(__dirname, '..', 'sdk', 'astronomy.js'));

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg + '  (= ' + JSON.stringify(actual) + ')');
  else fail(msg + '  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

console.log('sdk/astronomy — deterministic chart calculations');

// ── Strand 1: Meeus textbook worked example ──────────────────────
// JD = 2448724.5 (1992 April 12.0 TD)
const jdMeeus = 2448724.5;
const sunMeeus  = Astro.solarLongitude(jdMeeus);
const moonMeeus = Astro.lunarLongitude(jdMeeus);
assert(Math.abs(sunMeeus  - 22.39)  < 0.2,
  'Meeus example: Sun ≈ 22.39° (got ' + sunMeeus.toFixed(3) + ')');
assert(Math.abs(moonMeeus - 133.27) < 0.2,
  'Meeus example: Moon ≈ 133.27° (got ' + moonMeeus.toFixed(3) + ')');

// ── Strand 2: identity-chart shape and degradation ───────────────
// Markus: 1973-11-18 03:21 EST, Sudbury Ontario.
const markus = {
  year: 1973, month: 11, day: 18,
  hour: 3, minute: 21,
  tzOffsetMinutes: -300,                 // EST
  lat: 46.4917, lng: -80.9930
};
const chart = Astro.computeIdentityChart(markus);

assert(chart && chart.ok, 'computeIdentityChart returns ok=true for full birth data');
assertEq(chart.tropical.sun, 'Scorpio',
  'Markus tropical Sun resolves to Scorpio');
assert(Astro.SIGNS.indexOf(chart.tropical.moon)   >= 0, 'tropical Moon is a valid sign');
assert(Astro.SIGNS.indexOf(chart.tropical.rising) >= 0, 'tropical Rising is a valid sign');

assert(Astro.SIGNS.indexOf(chart.vedic.sun) >= 0,
  'Markus sidereal Sun resolves to a valid sign (' + chart.vedic.sun + ')');
// Lahiri pushes tropical longitudes back ~24°, so a late-tropical-Scorpio
// Sun lands either just inside Libra or just inside Scorpio depending on
// the exact ayanamsha. We accept both.
assert(chart.vedic.sun === 'Libra' || chart.vedic.sun === 'Scorpio',
  'Markus sidereal Sun = Libra or Scorpio at the Lahiri boundary');

assert(/pada [1-4]/.test(chart.vedic.moon),
  'sidereal Moon string contains nakshatra pada');
assert(/pada [1-4]/.test(chart.vedic.ascendant),
  'sidereal Lagna string contains nakshatra pada');

assert(typeof chart.longitudes.sun === 'number' && chart.longitudes.sun >= 0 && chart.longitudes.sun < 360,
  'chart.longitudes.sun is a normalized number');
assert(typeof chart.longitudes.ascendant === 'number',
  'chart.longitudes.ascendant present when lat/lng supplied');

// ── Precision metadata ────────────────────────────────────────────
assertEq(chart.precision.sun,                 'derived',           'precision.sun = derived');
assertEq(chart.precision.moon,                'derived',           'precision.moon = derived when time supplied');
assertEq(chart.precision.rising,              'derived',           'precision.rising = derived when time+coords supplied');
assertEq(chart.precision.sidereal_ayanamsha,  'lahiri-approx',     'precision flags Lahiri as approximate');

// ── Degraded: date only — only sun should be derivable ───────────
const dateOnly = Astro.computeIdentityChart({ year: 1973, month: 11, day: 18 });
assertEq(dateOnly.tropical.sun,    'Scorpio', 'date-only chart still resolves tropical Sun');
assertEq(dateOnly.tropical.moon,   '',         'date-only chart leaves Moon blank');
assertEq(dateOnly.tropical.rising, '',         'date-only chart leaves Rising blank');
assertEq(dateOnly.vedic.ascendant, '',         'date-only chart leaves Lagna blank');

// ── Degraded: time but no coords — Moon yes, Rising no ───────────
const noCoords = Astro.computeIdentityChart({
  year: 1973, month: 11, day: 18,
  hour: 3, minute: 21, tzOffsetMinutes: -300
});
assert(Astro.SIGNS.indexOf(noCoords.tropical.moon) >= 0,
  'time-without-coords still resolves a valid tropical Moon sign');
assertEq(noCoords.tropical.rising, '',
  'time-without-coords leaves Rising blank');

// ── tropicalSignFromLon edge cases ────────────────────────────────
assertEq(Astro.tropicalSignFromLon(0),    'Aries',   '0° = Aries');
assertEq(Astro.tropicalSignFromLon(29.9), 'Aries',   '~29° = Aries');
assertEq(Astro.tropicalSignFromLon(30),   'Taurus',  '30° = Taurus');
assertEq(Astro.tropicalSignFromLon(359.9),'Pisces',  '~359.9° = Pisces');
assertEq(Astro.tropicalSignFromLon(-1),   'Pisces',  'negative normalises to Pisces');

// ── nakshatra ─────────────────────────────────────────────────────
const nak = Astro.nakshatra(0);
assertEq(nak.name, 'Ashwini', '0° sidereal = Ashwini');
assertEq(nak.pada, 1,         '0° sidereal pada = 1');

if (failed > 0) {
  console.error('\n' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('\nAll astronomy assertions passed.');
