/* sdk/human_design.js — deterministic Human Design / bodygraph
 * engine unit + integration tests.
 *
 * Coverage:
 *   1. Gate / line boundary mapping from ecliptic longitude.
 *   2. Channel completion from synthetic gate sets.
 *   3. Defined-center derivation from channels.
 *   4. Type inference for each of the five HD types from synthetic
 *      gate sets carefully chosen to define exactly the centers
 *      required by the standard mechanics.
 *   5. Authority hierarchy from defined-center maps.
 *   6. Markus fixture end-to-end: full chart from birth date + time
 *      + tz produces real Type / Strategy / Authority / Profile /
 *      Incarnation Cross — none should equal the legacy "requires
 *      bodygraph calculation" placeholder text.
 *
 * Run:  node tests/human-design-engine.test.js
 */
'use strict';

const path = require('path');
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

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · gate wheel — longitude → gate / line');
// Gate 41 begins the wheel at 302°.
assertEq(HD.gateLineFromLongitude(302).gate, 41,
  'longitude 302° lands in Gate 41');
assertEq(HD.gateLineFromLongitude(302).line, 1,
  'longitude 302° is line 1 of Gate 41');
// Right at the start of the next gate (19) — width is 5.625°.
assertEq(HD.gateLineFromLongitude(302 + 5.625 + 0.001).gate, 19,
  '302 + 5.625 (+ ε) lands in Gate 19');
// Line boundaries (0.9375° wide).
assertEq(HD.gateLineFromLongitude(302 + 0.9375 + 0.001).line, 2,
  'one line-width past Gate 41 start is line 2');
assertEq(HD.gateLineFromLongitude(302 + 5.625 - 0.001).line, 6,
  'final line of Gate 41 is line 6');
// Wrap-around: 0° tropical = +58° from wheel start → falls in the
// 10th gate of the sequence: 41,19,13,49,30,55,37,63,22,36 → Gate 36
// → no, 58° / 5.625° = 10.31 → idx 10 → Gate 25 (11th, 0-indexed 10).
assertEq(HD.gateLineFromLongitude(0).gate, 25,
  'longitude 0° (Aries 0°) lands in Gate 25');

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · channels — gate pairs complete channels');
assertEq(HD.definedChannelsFromGates([34, 20]).length, 1,
  'gates 34 + 20 complete one channel (Charisma)');
assertEq(HD.definedChannelsFromGates([34, 20])[0].name, 'Charisma',
  'channel 34-20 is named Charisma');
assertEq(HD.definedChannelsFromGates([34]).length, 0,
  'gate 34 alone does NOT complete a channel');
assertEq(HD.definedChannelsFromGates([34, 20, 57]).length, 3,
  'gates 34 + 20 + 57 complete three channels (34-20, 34-57, 20-57)');
assert(
  HD.CHANNELS.length === 36,
  'channel table has 36 canonical channels (got ' + HD.CHANNELS.length + ')'
);

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · centers — channels light up centers');
{
  const ch = HD.definedChannelsFromGates([34, 20]);
  const c  = HD.definedCentersFromChannels(ch);
  assert(c.Throat === true,  'channel 34-20 defines Throat');
  assert(c.Sacral === true,  'channel 34-20 defines Sacral');
  assert(c.G === false,      'channel 34-20 does NOT define G');
}

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · type inference — synthetic gate sets');

// Reflector — no defined centers at all.
{
  const c = HD.definedCentersFromChannels([]);
  assertEq(HD.computeType(c, []), 'Reflector',
    'no defined centers → Reflector');
}

// Pure Generator — Sacral defined but no motor-to-Throat.
// Channel 5-15 defines G + Sacral. Throat undefined → Generator.
{
  const ch = HD.definedChannelsFromGates([5, 15]);
  const c  = HD.definedCentersFromChannels(ch);
  assertEq(HD.computeType(c, ch), 'Generator',
    'gates 5 + 15 (G + Sacral, no Throat) → Generator');
  assertEq(HD.computeAuthority('Generator', c), 'Sacral',
    'Generator with Sacral defined → Sacral authority');
}

// Manifesting Generator — Sacral defined AND motor reaches Throat.
// Channel 34-20 defines Throat + Sacral directly.
{
  const ch = HD.definedChannelsFromGates([34, 20]);
  const c  = HD.definedCentersFromChannels(ch);
  assertEq(HD.computeType(c, ch), 'Manifesting Generator',
    'gates 34 + 20 (Sacral motor → Throat) → Manifesting Generator');
}

// Manifestor — motor reaches Throat WITHOUT Sacral.
// Channel 21-45 defines Heart (motor) + Throat. Sacral undefined.
{
  const ch = HD.definedChannelsFromGates([21, 45]);
  const c  = HD.definedCentersFromChannels(ch);
  assertEq(HD.computeType(c, ch), 'Manifestor',
    'gates 21 + 45 (Heart motor → Throat, no Sacral) → Manifestor');
  assertEq(HD.computeAuthority('Manifestor', c), 'Ego · Heart',
    'Manifestor with only Heart defined → Ego/Heart authority');
}

// Projector — at least one defined center, no Sacral, no motor-to-Throat.
// Channel 64-47 defines Head + Ajna. No Throat, no Sacral, no motor.
{
  const ch = HD.definedChannelsFromGates([64, 47]);
  const c  = HD.definedCentersFromChannels(ch);
  assertEq(HD.computeType(c, ch), 'Projector',
    'gates 64 + 47 (Head + Ajna only) → Projector');
  assertEq(HD.computeAuthority('Projector', c), 'Mental · Environmental',
    'Projector with only Head/Ajna → Mental/Environmental authority');
}

// Self-Projected Projector — G + Throat defined via channel, no motor.
// Channel 1-8 defines G + Throat. No motor → Projector. Authority =
// Self-Projected · G.
{
  const ch = HD.definedChannelsFromGates([1, 8]);
  const c  = HD.definedCentersFromChannels(ch);
  assertEq(HD.computeType(c, ch), 'Projector',
    'gates 1 + 8 (G + Throat only) → Projector');
  assertEq(HD.computeAuthority('Projector', c), 'Self-Projected · G',
    'Projector with G + Throat defined → Self-Projected G authority');
}

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · authority hierarchy');
{
  // Solar Plexus trumps everything else.
  const c = HD.definedCentersFromChannels(
    HD.definedChannelsFromGates([30, 41, 5, 15]) // SP + Root + G + Sacral
  );
  assertEq(HD.computeAuthority('Generator', c), 'Emotional · Solar Plexus',
    'Solar Plexus defined → Emotional authority (trumps Sacral)');
}
{
  // Sacral trumps Splenic when SP undefined.
  const c = HD.definedCentersFromChannels(
    HD.definedChannelsFromGates([5, 15, 18, 58]) // G+Sacral + Spleen+Root
  );
  assertEq(HD.computeAuthority('Generator', c), 'Sacral',
    'Sacral defined (no SP) → Sacral authority (trumps Splenic)');
}

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · profile + incarnation cross from activations');
{
  const personality = {
    Sun:   { gate: 14, line: 2 },
    Earth: { gate: 8,  line: 2 }
  };
  const design = {
    Sun:   { gate: 29, line: 4 },
    Earth: { gate: 30, line: 4 }
  };
  assertEq(HD.computeProfile(personality, design), '2/4',
    'profile from personality Sun line 2 / design Sun line 4 → 2/4');
  const cross = HD.computeIncarnationCross(personality, design);
  assertEq(cross.class, 'Right Angle',
    'lines 2/4 → Right Angle Cross');
  assert(/14\/8 \| 29\/30/.test(cross.label),
    'cross label encodes the four gates');
}

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · Markus fixture — end-to-end bodygraph');
{
  // Markus Lehto · 1973-11-18 03:21 · Sudbury, Ontario, Canada (EST, UTC-5)
  const chart = HD.computeChart({
    year: 1973, month: 11, day: 18,
    hour: 3, minute: 21,
    tzOffsetMinutes: -300
  });
  assert(chart.ok, 'Markus chart computes ok');
  // Personality and design Sun gates match the fixture gk_profile
  // (the GK calculator uses the same gate wheel; the engine should
  // agree to gate-level resolution and within a line of the line
  // values stored in the fixture).
  assertEq(chart.activations.personality.Sun.gate, 14,
    'Markus Personality Sun lands on Gate 14');
  assertEq(chart.activations.personality.Earth.gate, 8,
    'Markus Personality Earth lands on Gate 8');
  assertEq(chart.activations.design.Sun.gate, 29,
    'Markus Design Sun lands on Gate 29');
  assertEq(chart.activations.design.Earth.gate, 30,
    'Markus Design Earth lands on Gate 30');

  // Type / Strategy / Authority / Profile / Cross must be filled —
  // never null / never the legacy "requires bodygraph" placeholder.
  const HD_PLACEHOLDERS = /requires bodygraph/i;
  assert(typeof chart.type === 'string' && !HD_PLACEHOLDERS.test(chart.type),
    'Type is a real string, not a "requires bodygraph" placeholder ('
    + chart.type + ')');
  assert(typeof chart.strategy === 'string' && !HD_PLACEHOLDERS.test(chart.strategy),
    'Strategy is a real string ('  + chart.strategy + ')');
  assert(typeof chart.authority === 'string' && !HD_PLACEHOLDERS.test(chart.authority),
    'Authority is a real string (' + chart.authority + ')');
  assert(typeof chart.profile === 'string' && /\d+\/\d+/.test(chart.profile),
    'Profile is N/M-shaped ('  + chart.profile + ')');
  assert(chart.incarnation_cross && chart.incarnation_cross.label
         && !HD_PLACEHOLDERS.test(chart.incarnation_cross.label),
    'Incarnation Cross is filled (' + chart.incarnation_cross.label + ')');

  assertEq(chart.profile, '2/4', 'Markus profile = 2/4');

  // Defined-center / channel sanity.
  assert(Array.isArray(chart.gates) && chart.gates.length > 0,
    'gates array is non-empty');
  assert(Array.isArray(chart.channels) && chart.channels.length > 0,
    'channels array is non-empty (Markus has at least one channel)');
  assert(chart.centers && Array.isArray(chart.centers.defined)
         && chart.centers.defined.length > 0,
    'centers.defined is non-empty');
  // Precision metadata should never echo the legacy placeholder.
  Object.keys(chart.precision).forEach(function (k) {
    assert(!HD_PLACEHOLDERS.test(chart.precision[k]),
      'precision[' + k + '] does not say "requires bodygraph"');
  });
}

// ─────────────────────────────────────────────────────────────────────
console.log('\nHD engine · degrades cleanly without birth time');
{
  const chart = HD.computeChart({ year: 1973, month: 11, day: 18 });
  // Without birth time the engine still runs but type-determination
  // can drift; we only require it doesn't throw and produces a shape.
  assert(chart.ok, 'chart still computes without birth time');
  assert(/calculated from birth date/.test(chart.precision.type),
    'precision metadata is degraded (no birth time)');
}

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: Human Design engine tests pass.');
