// Studio import · source-data backfill for legacy JSON.
//
// The 2026-05-15 Markus Studio export was produced before PR #40/#41
// introduced `om_cipher.source_data`. It carries only dob/tob/pob and
// gk_profile/points — no profile.astrology, no profile.vedic, no
// profile.birth_coordinates. Without help, Studio's OM Cipher Source
// Data section shows "Moon · Rising · pending full chart calculation".
//
// `cuBackfillSourceDataFromBirth` (added in studio.html) re-runs the
// same deterministic calculators the root Compass uses on btn-calc:
//
//   - CommonUnityPlaces.resolve(pob)            → lat / lng / tz
//   - CommonUnityAstro.computeIdentityChart()   → tropical + vedic
//
// and writes the results onto state.compassData.profile.* only when the
// target field is blank. It's a no-op when inputs aren't calculable.
//
// This test reproduces the legacy Markus import:
//   1. Loads markus-studio-2026-05-15.json (vendored fixture).
//   2. Hydrates a minimal fake `state` from it.
//   3. Provides `window.CommonUnityAstro` and `window.CommonUnityPlaces`.
//   4. Extracts and executes `cuBackfillSourceDataFromBirth` from
//      studio.html.
//   5. Asserts tropical Sun/Moon/Rising, sidereal Sun/Moon/Lagna, and
//      birth coordinates are now populated; downstream engine still
//      seals to Markus baseline (LP22 / Ex8 / SU6 / Pe11 master / MA·VA·RA).
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-studio-import-source-data-backfill.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const fs     = require('fs');
const path   = require('path');
const assert = require('node:assert/strict');

const om     = require('../sdk/om_cipher.js');
const astro  = require('../sdk/astronomy.js');
const places = require('../sdk/place_gazetteer.js');

const studioHtml = fs.readFileSync(path.resolve(__dirname, '..', 'studio.html'), 'utf8');

// Vendored Markus fixture (canonical legacy shape: no om_cipher,
// no profile.astrology / vedic / birth_coordinates).
const FIXTURE_PATH = '/home/user/workspace/markus-studio-2026-05-15.json';
function loadFixture() {
  if (fs.existsSync(FIXTURE_PATH)) {
    return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  }
  // Fallback: synthesize the minimum shape from the documented values.
  return {
    version: 'studio-v1',
    person: 'Markus',
    compassData: {
      guide: 'Markus Lehto',
      companion: 'Markus',
      dob: '1973-11-18',
      tob: '03:21',
      pob: 'Sudbury ontario canada',
      gk_profile: { cs:14,csLine:2,us:29,usLine:4,ce:8,ceLine:2,ue:30,ueLine:4 },
      points: {
        work:  { gk_num: 14, gk_line: 2 },
        lens:  { gk_num: 8,  gk_line: 2 },
        field: { gk_num: 29, gk_line: 4 },
        call:  { gk_num: 30, gk_line: 4 },
      },
      profile: { first_name: 'Markus', full_name: 'Markus', birthdate: '1973-11-18' },
    },
  };
}

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

const SRC_BACKFILL = extractFn(studioHtml, 'cuBackfillSourceDataFromBirth');

// Build a fake window mirroring what the studio.html runtime provides
// at backfill time. `state` is a free variable inside the function, so
// the runner must inject it as a parameter.
function makeWin() {
  return {
    CU_OM_CIPHER_ENABLED: true,
    cuOmCipher:           om,
    CommonUnityAstro:     astro,
    CommonUnityPlaces:    places,
  };
}

function runBackfill(state) {
  const win = makeWin();
  win.state = state;
  // Evaluate the extracted backfill in a scope where `state` and
  // `window` resolve to our injected fakes.
  const runner = new Function('window', 'state',
    SRC_BACKFILL + '\n' +
    'cuBackfillSourceDataFromBirth();\n'
  );
  runner(win, state);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('Studio import · source-data backfill on legacy JSON');

const fixture = loadFixture();
const state = {
  person: fixture.person || null,
  compassData: JSON.parse(JSON.stringify(fixture.compassData || {})),
  rooms: { work:{}, lens:{}, field:{}, call:{} },
};
const profBefore = state.compassData.profile || {};

test('legacy fixture has no astrology / vedic / birth_coordinates before backfill', () => {
  assert.ok(!profBefore.astrology,         'profile.astrology absent before backfill');
  assert.ok(!profBefore.vedic,             'profile.vedic absent before backfill');
  assert.ok(!profBefore.birth_coordinates, 'profile.birth_coordinates absent before backfill');
});

runBackfill(state);
const prof = state.compassData.profile;

test('birth_coordinates resolved from "Sudbury ontario canada"', () => {
  assert.ok(prof.birth_coordinates, 'profile.birth_coordinates populated');
  assert.ok(typeof prof.birth_coordinates.latitude  === 'number');
  assert.ok(typeof prof.birth_coordinates.longitude === 'number');
  assert.ok(typeof prof.birth_coordinates.tz_offset_minutes === 'number');
  // Sudbury Ontario gazetteer entry.
  assert.ok(Math.abs(prof.birth_coordinates.latitude  - 46.49998985) < 0.01);
  assert.ok(Math.abs(prof.birth_coordinates.longitude - -80.96664474) < 0.01);
  assert.equal(prof.birth_coordinates.tz_offset_minutes, -300);
  assert.equal(prof.birth_coordinates.iana, 'America/Toronto');
});

test('tropical astrology — Sun Scorpio, Moon Virgo, Rising Libra', () => {
  assert.ok(prof.astrology, 'profile.astrology populated');
  assert.equal(prof.astrology.sun,    'Scorpio');
  assert.equal(prof.astrology.moon,   'Virgo');
  assert.equal(prof.astrology.rising, 'Libra');
});

test('vedic / sidereal — Sun Scorpio, Sidereal Moon Leo · Purva Phalguni pada 1, Lagna Virgo · Hasta pada 2', () => {
  assert.ok(prof.vedic, 'profile.vedic populated');
  assert.equal(prof.vedic.sun,       'Scorpio');
  assert.equal(prof.vedic.moon,      'Leo · Purva Phalguni pada 1');
  assert.equal(prof.vedic.ascendant, 'Virgo · Hasta pada 2');
});

test('engine on backfilled state emits om_cipher.source_data with tropical/vedic/coords', () => {
  // Drive the canonical engine the same way buildCompassExport does.
  const input = {
    birth_date: state.compassData.dob,
    birth_time: state.compassData.tob,
    legal_name: state.compassData.guide || state.compassData.companion,
    preferred_name: state.compassData.companion || state.compassData.person,
    compass: {
      work:  { gk_num: 14, gk_line: 2 },
      lens:  { gk_num: 8,  gk_line: 2 },
      field: { gk_num: 29, gk_line: 4 },
      call:  { gk_num: 30, gk_line: 4 },
    },
    astrology: prof.astrology,
    vedic:     prof.vedic,
    birth_coordinates: prof.birth_coordinates,
    human_design: { type: 'Generator', authority: 'Emotional Solar Plexus', profile: '2/4' },
  };
  const rec = om.generate(input, { featureFlag: true });
  assert.ok(rec.om_cipher_block, 'om_cipher_block present');
  const sd = rec.om_cipher_block.source_data;
  assert.ok(sd, 'source_data present after backfill');
  assert.equal(sd.astrology.sun,    'Scorpio');
  assert.equal(sd.astrology.moon,   'Virgo');
  assert.equal(sd.astrology.rising, 'Libra');
  assert.equal(sd.vedic.sun,        'Scorpio');
  assert.equal(sd.vedic.moon,       'Leo · Purva Phalguni pada 1');
  assert.equal(sd.vedic.ascendant,  'Virgo · Hasta pada 2');
  assert.equal(typeof sd.birth_coordinates.latitude,  'number');
  assert.equal(typeof sd.birth_coordinates.longitude, 'number');
  assert.equal(sd.birth_coordinates.tz_offset_minutes, -300);
});

test('engine still seals to Markus baseline — Pe11 master + MA·VA·RA preserved', () => {
  const input = {
    birth_date: state.compassData.dob,
    birth_time: state.compassData.tob,
    legal_name: state.compassData.guide || 'Markus Lehto',
    preferred_name: state.compassData.companion || 'Markus',
    compass: {
      work:  { gk_num: 14, gk_line: 2 },
      lens:  { gk_num: 8,  gk_line: 2 },
      field: { gk_num: 29, gk_line: 4 },
      call:  { gk_num: 30, gk_line: 4 },
    },
    astrology: prof.astrology,
    vedic:     prof.vedic,
    birth_coordinates: prof.birth_coordinates,
    human_design: { type: 'Generator', authority: 'Emotional Solar Plexus', profile: '2/4' },
  };
  const rec = om.generate(input, { featureFlag: true });
  // Master 11 visible on the Source-Pattern card.
  assert.equal(rec.metadata.personality.value,     11);
  assert.equal(rec.metadata.personality.is_master, true);
  // Emergent cipher name MA·VA·RA preserved.
  assert.equal(rec.om_cipher_block.layer5.cipher_name, 'MAVARA');
  // Sealed seed unchanged (PE:2 in the canonical seed string).
  assert.ok(/\|PE:2\|/.test(rec.seed_string));
});

test('backfill is a no-op for user-entered values (does not overwrite)', () => {
  // Run again with explicit pre-existing values; they should survive.
  const s2 = {
    compassData: {
      dob: '1973-11-18', tob: '03:21', pob: 'Sudbury ontario canada',
      profile: {
        astrology: { sun: 'CustomSun', moon: 'CustomMoon', rising: 'CustomRising' },
        vedic:     { sun: 'V1', moon: 'V2', ascendant: 'V3' },
        birth_coordinates: { latitude: 1, longitude: 2, tz_offset_minutes: 60 },
      },
    },
  };
  runBackfill(s2);
  const p = s2.compassData.profile;
  assert.equal(p.astrology.sun,    'CustomSun');
  assert.equal(p.astrology.moon,   'CustomMoon');
  assert.equal(p.astrology.rising, 'CustomRising');
  assert.equal(p.vedic.sun,       'V1');
  assert.equal(p.vedic.moon,      'V2');
  assert.equal(p.vedic.ascendant, 'V3');
  assert.equal(p.birth_coordinates.latitude,  1);
  assert.equal(p.birth_coordinates.longitude, 2);
  assert.equal(p.birth_coordinates.tz_offset_minutes, 60);
});

test('backfill degrades gracefully without dob (no throw, no fill)', () => {
  const s3 = { compassData: { profile: {} } };
  // Should not throw.
  runBackfill(s3);
  assert.ok(!s3.compassData.profile.astrology, 'no astrology without dob');
  assert.ok(!s3.compassData.profile.vedic,     'no vedic without dob');
});

test('studio.html hooks cuBackfillSourceDataFromBirth into processCompassImport + studioLoadJSON', () => {
  // Lock the integration points so future refactors don't drop them.
  assert.ok(/cuBackfillSourceDataFromBirth\(\)/.test(studioHtml),
    'backfill function should be invoked from studio.html');
  const calls = (studioHtml.match(/cuBackfillSourceDataFromBirth\(\)/g) || []).length;
  assert.ok(calls >= 2,
    'backfill should be hooked into both processCompassImport and studioLoadJSON (>= 2 call sites); got ' + calls);
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
