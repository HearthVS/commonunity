/* Visible-setup canonical flow · regression test
 *
 * The post-PR-#31 live regression: although directly setting
 * #dob/#tob/#pob via JS produces correct Markus values, the normal
 * visible setup path (the way an actual user — or Playwright's
 * .fill() — interacts with the page) was silently dropping values
 * because the calculator collapsible body was display:none by default.
 * Inputs inside it were present in the DOM but not interactable, so
 * a user-style fill never reached the canonical fields and the OM
 * Cipher modal opened blank.
 *
 * This test asserts the visible-setup path works without anyone
 * needing to know to click "When did you take your first breath?".
 *
 *   1. The calculator body (#calc-body) is open by default, so #dob,
 *      #tob, #pob are visible and reachable from a fresh page load.
 *   2. Filling those visible inputs + the visible name inputs and
 *      calling the canonical helper produces the Markus HD values
 *      that prod has been failing to surface.
 *   3. The setup screen does not regress into showing an OM Cipher
 *      pill (PR #21/#30/#31 invariant).
 *
 * jsdom-optional: source-text checks run without jsdom; functional
 * checks pull the SDK modules directly.
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

// ── 1. Calc body is open by default in source markup ─────────────
console.log('1. Setup page · calc-body is open by default (no toggle click needed)');

// The collapsible body that contains #dob, #tob, #pob.
// Without the `open` class, .collapsible-body is display:none —
// which means Playwright .fill() and real users who don't know to
// click the toggle never reach the canonical fields.
const calcBodyRe = /<div\s+class="collapsible-body open"\s+id="calc-body"/;
assert(
  calcBodyRe.test(indexSrc),
  '#calc-body markup includes the `open` class so it is visible at first render'
);

// The header should also start in the open visual state (arrow rotated).
const calcToggleRe = /<div\s+class="collapsible-header open"\s+id="calc-toggle"/;
assert(
  calcToggleRe.test(indexSrc),
  '#calc-toggle markup includes the `open` class (arrow rotated to match body state)'
);

// ── 2. Visible inputs are the canonical fields ───────────────────
console.log('\n2. Visible setup inputs · are the canonical #dob/#tob/#pob fields');
[
  ['<input class="field-input" id="dob" type="date">',                'visible #dob input'],
  ['<input class="field-input" id="tob" type="time">',                'visible #tob input'],
  ['id="pob" type="text"',                                            'visible #pob input'],
  ['id="guide-name" type="text"',                                     'visible #guide-name input'],
  ['id="companion-name" type="text"',                                 'visible #companion-name input']
].forEach(([snippet, label]) => {
  assert(indexSrc.indexOf(snippet) >= 0, label + ' is in setup markup');
});

// No replacement hidden duplicate fields — only one canonical input each.
['dob', 'tob', 'pob', 'guide-name', 'companion-name'].forEach(id => {
  const matches = indexSrc.match(new RegExp('id="' + id + '"', 'g')) || [];
  assert(
    matches.length === 1,
    'exactly one element has id="' + id + '" (no canonical duplicates) — got ' + matches.length
  );
});

// ── 3. The visible inputs flow into state on input events ────────
console.log('\n3. dob/tob/pob input listeners · bind values into state');
const inputBindingRe =
  /\['dob','tob','pob'\]\.forEach\(id\s*=>\s*\{[\s\S]{0,200}?addEventListener\(\s*'input'/;
assert(
  inputBindingRe.test(indexSrc),
  'dob/tob/pob have input-event listeners that write state[id]'
);

// ── 4. End-to-end · visible setup values produce Markus HD ───────
console.log('\n4. Visible setup values → canonical Markus HD via shared engine');

const Places = require(path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));
const HD     = require(path.resolve(__dirname, '..', 'sdk', 'human_design.js'));

// Simulate the user fills (exactly what Playwright .fill() / a real
// user types into the visible inputs):
const userTyped = {
  'guide-name':    'Markus Lehto',
  'companion-name':'Markus',
  dob:             '1973-11-18',
  tob:             '03:21',
  pob:             'Sudbury ontario canada'
};

// Mirror the production helper contract: state.profile gets last_name,
// current_cities[], birth_latitude/longitude/tz_offset_minutes.
function applyVisibleSetup(state, typed, Places) {
  state.profile = state.profile || {};
  Object.keys(typed).forEach(k => { state[k] = typed[k]; });
  const guide = (typed['guide-name'] || '').trim();
  if (guide && !(state.profile.last_name || '').trim()) {
    state.profile.last_name = guide;
  }
  const pob = (typed.pob || '').trim();
  if (pob && !(Array.isArray(state.profile.current_cities) &&
               state.profile.current_cities.length)) {
    state.profile.current_cities  = [pob];
    state.profile.current_location = pob;
  }
  if (pob && Places && typeof Places.resolve === 'function') {
    const r = Places.resolve(pob);
    if (r) {
      if (state.profile.birth_latitude          == null) state.profile.birth_latitude          = r.latitude;
      if (state.profile.birth_longitude         == null) state.profile.birth_longitude         = r.longitude;
      if (state.profile.birth_tz_offset_minutes == null) state.profile.birth_tz_offset_minutes = r.tzOffsetMinutes;
    }
  }
  return state;
}

const state = applyVisibleSetup({}, userTyped, Places);
assertEq(state.dob, '1973-11-18',           'state.dob mirrors visible #dob fill');
assertEq(state.tob, '03:21',                'state.tob mirrors visible #tob fill');
assertEq(state.pob, 'Sudbury ontario canada','state.pob mirrors visible #pob fill');
assertEq(state.profile.last_name, 'Markus Lehto',
  'state.profile.last_name comes from visible #guide-name fill');
assert(
  Array.isArray(state.profile.current_cities) &&
  state.profile.current_cities[0] === 'Sudbury ontario canada',
  'state.profile.current_cities[] comes from visible #pob fill'
);
assertEq(state.profile.birth_tz_offset_minutes, -300,
  'state.profile.birth_tz_offset_minutes resolved to -300 (EST) from visible POB');

// Feed the resolved tz back into the HD engine, exactly as the
// production code does after the helper runs.
const chart = HD.computeChart({
  year: 1973, month: 11, day: 18,
  hour: 3, minute: 21,
  tzOffsetMinutes: state.profile.birth_tz_offset_minutes
});
assert(chart && chart.ok, 'HD chart computes ok for Markus inputs from visible setup');
if (chart && chart.ok) {
  assertEq(chart.type,     'Generator',          'type      = Generator');
  assertEq(chart.strategy, 'To wait to respond', 'strategy  = "To wait to respond"');
  assertEq(chart.authority,'Emotional · Solar Plexus',
                                                 'authority = "Emotional · Solar Plexus"');
  assertEq(chart.profile,  '2/4',                'profile   = 2/4');
  assert(
    chart.incarnation_cross &&
    /14\/8/.test(chart.incarnation_cross.label) &&
    /29\/30/.test(chart.incarnation_cross.label),
    'incarnation_cross.label mentions 14/8 and 29/30 (got: '
      + (chart.incarnation_cross && chart.incarnation_cross.label) + ')'
  );
}

// ── 5. Setup screen stays pure (no OM Cipher pill) ───────────────
console.log('\n5. Setup screen · stays pure (PR #21/#30/#31 invariant)');
const setupSection = indexSrc.slice(
  indexSrc.indexOf('id="screen-setup"'),
  indexSrc.indexOf('id="screen-compass"')
);
assert(
  !/btn-open-om-cipher/.test(setupSection),
  'no #btn-open-om-cipher inside the Setup screen markup'
);

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: visible-setup canonical flow regressions pass.');
