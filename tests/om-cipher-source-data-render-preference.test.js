// Source-data render preference + Compass export parity.
//
// Locks the contract that:
//   1. buildCompassExport() (root index.html runtime) emits an
//      `om_cipher.source_data` mirror carrying tropical sun/moon/rising,
//      vedic sun/moon/ascendant, and birth coordinates / timezone when
//      those values are present on `state.profile`.
//   2. Studio's `ocSourceDataItems` renderer reads from
//      `om_cipher.source_data` FIRST (the canonical round-trip surface)
//      with a graceful fallback to legacy `profile.*` for older exports.
//   3. Markus's visible Source-Pattern card shows Personality 11 (master)
//      and the structural source-data render hooks still surface Moon,
//      Rising, Sidereal/Vedic Moon, Lagna/Ascendant, latitude, longitude,
//      and timezone offset.
//   4. The emergent cipher name remains MA·VA·RA (preserved-behaviour).
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-source-data-render-preference.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const fs     = require('fs');
const path   = require('path');
const assert = require('node:assert/strict');

const om = require('../sdk/om_cipher.js');
const indexHtml  = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const studioHtml = fs.readFileSync(path.resolve(__dirname, '..', 'studio.html'), 'utf8');

function extractFn(html, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = html.search(re);
  assert.ok(start > 0, 'could not locate function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

const fakeDoc = { getElementById: () => ({ value: '' }) };
const fakeWin = {
  CU_OM_CIPHER_ENABLED: true,
  cuOmCipher: om,
  document: fakeDoc,
};

const SRC_RESOLVE   = extractFn(indexHtml, '_resolveCompassSource');
const SRC_MERGE_GK  = extractFn(indexHtml, '_mergeCompassGeneKeysSlots');
const SRC_BUILD_OC  = extractFn(indexHtml, '_buildOmCipherInputFromCompass');
const SRC_BUILD_EXP = extractFn(indexHtml, 'buildCompassExport');

new Function('window', 'document',
  SRC_RESOLVE + '\n' +
  SRC_MERGE_GK + '\n' +
  SRC_BUILD_OC + '\n' +
  SRC_BUILD_EXP + '\n' +
  'window._buildCompassExport_test = buildCompassExport;\n'
)(fakeWin, fakeDoc);

// Root Compass state for Markus, with astrology / vedic / coords filled
// at the profile root the way Compass writes them after a calc flow.
const markusState = {
  theme: 'A',
  tradition: 'GK',
  guide: 'Markus Lehto',
  companion: 'Markus',
  dob: '1973-11-18',
  tob: '03:21',
  pob: 'Sudbury ontario canada',
  gk_profile: {
    cs: 14, csLine: 2,
    us: 29, usLine: 4,
    ce: 8,  ceLine: 2,
    ue: 30, ueLine: 4,
  },
  points: {
    work:  { gk_num: 14, gk_line: 2 },
    lens:  { gk_num: 8,  gk_line: 2 },
    field: { gk_num: 29, gk_line: 4 },
    call:  { gk_num: 30, gk_line: 4 },
  },
  profile: {
    astrology_sun:    'Scorpio',
    astrology_moon:   'Pisces',
    astrology_rising: 'Libra',
    vedic_sun:        'Libra',
    vedic_moon:       'Aquarius · Shatabhisha',
    vedic_ascendant:  'Virgo',
    birth_latitude:           46.49,
    birth_longitude:         -80.99,
    birth_tz_offset_minutes: -300,
    // HD enables the emergent cipher-name generator (MA · VA · RA for
    // Markus = gate 14 / Emotional Solar Plexus / line 2).
    human_design_type:      'Generator',
    human_design_authority: 'Emotional Solar Plexus',
    human_design_profile:   '2/4',
  },
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('om_cipher · source-data render preference + Compass export parity');

const exported = fakeWin._buildCompassExport_test(markusState);
const oc = exported && exported.om_cipher;

test('buildCompassExport emits om_cipher.source_data', () => {
  assert.ok(oc, 'om_cipher block present');
  assert.ok(oc.source_data, 'om_cipher.source_data present');
});

test('source_data.astrology mirrors tropical Sun · Moon · Rising', () => {
  assert.equal(oc.source_data.astrology.sun,    'Scorpio');
  assert.equal(oc.source_data.astrology.moon,   'Pisces');
  assert.equal(oc.source_data.astrology.rising, 'Libra');
});

test('source_data.vedic mirrors Sidereal Sun · Moon · Ascendant', () => {
  assert.equal(oc.source_data.vedic.sun,       'Libra');
  assert.equal(oc.source_data.vedic.moon,      'Aquarius · Shatabhisha');
  assert.equal(oc.source_data.vedic.ascendant, 'Virgo');
});

test('source_data.birth_coordinates mirrors latitude/longitude/tz_offset_minutes', () => {
  assert.equal(oc.source_data.birth_coordinates.latitude,          46.49);
  assert.equal(oc.source_data.birth_coordinates.longitude,        -80.99);
  assert.equal(oc.source_data.birth_coordinates.tz_offset_minutes, -300);
});

test('source_data.note clarifies these are preserved, not driving the sigil/name', () => {
  assert.ok(typeof oc.source_data.note === 'string' && /not driving/i.test(oc.source_data.note));
});

test('Personality is the preserved master 11 in metadata + layer1 (display path)', () => {
  // metadata.personality is the visible Source-Pattern card. layer1 is the
  // structured block. Both must agree on the master 11.
  const rec = om.generate({
    birth_date: '1973-11-18',
    birth_time: '03:21',
    legal_name: 'Markus Lehto',
    preferred_name: 'Markus',
    compass: {
      work:  { gk_num: 14, gk_line: 2 },
      lens:  { gk_num: 8,  gk_line: 2 },
      field: { gk_num: 29, gk_line: 4 },
      call:  { gk_num: 30, gk_line: 4 },
    },
  }, { featureFlag: true });
  assert.equal(rec.metadata.personality.value, 11);
  assert.equal(rec.metadata.personality.is_master, true);
  assert.equal(rec.om_cipher_block.layer1.personality.value, 11);
  assert.equal(rec.om_cipher_block.layer1.personality.is_master, true);
});

test('emergent cipher name remains MA·VA·RA (preserved behaviour)', () => {
  assert.equal(oc.layer5.cipher_name, 'MAVARA');
  assert.ok(/MA[·.]?\s*VA[·.]?\s*RA/i.test(oc.layer5.cipher_name_display || oc.layer5.cipher_name));
});

test('canonical seed string still uses single-digit PE:2 (sealed seed unchanged)', () => {
  // The visible card preserves the master 11; the canonical seed string
  // continues to use the single-digit projection so the sealed seed is
  // byte-identical to the frozen Markus reference (LP:22|EX:8|SU:6|PE:2|…).
  const rec = om.generate({
    birth_date: '1973-11-18', birth_time: '03:21',
    legal_name: 'Markus Lehto', preferred_name: 'Markus',
    compass: {
      work:  { gk_num: 14, gk_line: 2 },
      lens:  { gk_num: 8,  gk_line: 2 },
      field: { gk_num: 29, gk_line: 4 },
      call:  { gk_num: 30, gk_line: 4 },
    },
  }, { featureFlag: true });
  assert.ok(/\|PE:2\|/.test(rec.seed_string),
    'canonical seed string should still carry single-digit PE:2; got: ' + rec.seed_string);
});

// ── Studio render: prefer om_cipher.source_data over profile.* ─────────
test('Studio ocSourceDataItems prefers om_cipher.source_data over profile.*', () => {
  // The contract is enforced structurally in studio.html: the renderer
  // tries `om_cipher.source_data` roots first, falls back to
  // `profile.astrology` / `profile.vedic` / `profile.birth_coordinates`.
  // We assert the source-of-truth string is present so the render
  // contract is locked in source.
  assert.ok(studioHtml.indexOf('source_data') > 0,
    'studio.html should reference om_cipher.source_data in the render path');
  assert.ok(/source_data\s*&&\s*ocSd\.astrology/.test(studioHtml.replace(/\s+/g, ' '))
            || /ocSd\s*&&\s*ocSd\.astrology/.test(studioHtml),
    'studio.html should read astrology from ocSd (source_data) before falling back to profile');
  assert.ok(/ocSd\s*&&\s*ocSd\.vedic/.test(studioHtml),
    'studio.html should read vedic from ocSd before falling back to profile');
  assert.ok(/ocSd\s*&&\s*ocSd\.birth_coordinates/.test(studioHtml),
    'studio.html should read birth_coordinates from ocSd before falling back to profile');
});

test('Studio Source-Data labels include Moon, Rising, Sidereal Moon, Lagna, coords/timezone', () => {
  // These labels are the structural hooks the Markus profile is expected
  // to surface when source_data is populated. They live verbatim in the
  // renderer template.
  ['Tropical Moon', 'Tropical Rising', 'Sidereal Moon · Nakshatra',
   'Lagna (Ascendant)', 'Latitude', 'Longitude', 'Timezone offset']
   .forEach(function (label) {
     assert.ok(studioHtml.indexOf(label) >= 0,
       'studio.html should carry the "' + label + '" Source-Data label');
  });
});

// ── No Hebrew gematria, no sealed personal_year (regression locks) ─────
test('exported om_cipher block excludes Hebrew gematria and sealed personal_year (only the explicit flags)', () => {
  // The block carries two explicit exclusion flags on .notes:
  //   notes.hebrew_gematria_excluded            = true
  //   notes.personal_year_excluded_from_sealed  = true
  // No other reference to "hebrew" or "personal_year" should appear.
  assert.equal(oc.notes && oc.notes.hebrew_gematria_excluded, true);
  assert.equal(oc.notes && oc.notes.personal_year_excluded_from_sealed, true);
  const layersDump = JSON.stringify({
    layer1: oc.layer1, layer2: oc.layer2, layer3: oc.layer3,
    layer4: oc.layer4, layer5: oc.layer5, layer6: oc.layer6,
    source_data: oc.source_data,
  }).toLowerCase();
  assert.ok(!/hebrew/.test(layersDump), 'no Hebrew gematria inside any layer');
  assert.ok(!/personal_year/.test(layersDump), 'no sealed personal_year inside any layer');
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
