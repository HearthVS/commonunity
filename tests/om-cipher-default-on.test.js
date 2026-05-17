// Regression for the screenshot bug: OM Cipher engine area staying on
// "Awaiting Compass seal" / "Pending source data" while the Cipher
// Foundation card below showed real birth_date / birth_time / birthplace.
//
// Root cause: window.CU_OM_CIPHER_ENABLED defaulted to false and was only
// flipped on by ?om_cipher=1 in the URL. The v2 section template, however,
// is now rendered unconditionally — so without the flag the engine never
// fills the surfaces and the placeholder copy persists.
//
// This test pins:
//   1. The default-on flag init in studio.html (no query param → engine on).
//   2. studioLoadJSON re-renders Living Profile / Website Preview if open
//      after a Studio JSON import (matches processCompassImport behavior).
//   3. cuAttachOmCipherMeta does NOT append the duplicate activation badge
//      inside the OM Cipher v2 section (the section already renders the
//      activation line on oc-field-pattern beside the sigil).
//   4. With the Markus fixture present, cuBuildOmCipherInput + the engine
//      derive cipher_name / mantra / story / contemplation / gematria /
//      activation / seal so the engine area never reads as pending.
//
// Run:  node tests/om-cipher-default-on.test.js

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const om = require('../sdk/om_cipher.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('Om Cipher — default-on engine + import re-render + meta dedupe');

// ── 1. CU_OM_CIPHER_ENABLED defaults to true ────────────────────────
test('CU_OM_CIPHER_ENABLED defaults to true (no opt-in query param required)', () => {
  // The studio.html init block sets the flag true by default and only
  // turns it off when ?om_cipher=0 is present. The OM Cipher v2 section
  // template is shipped unconditionally so the engine must be on too.
  assert.ok(
    /window\.CU_OM_CIPHER_ENABLED\s*=\s*true/.test(html),
    'expected an unconditional window.CU_OM_CIPHER_ENABLED = true in studio.html',
  );
  assert.ok(
    /om_cipher=0/.test(html),
    'expected a ?om_cipher=0 opt-out path in studio.html',
  );
  // The legacy opt-in pattern (only true when ?om_cipher=1 is present)
  // must not survive — that was the source of the placeholder-frozen bug.
  const initBlock = html.slice(html.indexOf('Om Cipher flag init'),
    html.indexOf('Om Cipher flag init') + 1200);
  assert.ok(
    !/if\s*\(\s*\/\[\?&\]om_cipher=1\\b\/\.test\(_ocs\)\s*\)\s*window\.CU_OM_CIPHER_ENABLED\s*=\s*true\s*;\s*\n\s*if/
      .test(initBlock),
    'legacy opt-in-only init must be replaced',
  );
});

// ── 2. studioLoadJSON re-renders Living Profile + Website Preview ──
test('studioLoadJSON re-renders Living Profile if modal is open after import', () => {
  const fn = html.slice(html.indexOf('function studioLoadJSON'),
                        html.indexOf('function studioLoadJSON') + 4000);
  assert.ok(/openLivingProfile/.test(fn),
    'studioLoadJSON must call window.openLivingProfile after import');
  assert.ok(/openWebsitePreview/.test(fn),
    'studioLoadJSON must call window.openWebsitePreview after import');
  assert.ok(/living-profile-modal/.test(fn),
    'studioLoadJSON must check the living-profile-modal open state');
});

// ── 3. cuAttachOmCipherMeta skips the OM Cipher v2 section ─────────
test('cuAttachOmCipherMeta does NOT append duplicate activation badge inside [data-cu-om-cipher-section]', () => {
  const fn = html.slice(html.indexOf('function cuAttachOmCipherMeta'),
                        html.indexOf('window.cuAttachOmCipherMeta = cuAttachOmCipherMeta'));
  // The fix must guard against slots inside the v2 section. The v2
  // section already paints the Activation Sequence in oc-field-pattern.
  assert.ok(/data-cu-om-cipher-section/.test(fn),
    'cuAttachOmCipherMeta should reference the v2 section selector to skip it');
  assert.ok(/closest/.test(fn),
    'cuAttachOmCipherMeta should use closest() to detect the v2 section ancestor');
});

// ── 4. Engine derivation against the Markus fixture is complete ────
test('engine derives full canonical record from Markus fixture (no pending surfaces)', () => {
  const cd = FIXTURE.compassData || {};
  const prof = cd.profile || {};
  const fnd = prof.foundation || {};
  const input = {
    birth_date: prof.birthdate || fnd.birthdate,
    birth_time: prof.birth_time || fnd.birth_time,
    birth_place: { city: 'Sudbury', province: 'Ontario', country: 'Canada' },
    legal_name: cd.guide,
    preferred_name: 'Markus',
    compass: {
      work:  { gk_num: 14, gk_line: 2 },
      lens:  { gk_num: 8,  gk_line: 2 },
      field: { gk_num: 29, gk_line: 4 },
      call:  { gk_num: 30, gk_line: 4 },
    },
    seed_syllable: 'Om',
  };
  const rec = om.generate(input, { featureFlag: true, bhramariFlag: true });
  assert.ok(!rec.pending, 'record must not be pending');
  // Canonical seal hash from the task brief.
  assert.equal(rec.seed,
    '58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784',
    'cipher seal/fingerprint mismatches Markus baseline');
  // Cipher name.
  assert.equal(rec.metadata.cipher_name, 'Markus of the Autumn Gate');
  // Mantra.
  assert.equal(rec.metadata.om_cipher_mantra.mantra,
    'I hold the form until the form holds others.');
  // Source pattern.
  assert.equal(rec.metadata.life_path.value, 22);
  assert.equal(rec.metadata.expression.value, 8);
  assert.equal(rec.metadata.soul_urge.value, 6);
  assert.equal(rec.metadata.personality.value, 2);
  assert.equal(rec.metadata.lunar_phase.value, 6);
  assert.equal(rec.metadata.solar_quarter.value, 3);
  assert.equal(rec.metadata.temporal_gate.value, 1);
  // Story seed + contemplation.
  assert.match(rec.metadata.archetypal_story_seed.seed,
    /paradox of power and service/);
  assert.equal(rec.metadata.cipher_contemplation.phrase,
    'I do less now, and allow more.');
});

// ── 5. Engine still derives without a sealed legal_name (draft path) ─
//      Acceptance #5: derivation must run from available source data
//      for testing and preview, not require a formal Compass seal.
test('engine still derives when only birth_date is present (no _cu_sealed gate)', () => {
  const input = {
    birth_date: '1973-11-18',
    birth_time: '03:21',
    legal_name: null,        // no sealed name
    preferred_name: null,
    compass: null,           // no Gene Keys
    seed_syllable: 'Om',
  };
  const rec = om.generate(input, { featureFlag: true });
  assert.ok(!rec.pending,
    'derivation must run from birth_date alone — no Compass seal required');
  // Seal hash still deterministic from whatever inputs are present.
  assert.ok(rec.seed && /^[0-9a-f]{64}$/.test(rec.seed),
    'seal hash should derive from birth_date alone');
  // Life Path still derives from birth_date.
  assert.equal(rec.metadata.life_path.value, 22);
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
