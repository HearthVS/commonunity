/* End-to-end studio.html flow: importing the Markus fixture must
 * populate the OM Cipher input (via cuBuildOmCipherInput) with a
 * calculated human_design block — without the live user editing
 * coordinates / timezone manually. The fixture only carries dob +
 * tob + a free-form pob string.
 *
 * We extract cuBuildOmCipherInput + cuMergeGeneKeysSlots from
 * studio.html, eval them against a fake window/state seeded from the
 * fixture, and assert:
 *   - place gazetteer resolves the Sudbury birthplace
 *   - cuBuildOmCipherInput's returned `human_design` block carries
 *     calculated Type / Strategy / Authority / Profile / Cross
 *   - state.compassData.profile.human_design is persisted
 *
 * Run:  node tests/human-design-studio-import-flow.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));
const STUDIO = fs.readFileSync(
  path.resolve(__dirname, '..', 'studio.html'), 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }
function assertEq(actual, expected, msg) {
  if (actual === expected) pass(msg + '  (= ' + JSON.stringify(actual) + ')');
  else fail(msg + '  expected ' + JSON.stringify(expected) +
            ', got ' + JSON.stringify(actual));
}

// ── Extract the two functions from studio.html ────────────────────
function extractFn(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = STUDIO.search(re);
  if (start < 0) throw new Error('could not locate function ' + name);
  let depth = 0, i = STUDIO.indexOf('{', start);
  for (; i < STUDIO.length; i++) {
    const c = STUDIO[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return STUDIO.slice(start, i);
}

const SRC_MERGE = extractFn('cuMergeGeneKeysSlots');
const SRC_BUILD = extractFn('cuBuildOmCipherInput');

// ── Seed a fake window/state from the fixture ──────────────────────
global.window = global;
global.window.state = {
  compassData: FIXTURE.compassData,
  birthData:   FIXTURE.birthData,
  person:      FIXTURE.person
};
global.CommonUnityHumanDesign = require(path.resolve(__dirname, '..', 'sdk', 'human_design.js'));
global.window.CommonUnityHumanDesign = global.CommonUnityHumanDesign;
global.CommonUnityPlaces = require(path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));
global.window.CommonUnityPlaces = global.CommonUnityPlaces;

// Sanity — the gazetteer in Node-side already loaded the full
// dataset from disk; if the test environment somehow lacks it, the
// emergency-inline subset (which includes Sudbury) covers Markus.
console.log('\nStudio import · gazetteer ready for Markus');
const r = global.CommonUnityPlaces.resolve(FIXTURE.compassData.pob);
assert(r != null, 'gazetteer resolves Markus pob in this test process');
assertEq(r.tzOffsetMinutes, -300, 'tz = -300');

// ── Eval the two helpers and capture cuBuildOmCipherInput ─────────
const setup = new Function(SRC_MERGE + '\n' + SRC_BUILD +
  '\n; return cuBuildOmCipherInput;');
const cuBuildOmCipherInput = setup();

// ── Run cuBuildOmCipherInput against the fixture ──────────────────
console.log('\nStudio import · cuBuildOmCipherInput returns a calculated HD block');
const input = cuBuildOmCipherInput();
assert(input != null, 'cuBuildOmCipherInput returns a non-null shape');
assertEq(input.birth_date, '1973-11-18', 'birth_date pulled from fixture compassData.dob');
assertEq(input.birth_time, '03:21',      'birth_time pulled from fixture compassData.tob');
assert(input.human_design != null,        'human_design block present');
const hd = input.human_design || {};
assertEq(hd.type,      'Generator',                'HD type');
assertEq(hd.strategy,  'To wait to respond',       'HD strategy');
assertEq(hd.authority, 'Emotional · Solar Plexus', 'HD authority');
assertEq(hd.profile,   '2/4',                       'HD profile');
assert(hd.incarnation_cross
       && /Right Angle Cross of 14\/8 \| 29\/30/.test(hd.incarnation_cross.label),
  'HD incarnation_cross.label = Right Angle Cross of 14/8 | 29/30');
assert(Array.isArray(hd.gates)    && hd.gates.length    > 0, 'HD gates populated');
assert(Array.isArray(hd.channels) && hd.channels.length > 0, 'HD channels populated');
assert(hd.centers && Array.isArray(hd.centers.defined),       'HD centers structure populated');
assert(/commonunity-hd-v1/.test(hd.calculation_method || ''), 'HD method named');

// ── Persistence — the engine output was written back to state ─────
console.log('\nStudio import · resolved HD + coords persisted to compassData.profile');
const profHd = window.state.compassData.profile && window.state.compassData.profile.human_design;
assert(profHd && profHd.type === 'Generator',
  'state.compassData.profile.human_design persisted');
const bc = window.state.compassData.profile && window.state.compassData.profile.birth_coordinates;
assert(bc && bc.iana === 'America/Toronto',
  'state.compassData.profile.birth_coordinates persisted with resolved iana');
assertEq(bc.tz_offset_minutes, -300, 'persisted tz_offset_minutes = -300');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: studio-import HD-from-place flow tests pass.');
