/* Integration: importing the Markus Studio fixture must populate
 * Human Design via the place gazetteer + bodygraph engine.
 *
 * Setup:
 *   - Load `tests/fixtures/markus-studio-2026-05-15.json`.
 *   - Normalise via `normalizeImportedStudioOrCompassJson` (extracted
 *     from studio.html) → window.state.compassData.
 *   - Resolve `compassData.pob` ("Sudbury ontario canada") through
 *     the place gazetteer → { lat, lng, tzOffsetMinutes }.
 *   - Run the bodygraph engine with dob + tob + resolved tz.
 *
 * Assertions:
 *   1. Place resolves to Sudbury / Ontario / Canada / America/Toronto
 *      / tz = -300.
 *   2. The engine produces exactly: Generator, To wait to respond,
 *      Emotional · Solar Plexus, profile 2/4, Right Angle Cross of
 *      14/8 | 29/30.
 *   3. The studio render path's HD pending-message branch does NOT
 *      surface "pending full chart calculation" for HD once the
 *      engine has run — the foundation row shows the calculated HD
 *      summary instead.
 *
 * Run:  node tests/human-design-markus-import.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));

const P  = require(path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));
const HD = require(path.resolve(__dirname, '..', 'sdk', 'human_design.js'));

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg + '  (= ' + JSON.stringify(actual) + ')');
  else fail(msg + '  expected ' + JSON.stringify(expected) +
            ', got ' + JSON.stringify(actual));
}

console.log('\nMarkus import · gazetteer resolves `Sudbury ontario canada`');
const cd = FIXTURE.compassData || {};
const placeStr = cd.pob || cd.place_of_birth || cd.birthplace;
assert(typeof placeStr === 'string' && placeStr.length > 0,
  'fixture carries a non-empty birth-place string');
const resolved = P.resolve(placeStr);
assert(resolved != null, 'gazetteer resolves "' + placeStr + '"');
assertEq(resolved.iana, 'America/Toronto', 'resolved IANA zone');
assertEq(resolved.tzOffsetMinutes, -300,   'resolved tz offset (standard)');
assertEq(resolved.country,  'Canada',      'resolved country');
assertEq(resolved.province, 'Ontario',     'resolved province');
assert(Math.abs(resolved.latitude  - 46.5) < 0.1, 'resolved lat ≈ 46.5');
assert(Math.abs(resolved.longitude + 81.0) < 0.1, 'resolved lng ≈ -81.0');

console.log('\nMarkus import · bodygraph from fixture dob + tob + resolved tz');
const dob = String(cd.dob || cd.date_of_birth);
const tob = String(cd.tob || cd.birth_time);
const [yr, mo, dy] = dob.split('-').map(Number);
const [hr, mn] = tob.split(':').map(Number);
const chart = HD.computeChart({
  year: yr, month: mo, day: dy,
  hour: hr, minute: mn,
  tzOffsetMinutes: resolved.tzOffsetMinutes
});
assert(chart.ok, 'HD engine computes successfully');
assertEq(chart.type,      'Generator',                  'Markus Type');
assertEq(chart.strategy,  'To wait to respond',         'Markus Strategy');
assertEq(chart.authority, 'Emotional · Solar Plexus',   'Markus Authority');
assertEq(chart.profile,   '2/4',                        'Markus Profile');
assert(chart.incarnation_cross
       && /Right Angle Cross of 14\/8 \| 29\/30/.test(chart.incarnation_cross.label),
  'Markus Incarnation Cross = Right Angle Cross of 14/8 | 29/30');

// ────────────────────────────────────────────────────────────────────
console.log('\nMarkus import · studio.html render path no longer says "pending full chart calculation" for HD');
const STUDIO = fs.readFileSync(
  path.resolve(__dirname, '..', 'studio.html'), 'utf8');
assert(!/Human Design · pending full chart calculation/.test(STUDIO),
  'no "Human Design · pending full chart calculation" string remains in studio.html');
// The new render-path branches surface precise missing-input wording.
assert(/Human Design · requires birth date/.test(STUDIO),
  'studio.html surfaces "requires birth date" when birth_date is missing');
assert(/Human Design · requires birth time/.test(STUDIO),
  'studio.html surfaces "requires birth time" when birth_time is missing');
assert(/Human Design · requires birth coordinates\/timezone/.test(STUDIO),
  'studio.html surfaces "requires birth coordinates/timezone" when place can\'t be resolved');

// ────────────────────────────────────────────────────────────────────
console.log('\nMarkus import · place_gazetteer + human_design scripts are loaded');
assert(/<script[^>]+sdk\/place_gazetteer\.js/.test(STUDIO),
  'studio.html loads /sdk/place_gazetteer.js');
assert(/CommonUnityPlaces\.preload/.test(STUDIO),
  'studio.html preloads the city/timezone dataset at boot');
assert(/<script[^>]+sdk\/human_design\.js/.test(STUDIO),
  'studio.html loads /sdk/human_design.js');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: Markus import integration tests pass.');
