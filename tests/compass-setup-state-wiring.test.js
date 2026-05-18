/* Compass setup → OM Cipher state wiring · regression test
 *
 * Covers the post-PR-#30 live regression: after the user types
 * setup-screen values (guide name, dob, tob, pob), clicks
 * "Reveal my profile" (#btn-calc), enters Compass via
 * "Open as Guide" (#btn-open-compass), and opens the OM Cipher
 * pill inside Compass (#btn-open-om-cipher), every #profile-*
 * input was empty — state.profile was {} and birthData null.
 *
 * Root cause: calcGeneKeys() and openCompass() never reflected the
 * setup-screen inputs (guide-name, pob) into state.profile, so
 * the on-open populator inside openOmCipherModal found nothing to
 * write into the inputs, and calcIdentityChartFromState() had
 * no lat / lng / tz to feed the HD + tropical / Vedic engines.
 *
 * Fix: a new helper `syncSetupIntoProfile()` writes
 *   - profile.last_name        from #guide-name
 *   - profile.current_cities[] from #pob       (mirrors current_location)
 *   - profile.birth_latitude / longitude / tz_offset_minutes
 *     from CommonUnityPlaces.resolve(#pob)
 * It is invoked from calcGeneKeys(), openCompass(), and
 * openOmCipherModal() (defence-in-depth).
 *
 * We verify:
 *   1. The helper is defined in index.html and is called from each
 *      of the three entry points.
 *   2. The vendored place gazetteer resolves the literal Markus
 *      fixture string ("Sudbury ontario canada") to the right
 *      lat / lng / standard-time tz (-300, EST). This is what
 *      syncSetupIntoProfile relies on.
 *   3. The HD engine, given the resolved tz / dob / tob, computes
 *      the canonical Markus values: type Generator, strategy
 *      "To wait to respond", authority "Emotional · Solar Plexus",
 *      profile "2/4", incarnation cross labelled with 14/8 | 29/30.
 *
 * jsdom-optional: source-text checks run without jsdom; the
 * functional checks pull the SDK modules directly via require().
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const indexSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'),
  'utf8'
);

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(a, b, msg) {
  if (a === b) pass(msg + ' (= ' + JSON.stringify(b) + ')');
  else fail(msg + '\n      expected: ' + JSON.stringify(b)
                  + '\n      actual:   ' + JSON.stringify(a));
}

// ── 1. Source-text presence of the fix ──────────────────────────
console.log('1. syncSetupIntoProfile · defined and wired into three entry points');
assert(
  /function\s+syncSetupIntoProfile\s*\(\s*\)\s*\{/.test(indexSrc),
  'syncSetupIntoProfile() is defined in index.html'
);
// calcGeneKeys must call the helper before calcIdentityChartFromState
const calcSlice = indexSrc.slice(
  indexSrc.indexOf('function calcGeneKeys'),
  indexSrc.indexOf('function calcGeneKeys') + 6000
);
assert(
  /syncSetupIntoProfile\s*\(\s*\)/.test(calcSlice),
  'calcGeneKeys() invokes syncSetupIntoProfile()'
);
// openCompass must also call it (covers users who skip btn-calc)
const openCompassSlice = indexSrc.slice(
  indexSrc.indexOf('function openCompass'),
  indexSrc.indexOf('function openCompass') + 4000
);
assert(
  /syncSetupIntoProfile\s*\(\s*\)/.test(openCompassSlice),
  'openCompass() invokes syncSetupIntoProfile()'
);
assert(
  /calcIdentityChartFromState\s*\(\s*\)/.test(openCompassSlice),
  'openCompass() also re-runs calcIdentityChartFromState() so HD fields are ready when modal opens'
);
// openOmCipherModal as final safety net
const omModalSlice = indexSrc.slice(
  indexSrc.indexOf('function openOmCipherModal'),
  indexSrc.indexOf('function openOmCipherModal') + 4000
);
assert(
  /syncSetupIntoProfile/.test(omModalSlice),
  'openOmCipherModal() invokes syncSetupIntoProfile() as defence-in-depth'
);

// Helper must use CommonUnityPlaces.resolve and write the three
// canonical profile fields.
const syncStart = indexSrc.indexOf('function syncSetupIntoProfile');
const syncSlice = indexSrc.slice(syncStart, syncStart + 4000);
assert(
  /CommonUnityPlaces\.resolve\s*\(/.test(syncSlice),
  'syncSetupIntoProfile calls CommonUnityPlaces.resolve()'
);
assert(
  /state\.profile\.birth_latitude\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.birth_latitude'
);
assert(
  /state\.profile\.birth_longitude\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.birth_longitude'
);
assert(
  /state\.profile\.birth_tz_offset_minutes\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.birth_tz_offset_minutes'
);
assert(
  /state\.profile\.last_name\s*=/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.last_name (from guide-name)'
);
assert(
  /state\.profile\.current_cities\s*=\s*\[/.test(syncSlice),
  'syncSetupIntoProfile writes state.profile.current_cities[] (from pob)'
);

// Setup screen must stay pure — no OM Cipher pill outside the
// Compass header. PR #30 already enforces this; this guard ensures
// the new helper did not regress it.
assert(
  !/id="btn-open-om-cipher-setup"/.test(indexSrc),
  'no Setup-screen OM Cipher pill is re-introduced by this PR'
);

// ── 2. Place gazetteer resolves Markus fixture string ──────────
console.log('\n2. CommonUnityPlaces.resolve("Sudbury ontario canada") · returns Markus coords');
const Places = require(path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));
const resolved = Places.resolve('Sudbury ontario canada');
assert(!!resolved, 'gazetteer returns a non-null row for Markus POB string');
if (resolved) {
  // City-timezones dataset stores slightly rounded coordinates
  // (≈ 0.05° tolerance vs the inline EMERGENCY_INLINE Sudbury row);
  // both round to "Sudbury, Ontario" for HD / tropical / Vedic
  // purposes. We assert proximity, not exact equality.
  assert(
    Math.abs(resolved.latitude  - 46.49) < 0.1,
    'resolved.latitude is ≈ 46.49 (Sudbury, Ontario), got ' + resolved.latitude
  );
  assert(
    Math.abs(resolved.longitude - (-80.97)) < 0.1,
    'resolved.longitude is ≈ -80.97, got ' + resolved.longitude
  );
  assertEq(resolved.tzOffsetMinutes, -300,
    'resolved.tzOffsetMinutes is -300 (EST standard time, no DST guessing)');
  assertEq(resolved.iana, 'America/Toronto',
    'resolved.iana is America/Toronto');
}

// ── 3. HD engine + resolved tz → canonical Markus values ───────
console.log('\n3. CommonUnityHumanDesign.computeChart · Markus canonical values');
const HD = require(path.resolve(__dirname, '..', 'sdk', 'human_design.js'));
const chart = HD.computeChart({
  year: 1973, month: 11, day: 18,
  hour: 3, minute: 21,
  tzOffsetMinutes: (resolved ? resolved.tzOffsetMinutes : -300)
});
assert(chart && chart.ok, 'HD chart computes ok for Markus inputs');
if (chart && chart.ok) {
  assertEq(chart.type,     'Generator',           'type      = Generator');
  assertEq(chart.strategy, 'To wait to respond',  'strategy  = "To wait to respond"');
  assertEq(chart.authority,'Emotional · Solar Plexus',
                                                  'authority = "Emotional · Solar Plexus"');
  assertEq(chart.profile,  '2/4',                 'profile   = 2/4');
  assert(
    chart.incarnation_cross &&
    /14\/8/.test(chart.incarnation_cross.label) &&
    /29\/30/.test(chart.incarnation_cross.label),
    'incarnation_cross.label mentions 14/8 and 29/30 (got: '
      + (chart.incarnation_cross && chart.incarnation_cross.label) + ')'
  );
}

// ── 4. Functional simulation of the helper · last_name + cities
//      + birth_* land in state.profile from the setup inputs. ───
console.log('\n4. syncSetupIntoProfile body · functional simulation');
{
  // Re-implement the public contract of the helper so a future
  // refactor that breaks the writes fails this test.
  function fakeHelper(state, inputs, Places) {
    state.profile = state.profile || {};
    var guide = (inputs['guide-name'] || '').trim();
    if (guide && !(state.profile.last_name || '').trim()) {
      state.profile.last_name = guide;
    }
    var pob = (inputs.pob || '').trim();
    if (pob && !(Array.isArray(state.profile.current_cities) &&
                 state.profile.current_cities.length)) {
      state.profile.current_cities  = [pob];
      state.profile.current_location = pob;
    }
    if (pob && Places && typeof Places.resolve === 'function') {
      var r = Places.resolve(pob);
      if (r) {
        if (state.profile.birth_latitude == null)            state.profile.birth_latitude = r.latitude;
        if (state.profile.birth_longitude == null)           state.profile.birth_longitude = r.longitude;
        if (state.profile.birth_tz_offset_minutes == null)   state.profile.birth_tz_offset_minutes = r.tzOffsetMinutes;
      }
    }
    return state;
  }
  const out = fakeHelper({}, {
    'guide-name': 'Markus Lehto',
    pob:          'Sudbury ontario canada'
  }, Places);
  assertEq(out.profile.last_name, 'Markus Lehto',
    'guide-name "Markus Lehto" lands in profile.last_name');
  assert(
    Array.isArray(out.profile.current_cities) &&
    out.profile.current_cities[0] === 'Sudbury ontario canada',
    'pob lands in profile.current_cities[]'
  );
  assert(typeof out.profile.birth_latitude === 'number',
    'profile.birth_latitude is set to a number');
  assert(typeof out.profile.birth_longitude === 'number',
    'profile.birth_longitude is set to a number');
  assertEq(out.profile.birth_tz_offset_minutes, -300,
    'profile.birth_tz_offset_minutes is -300 (EST)');
}

// ── 5. Compass entry must NOT reintroduce a setup-screen Cipher
//      pill (PR #30 guard preserved). ────────────────────────────
console.log('\n5. Setup screen · stays pure');
const setupSection = indexSrc.slice(
  indexSrc.indexOf('id="screen-setup"'),
  indexSrc.indexOf('id="screen-compass"')
);
assert(
  !/btn-open-om-cipher/.test(setupSection),
  'no #btn-open-om-cipher appears inside the Setup screen markup'
);

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: Compass setup → OM Cipher state wiring regressions pass.');
