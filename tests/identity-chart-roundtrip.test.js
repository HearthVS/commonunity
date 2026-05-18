/* Identity chart JSON round-trip
 *
 * Verifies that buildCompassExport() round-trips the new birth
 * coordinates (lat/lng/tz) and the enhanced astrology blocks
 * (longitudes, precision metadata) under stable keys:
 *
 *   profile.birth_latitude / birth_longitude / birth_tz_offset_minutes
 *   profile.birth_coordinates.{latitude,longitude,tz_offset_minutes}
 *   profile.foundation.birth_coordinates.*
 *   profile.astrology.{sun,moon,rising,longitudes,precision}
 *   profile.vedic.{sun,moon,ascendant}
 *   profile.human_design.{type,profile,strategy,authority,incarnation_cross}
 *
 * We extract the JS function from index.html and exercise it in
 * isolation. This mirrors the pattern used by living-profile-foundation
 * .test.js and similar.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg + '  (= ' + JSON.stringify(actual) + ')');
  else fail(msg + '  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

console.log('Identity chart — JSON round-trip via buildCompassExport()');

const indexSrc = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

// Extract just the buildCompassExport function body. Search from
// "function buildCompassExport" to its terminating closing-brace at
// the same indent level, then run inside a fresh VM context.
const startMatch = indexSrc.indexOf('function buildCompassExport(s) {');
if (startMatch < 0) {
  console.error('FAIL — could not locate buildCompassExport() in index.html');
  process.exit(1);
}
// Naïve brace-counting parser to find the matching close.
let depth = 0;
let endIdx = -1;
let started = false;
for (let i = startMatch; i < indexSrc.length; i++) {
  const c = indexSrc[i];
  if (c === '{') { depth++; started = true; }
  else if (c === '}') {
    depth--;
    if (started && depth === 0) { endIdx = i + 1; break; }
  }
}
if (endIdx < 0) {
  console.error('FAIL — could not balance braces of buildCompassExport()');
  process.exit(1);
}
const fnSrc = indexSrc.slice(startMatch, endIdx);

// Run inside a sandboxed context.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fnSrc + '\nthis.buildCompassExport = buildCompassExport;', sandbox);
const buildCompassExport = sandbox.buildCompassExport;

// ── Synthetic Markus-like state ──────────────────────────────────
const state = {
  guide:     'Markus',
  companion: 'Markus Lehto',
  dob:       '1973-11-18',
  tob:       '03:21',
  pob:       'Sudbury Ontario Canada',
  points:    { work: { gk_num: '14', gk_line: '2' } },
  profile: {
    last_name:                       'Lehto',
    current_location:                'Tampere, Finland',
    bhramari_baseline_hz:            136.1,

    birth_latitude:                  46.4917,
    birth_longitude:                 -80.9930,
    birth_tz_offset_minutes:         -300,

    human_design_type:               'Manifesting Generator',
    human_design_profile:            '4/6',
    human_design_strategy:           'Respond',
    human_design_authority:          'Sacral',
    human_design_incarnation_cross:  'Right Angle Cross of Planning',

    astrology_sun:                   'Scorpio',
    astrology_moon:                  'Virgo',
    astrology_rising:                'Libra',
    astrology_longitudes:            { sun: 235.86, moon: 159.45, ascendant: 188.59 },
    astrology_precision:             { sun: 'derived', moon: 'derived', rising: 'derived', sidereal_ayanamsha: 'lahiri-approx' },

    vedic_sun:                       'Libra',
    vedic_moon:                      'Leo · Magha pada 2',
    vedic_ascendant:                 'Virgo · Hasta pada 1',

    gene_keys_life_work:             "GK 14 · Bounteousness (Line 2)"
  }
};

const out = buildCompassExport(state);
assert(out && out.profile, 'export returned a profile');

const p = out.profile;
assertEq(p.birth_latitude,            46.4917,    'profile.birth_latitude round-trips as number');
assertEq(p.birth_longitude,           -80.9930,   'profile.birth_longitude round-trips as number');
assertEq(p.birth_tz_offset_minutes,   -300,        'profile.birth_tz_offset_minutes round-trips as number');

assert(p.birth_coordinates && typeof p.birth_coordinates === 'object',
  'profile.birth_coordinates object exists');
assertEq(p.birth_coordinates.latitude,           46.4917, 'birth_coordinates.latitude');
assertEq(p.birth_coordinates.longitude,          -80.9930, 'birth_coordinates.longitude');
assertEq(p.birth_coordinates.tz_offset_minutes,  -300,     'birth_coordinates.tz_offset_minutes');

assertEq(p.astrology.sun,   'Scorpio', 'profile.astrology.sun');
assertEq(p.astrology.moon,  'Virgo',   'profile.astrology.moon');
assertEq(p.astrology.rising,'Libra',   'profile.astrology.rising');
assert(p.astrology.longitudes && typeof p.astrology.longitudes === 'object',
  'profile.astrology.longitudes round-trips');
assert(p.astrology.precision && p.astrology.precision.sidereal_ayanamsha === 'lahiri-approx',
  'profile.astrology.precision.sidereal_ayanamsha = lahiri-approx');

assertEq(p.vedic.sun,       'Libra',                  'profile.vedic.sun');
assertEq(p.vedic.moon,      'Leo · Magha pada 2',     'profile.vedic.moon');
assertEq(p.vedic.ascendant, 'Virgo · Hasta pada 1',   'profile.vedic.ascendant');

assertEq(p.human_design.type,              'Manifesting Generator',          'profile.human_design.type');
assertEq(p.human_design.profile,           '4/6',                            'profile.human_design.profile');
assertEq(p.human_design.strategy,          'Respond',                        'profile.human_design.strategy');
assertEq(p.human_design.authority,         'Sacral',                         'profile.human_design.authority');
assertEq(p.human_design.incarnation_cross, 'Right Angle Cross of Planning',  'profile.human_design.incarnation_cross');

// Foundation block carries the same coordinates so older importers see them.
assert(p.foundation && p.foundation.birth_coordinates, 'profile.foundation.birth_coordinates is present');
assertEq(p.foundation.birth_coordinates.latitude,           46.4917,  'foundation birth_coordinates.latitude');
assertEq(p.foundation.birth_coordinates.longitude,          -80.9930, 'foundation birth_coordinates.longitude');
assertEq(p.foundation.birth_coordinates.tz_offset_minutes,  -300,     'foundation birth_coordinates.tz_offset_minutes');

// JSON.stringify must round-trip cleanly — no circular refs, no nulls
// in the structured longitudes object.
const serialized = JSON.stringify(out, null, 2);
const reparsed   = JSON.parse(serialized);
assertEq(reparsed.profile.birth_coordinates.latitude, 46.4917, 'serialize→parse preserves lat');
assertEq(reparsed.profile.astrology.precision.sidereal_ayanamsha, 'lahiri-approx',
  'serialize→parse preserves precision metadata');

if (failed > 0) {
  console.error('\n' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('\nAll identity-chart round-trip assertions passed.');
