/* Integration: Human Design bodygraph → OM Cipher record.
 *
 * Asserts that the OM Cipher engine, given a sealed input where
 * `human_design` carries the full calculated block from
 * sdk/human_design.js, surfaces the bodygraph values in the
 * metadata layer (hd_type / hd_strategy / hd_authority / hd_profile
 * / hd_incarnation_cross / hd_gates / hd_channels / hd_centers /
 * hd_calculation_method). These keys are how the studio bridge and
 * Living Profile foundation block read calculated HD downstream.
 *
 * Also asserts round-trip: passing the OM Cipher record's
 * `sealed_inputs.human_design` back into a fresh `generate()` call
 * produces the same hd_* metadata (export/import safety).
 *
 * Run:  node tests/human-design-om-cipher-integration.test.js
 */
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const path = require('path');
const HD = require(path.resolve(__dirname, '..', 'sdk', 'human_design.js'));
const om = require(path.resolve(__dirname, '..', 'sdk', 'om_cipher.js'));

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg + '  (= ' + JSON.stringify(actual) + ')');
  else fail(msg + '  expected ' + JSON.stringify(expected) +
            ', got ' + JSON.stringify(actual));
}

// Calculate the HD chart for Markus.
const chart = HD.computeChart({
  year: 1973, month: 11, day: 18,
  hour: 3, minute: 21,
  tzOffsetMinutes: -300
});
assert(chart.ok, 'HD engine produces a chart for Markus');

const hdBlock = {
  type:               chart.type,
  strategy:           chart.strategy,
  authority:          chart.authority,
  profile:            chart.profile,
  incarnation_cross:  chart.incarnation_cross,
  gates:              chart.gates,
  channels:           chart.channels,
  centers:            chart.centers,
  calculation_method: chart.method,
  precision:          chart.precision
};

// Feed into the OM Cipher engine.
const input = {
  birth_date: '1973-11-18',
  birth_time: '03:21',
  birth_place: { city: 'Sudbury', province: 'Ontario', country: 'Canada' },
  legal_name: 'Markus Lehto',
  preferred_name: 'Markus',
  compass: { work: { gk_num: 14, gk_line: 2 } },
  human_design: hdBlock,
  seed_syllable: 'Om',
  bhramari_baseline: null
};

const rec = om.generate(input);
assert(!rec.pending, 'OM Cipher generates a sealed record');
assert(typeof rec.seed === 'string' && rec.seed.length === 64,
  'seed is a 64-char SHA-256 hex');

console.log('\nOM Cipher metadata · HD fields surface');
const meta = rec.metadata || {};
assertEq(meta.hd_type,      'Generator',           'metadata.hd_type');
assertEq(meta.hd_strategy,  'To wait to respond',  'metadata.hd_strategy');
assertEq(meta.hd_authority, 'Emotional · Solar Plexus', 'metadata.hd_authority');
assertEq(meta.hd_profile,   '2/4',                 'metadata.hd_profile');
assert(typeof meta.hd_incarnation_cross === 'string'
       && /Right Angle Cross/.test(meta.hd_incarnation_cross),
       'metadata.hd_incarnation_cross is the calculated label');
assert(Array.isArray(meta.hd_gates) && meta.hd_gates.length > 0,
       'metadata.hd_gates is a non-empty list');
assert(Array.isArray(meta.hd_channels) && meta.hd_channels.length > 0,
       'metadata.hd_channels is a non-empty list');
assert(meta.hd_centers && Array.isArray(meta.hd_centers.defined),
       'metadata.hd_centers carries defined/open structure');
assert(typeof meta.hd_calculation_method === 'string'
       && /commonunity-hd-v1/.test(meta.hd_calculation_method),
       'metadata.hd_calculation_method names the engine');

// Round-trip safety — sealed_inputs.human_design should be intact
// and re-generating with it must produce the same hd_* metadata.
console.log('\nOM Cipher · round-trip preserves HD bodygraph');
const sealed = rec.sealed_inputs && rec.sealed_inputs.human_design;
assert(sealed && sealed.type === 'Generator',
       'sealed_inputs.human_design round-trips Type');
assert(sealed.profile === '2/4',
       'sealed_inputs.human_design round-trips Profile');

const rec2 = om.generate(Object.assign({}, input, { human_design: sealed }));
assertEq(rec2.metadata.hd_type, 'Generator', 'round-tripped record still has hd_type');
assertEq(rec2.metadata.hd_profile, '2/4',    'round-tripped record still has hd_profile');
assertEq(rec2.seed, rec.seed,
  'seed is deterministic across the round-trip (HD block is not in canonical seed string)');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: HD → OM Cipher integration tests pass.');
