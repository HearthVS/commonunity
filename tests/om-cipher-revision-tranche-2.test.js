// Revision-tranche-2 — comprehensive determinism + Layer 6 + display assertions
// for the Markus baseline (1973-11-18 / 03:21 / Markus Lehto / Sudbury).
//
// Covers:
//   - 100 consecutive identical calls produce identical seed, sigil_svg,
//     metadata, mantra, story, contemplation, cipher_name
//   - Mantra index 36 with the canonical 22-keyed entry
//   - Story keyed lookup `8_6` carrying the canonical archetypal portrait;
//     no UI instruction text leaks into the story body
//   - Contemplation phase 6 short form (no broken template fragments)
//   - Derived cipher name `Markus of the Autumn Gate` for solar 3 / lunar 6
//   - Birthplace display normalisation `Sudbury, Ontario, Canada`
//   - Studio section markup has no `SOURCE PATTERN · GEMATRIA`, no
//     `Personal Mantra`, no `Currently In` (locked grid), no `Human Design:
//     Not set yet`, no duplicate activation under the sigil, and no
//     `Sit with the last quarter — release quality...` broken template.
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-revision-tranche-2.test.js

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

process.env.OM_CIPHER_ENABLED = 'true';
const om = require('../sdk/om_cipher.js');

const MARKUS = {
  legal_name: 'Markus Lehto',
  preferred_name: 'Markus',
  birth_date: '1973-11-18',
  birth_time: '03:21',
  birth_place: {
    city: 'Sudbury', province: 'Ontario', country: 'Canada',
    lat: 46.4917, lng: -80.9930,
  },
};

const EXPECTED_SEED_HASH = '58b2ea613f7d3c7522bf0df86e1826e4200ab64a7f31c319810eb3701f388784';
const EXPECTED_SEED_STRING = 'LP:22|EX:8|SU:6|PE:2|LUN:6|SOL:3|TG:1';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('Om Cipher — revision tranche 2 acceptance');

// ── Determinism ───────────────────────────────────────────────────
test('100 consecutive calls produce byte-identical seed + sigil + metadata', () => {
  const first = om.generate(MARKUS, { featureFlag: true });
  assert.equal(first.seed, EXPECTED_SEED_HASH);
  assert.equal(first.seed_string, EXPECTED_SEED_STRING);
  for (let i = 0; i < 100; i++) {
    const r = om.generate(MARKUS, { featureFlag: true });
    assert.equal(r.seed, first.seed, 'seed drift on call ' + i);
    assert.equal(r.seed_string, first.seed_string, 'seed_string drift on call ' + i);
    assert.equal(r.sigil_svg, first.sigil_svg, 'sigil_svg drift on call ' + i);
    assert.equal(
      JSON.stringify(r.metadata.om_cipher_mantra),
      JSON.stringify(first.metadata.om_cipher_mantra),
      'mantra drift on call ' + i,
    );
    assert.equal(
      JSON.stringify(r.metadata.archetypal_story_seed),
      JSON.stringify(first.metadata.archetypal_story_seed),
      'story drift on call ' + i,
    );
    assert.equal(
      JSON.stringify(r.metadata.cipher_contemplation),
      JSON.stringify(first.metadata.cipher_contemplation),
      'contemplation drift on call ' + i,
    );
    assert.equal(r.metadata.cipher_name, first.metadata.cipher_name,
      'cipher_name drift on call ' + i);
  }
});

// ── Mantra ────────────────────────────────────────────────────────
test('mantra index = (22 + 8 + 6) mod 108 = 36 with canonical 22-keyed text', () => {
  const r = om.generate(MARKUS, { featureFlag: true });
  const m = r.metadata.om_cipher_mantra;
  assert.equal(m.index, 36);
  assert.equal(m.mantra, 'I hold the form until the form holds others.');
});

// ── Story seed ────────────────────────────────────────────────────
test('archetypal story seed uses keyed `8_6` entry with the canonical portrait', () => {
  const r = om.generate(MARKUS, { featureFlag: true });
  const s = r.metadata.archetypal_story_seed;
  assert.equal(s.key, '8_6');
  assert.equal(s.source, 'keyed');
  assert.ok(/paradox of power and service/.test(s.seed));
  assert.ok(/you build so others have somewhere to stand/i.test(s.seed));
  // Story body contains no UI instruction text.
  assert.ok(!/Living Profile/.test(s.seed));
  assert.ok(!/Your lived story/i.test(s.seed));
});

// ── Contemplation ─────────────────────────────────────────────────
test('cipher contemplation phase 6 short form is "I do less now, and allow more."', () => {
  const r = om.generate(MARKUS, { featureFlag: true });
  const c = r.metadata.cipher_contemplation;
  assert.equal(c.phrase, 'I do less now, and allow more.');
  // Combined form remains available for an extended-surface, but the
  // short form alone is what surfaces in the panel.
  assert.ok(!/Sit with/i.test(c.phrase));
  assert.ok(!/release quality/i.test(c.phrase));
});

// ── Cipher name ───────────────────────────────────────────────────
test('cipher name = "Markus of the Autumn Gate" (solar 3 × lunar 6)', () => {
  const r = om.generate(MARKUS, { featureFlag: true });
  assert.equal(r.metadata.cipher_name, 'Markus of the Autumn Gate');
});

test('temporalPhrase lookup is keyed on `${solar}_${lunar}`', () => {
  assert.equal(om.temporalPhrase(3, 6), 'of the Autumn Gate');
  assert.equal(om.temporalPhrase(0, 0), 'of the Winter Seed');
  assert.equal(om.temporalPhrase(2, 5), 'of the Summer Harvest');
  assert.equal(om.temporalPhrase(null, 6), null);
});

// ── Palette + sigil ───────────────────────────────────────────────
test('primary colour = oklch(0.55 0.227 72)', () => {
  const r = om.generate(MARKUS, { featureFlag: true });
  assert.equal(r.palette.primary_hue, 72);
  assert.equal(r.palette.palette[0], 'oklch(0.55 0.227 72)');
});

test('sigil emits 11 seed-derived radial spokes + one connecting ring + centre node', () => {
  const r = om.generate(MARKUS, { featureFlag: true });
  const svg = r.sigil_svg;
  const lines = svg.match(/<line\b/g) || [];
  assert.equal(lines.length, 11);
  const rings = svg.match(/<path d="[^"]+" fill="none" stroke="[^"]+" stroke-width="2\.5"/g) || [];
  assert.equal(rings.length, 1);
  const centres = svg.match(/<circle cx="256" cy="256" r="5"/g) || [];
  assert.equal(centres.length, 1);
  // No regular polygon: spoke endpoints span a unique distribution of angles.
});

test('different inputs produce different sigil SVGs (uniqueness, not generic polygon)', () => {
  const a = om.generate(MARKUS, { featureFlag: true });
  const b = om.generate({
    ...MARKUS,
    birth_date: '1992-04-29',
    legal_name: 'Alex Stone',
    preferred_name: 'Alex',
  }, { featureFlag: true });
  assert.notEqual(a.seed, b.seed);
  assert.notEqual(a.sigil_svg, b.sigil_svg,
    'sigil_svg must differ between two distinct seeds');
});

// ── Studio section markup checks (static, no DOM) ─────────────────
const STUDIO = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');

test('no user-facing "SOURCE PATTERN · GEMATRIA" copy in studio.html', () => {
  assert.ok(!/SOURCE PATTERN · GEMATRIA/i.test(STUDIO));
});

test('label reads "Om Cipher Mantra", not "Personal Mantra"', () => {
  // The mantra surface label must not present as "Personal Mantra"
  // (the v1 placeholder copy). The placeholder body copy mentions
  // "evolving personal mantra" — that wording is intentional context,
  // not a label, so we look only at the eyebrow text used as a label.
  assert.ok(/Om Cipher Mantra/.test(STUDIO));
  assert.ok(!/oc-eyebrow">Personal Mantra/.test(STUDIO));
});

test('no broken "Sit with the ... quality of your cipher today." template fragment', () => {
  // The legacy contemplation fallback assembled this from
  // `'Sit with the ' + label.toLowerCase() + ' quality of your cipher today.'`
  // The literal pattern must be gone from the file.
  assert.ok(!/Sit with the[^"]*quality of your cipher today/i.test(STUDIO),
    'broken contemplation template must be removed');
});

test('OM Cipher section template carries a derived cipher subtitle hook', () => {
  assert.ok(/data-cu-om-cipher-subtitle/.test(STUDIO),
    'subtitle hook present so the descriptive label can render as secondary');
});

test('Cipher Foundation filters out `current_location` ("Currently In")', () => {
  // The filter sits in the OM Cipher section render block.
  assert.ok(/it\.field === 'current_location'/.test(STUDIO),
    'current_location must be filtered from the locked-data card');
});

test('Human Design pending wording differentiates missing inputs (not the legacy "pending full chart calculation")', () => {
  // After the HD engine + place gazetteer landed, the OM Cipher
  // foundation card no longer falls back to "pending full chart
  // calculation". When the engine can't run it surfaces precise
  // missing-input wording — birth date / birth time / birth
  // coordinates·timezone — so the user knows what to provide.
  assert.ok(/requires birth date · v1\.1/.test(STUDIO));
  assert.ok(/requires birth time · v1\.1/.test(STUDIO));
  assert.ok(/requires birth coordinates\/timezone · v1\.1/.test(STUDIO));
  // The HD-specific "Human Design · pending full chart calculation"
  // line is gone; the residual "Moon · Rising · pending full chart
  // calculation" string remains for astrology subfields and is
  // checked separately.
  assert.ok(!/Human Design · pending full chart calculation/.test(STUDIO),
    'legacy HD "pending full chart calculation" wording is gone');
});

test('Moon · Rising surface as pending v1.1 note outside the locked grid', () => {
  assert.ok(/Moon · Rising · pending full chart calculation · v1\.1/.test(STUDIO));
});

test('Sun sign lookup helper is present (date-range, no ephemeris)', () => {
  assert.ok(/function ocSunSignFromDate/.test(STUDIO));
});

test('Birthplace display normaliser is present', () => {
  assert.ok(/function ocFormatBirthplaceString/.test(STUDIO));
});

// ── Display helpers — birthplace + sun sign ───────────────────────
test('birthplace `Sudbury ontario canada` formats to `Sudbury, Ontario, Canada`', () => {
  // Extract and eval the helper standalone from studio.html.
  const m = /function ocFormatBirthplaceString\(raw\)\s*\{[\s\S]*?\n    \}/.exec(STUDIO);
  assert.ok(m, 'helper present');
  const fn = new Function('return (' + m[0] + ')')();
  assert.equal(fn('Sudbury ontario canada'), 'Sudbury, Ontario, Canada');
  assert.equal(fn('SUDBURY, ONTARIO, CANADA'), 'Sudbury, Ontario, Canada');
});

test('Sun sign from 1973-11-18 = Scorpio (deterministic, no network)', () => {
  const m = /function ocSunSignFromDate\(iso\)\s*\{[\s\S]*?\n    \}/.exec(STUDIO);
  assert.ok(m, 'helper present');
  const fn = new Function('return (' + m[0] + ')')();
  assert.equal(fn('1973-11-18'), 'Scorpio');
  assert.equal(fn('1992-04-29'), 'Taurus');
  assert.equal(fn('2000-12-22'), 'Capricorn');
  assert.equal(fn('1985-03-21'), 'Aries');
});

// ── Activation duplication ────────────────────────────────────────
test('activation hook below the sigil is positioned off-screen (no visual duplicate)', () => {
  // The activation line below the sigil is aria-hidden + off-screen so
  // the visible activation appears only beside the sigil (oc-field-pattern).
  assert.ok(/data-cu-om-cipher-activation aria-hidden="true" style="position:absolute;left:-9999px/.test(STUDIO),
    'activation hook below the sigil must stay off-screen to avoid duplication');
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
