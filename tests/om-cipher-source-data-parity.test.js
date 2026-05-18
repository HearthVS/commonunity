// OM Cipher · source-data parity (Compass ↔ Studio).
//
// Verifies that astrology / vedic / birth_coordinates fields captured in
// Compass survive end-to-end into the structured om_cipher block, and
// that adding them does NOT disturb the existing Markus baseline
// (Life Path 22 master + emergent name MA·VA·RA).
//
// This is source-data parity only — it does not assert that tropical or
// vedic signs drive the sigil/name (they currently don't; they are
// preserved for later layers).
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-source-data-parity.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const om = require('../sdk/om_cipher.js');

const MARKUS_INPUT = {
  birth_date: '1973-11-18',
  birth_time: '03:21',
  birth_place: { city: 'Sudbury', province: 'Ontario', country: 'Canada' },
  birth_coordinates: { latitude: 46.49, longitude: -80.99, tz_offset_minutes: -300 },
  legal_name: 'Markus Lehto',
  preferred_name: 'Markus',
  compass: {
    work:  { gk_num: 14, gk_line: 2 },
    lens:  { gk_num: 8,  gk_line: 2 },
    field: { gk_num: 29, gk_line: 4 },
    call:  { gk_num: 30, gk_line: 4 },
  },
  human_design: {
    type: 'Generator',
    authority: 'Emotional Solar Plexus',
    profile: '2/4',
    strategy: 'Wait to Respond',
    incarnation_cross: {
      label: 'Right Angle Cross of 14/8 | 29/30',
      gates: { personality_sun: 14, personality_earth: 8, design_sun: 29, design_earth: 30 },
    },
  },
  astrology: { sun: 'Scorpio', moon: 'Pisces', rising: 'Libra' },
  vedic:     { sun: 'Libra',   moon: 'Aquarius · Shatabhisha', ascendant: 'Virgo' },
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('om_cipher · source-data parity');

test('block.source_data carries tropical Sun · Moon · Rising verbatim', () => {
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  const sd = rec.om_cipher_block.source_data;
  assert.ok(sd, 'source_data should be present when astrology / vedic / coords supplied');
  assert.equal(sd.astrology.sun,    'Scorpio');
  assert.equal(sd.astrology.moon,   'Pisces');
  assert.equal(sd.astrology.rising, 'Libra');
});

test('block.source_data carries Vedic sidereal Sun · Moon · Lagna verbatim', () => {
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  const sd = rec.om_cipher_block.source_data;
  assert.equal(sd.vedic.sun,       'Libra');
  assert.equal(sd.vedic.moon,      'Aquarius · Shatabhisha');
  assert.equal(sd.vedic.ascendant, 'Virgo');
});

test('block.source_data carries birth coordinates + timezone offset', () => {
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  const sd = rec.om_cipher_block.source_data;
  assert.equal(sd.birth_coordinates.latitude,          46.49);
  assert.equal(sd.birth_coordinates.longitude,        -80.99);
  assert.equal(sd.birth_coordinates.tz_offset_minutes, -300);
});

test('source_data note clarifies these are not primary engine inputs', () => {
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  const sd = rec.om_cipher_block.source_data;
  assert.ok(typeof sd.note === 'string' && /not driving/i.test(sd.note),
    'source_data.note should make clear these values are not driving the current sigil/name');
});

test('source_data is null when nothing optional is supplied (no broken empty)', () => {
  const lean = Object.assign({}, MARKUS_INPUT);
  delete lean.astrology; delete lean.vedic; delete lean.birth_coordinates;
  const rec = om.generate(lean, { featureFlag: true });
  assert.equal(rec.om_cipher_block.source_data, null,
    'source_data should be omitted (null) when no astrology / vedic / coords are present');
});

test('adding source_data does not disturb Life Path 22 master', () => {
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  assert.equal(rec.om_cipher_block.layer1.life_path.value, 22,
    'LP22 master is preserved with extra source data on the input');
  assert.equal(rec.om_cipher_block.layer1.life_path.is_master, true);
});

test('adding source_data does not disturb the emergent cipher name MA·VA·RA', () => {
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  const l5 = rec.om_cipher_block.layer5;
  assert.equal(l5.cipher_name, 'MAVARA',
    'emergent cipher name still resolves to MAVARA when astrology/vedic are supplied');
  assert.ok(/MA[·.]?\s*VA[·.]?\s*RA/i.test(l5.cipher_name_display || l5.cipher_name),
    'cipher_name_display still surfaces the MA·VA·RA syllable trio');
});

test('seed remains deterministic — auxiliary source_data is preserved but not seeded', () => {
  const r1 = om.generate(MARKUS_INPUT, { featureFlag: true });
  const lean = Object.assign({}, MARKUS_INPUT);
  delete lean.astrology; delete lean.vedic; delete lean.birth_coordinates;
  const r2 = om.generate(lean, { featureFlag: true });
  assert.equal(r1.seed, r2.seed,
    'auxiliary source_data must not change the deterministic Cipher seed — those values are preserved, not seeded');
});

// ── Studio render parity (structural DOM presence) ─────────────────────
// The render path is a long DOM-driven function in studio.html; we
// don't boot a full DOM here. Instead we assert that the template carries
// the new hooks so the render contract is locked: the section heading,
// the four group containers (tropical / vedic / genekeys / coords), and
// the labels for Sun / Moon / Rising and the Vedic trio.
test('studio.html includes the new Source Data section + group hooks', () => {
  const studio = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
  assert.ok(/data-cu-om-cipher-source-data="1"/.test(studio),
    'studio.html should carry data-cu-om-cipher-source-data="1" on the new block');
  // The group attribute value is interpolated at runtime (lpEscape(name)),
  // so we assert the attribute key + each group name is passed to the
  // renderer alongside the matching group label.
  assert.ok(/data-cu-om-cipher-source-group=/.test(studio),
    'studio.html should carry the data-cu-om-cipher-source-group hook');
  ["'tropical'", "'vedic'", "'genekeys'", "'coords'"].forEach((tok) => {
    assert.ok(studio.indexOf('ocRowsGroup(ocSourceRows, ' + tok) >= 0,
      'studio.html should call ocRowsGroup with group ' + tok);
  });
});

test('studio Source Data labels include Tropical Sun/Moon/Rising and Vedic trio', () => {
  const studio = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
  assert.ok(/Tropical Sun/.test(studio),       'Tropical Sun label present');
  assert.ok(/Tropical Moon/.test(studio),      'Tropical Moon label present');
  assert.ok(/Tropical Rising/.test(studio),    'Tropical Rising label present');
  assert.ok(/Sidereal Sun/.test(studio),       'Sidereal Sun label present');
  assert.ok(/Sidereal Moon.*Nakshatra/.test(studio),
    'Sidereal Moon · Nakshatra label present');
  assert.ok(/Lagna \(Ascendant\)/.test(studio), 'Lagna (Ascendant) label present');
});

test('studio Source Data labels include the full Gene Keys activation sequence', () => {
  const studio = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
  // Inside the new oc-source-data block: Life Work / Evolution /
  // Radiance / Purpose — the four canonical activation-sequence slots.
  ['Life Work', 'Evolution', 'Radiance', 'Purpose'].forEach((lab) => {
    assert.ok(studio.indexOf(lab) >= 0, 'Gene Keys label "' + lab + '" present in studio.html');
  });
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
