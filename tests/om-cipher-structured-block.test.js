// Structured om_cipher block (v1.1) — Markus baseline + invariants.
//
// Verifies the additive layered projection that lives at
// `record.om_cipher_block`. The legacy `metadata.*` / seed / seed_string
// fields are intentionally unchanged (see om-cipher-markus-baseline.test.js);
// this suite covers the v1.1 contract:
//
//   Layer 1 — Pythagorean (master-preserving) + ordinal gematria
//   Layer 2 — Structured GK (cs/ce/us/ue) + HD type/profile/authority
//   Layer 3 — Octave / law-of-three / temporal anchors
//   Layer 4 — Vibrational + Bhramari baseline
//   Layer 5 — Current name, ordinal gematria, dominant phoneme, cipher_name
//   Layer 6 — Hexagonal / Lissajous / crack sigil SVG
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-structured-block.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const assert = require('node:assert/strict');
const om = require('../sdk/om_cipher.js');

const MARKUS_INPUT = {
  birth_date: '1973-11-18',
  birth_time: '03:21',
  birth_place: { city: 'Sudbury', province: 'Ontario', country: 'Canada' },
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
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('om_cipher_block — Markus structured projection');

const rec  = om.generate(MARKUS_INPUT, { featureFlag: true });
const blk  = rec.om_cipher_block;

test('record carries om_cipher_block (v1.1) when generate() succeeds', () => {
  assert.ok(blk, 'om_cipher_block must exist');
  assert.equal(blk.version, '1.1');
});

// ── Layer 1 ────────────────────────────────────────────────────────────
test('Layer 1 — life_path 22 preserved (master, commonunity_component method)', () => {
  assert.equal(blk.layer1.life_path.value, 22);
  assert.equal(blk.layer1.life_path.is_master, true);
  assert.equal(blk.layer1.life_path.method, 'commonunity_component_preserve_master');
});

test('Layer 1 — expression 8 / soul_urge 6 / personality 11 (master preserved)', () => {
  assert.equal(blk.layer1.expression.value, 8);
  assert.equal(blk.layer1.soul_urge.value, 6);
  assert.equal(blk.layer1.personality.value, 11);
  assert.equal(blk.layer1.personality.is_master, true);
});

test('Layer 1 — birthday_number = 18 → 9', () => {
  assert.equal(blk.layer1.birthday_number.raw, 18);
  assert.equal(blk.layer1.birthday_number.reduced, 9);
});

test('Layer 1 — gematria_ordinal = 143, root = 8', () => {
  assert.equal(blk.layer1.gematria_ordinal, 143);
  assert.equal(blk.layer1.gematria_ordinal_root, 8);
});

// ── Layer 2 — Gene Keys canonical mapping ──────────────────────────────
test('Layer 2 GK — cs=14.2 (Life Work / Dancer)', () => {
  assert.equal(blk.layer2.gene_keys.cs.gate, 14);
  assert.equal(blk.layer2.gene_keys.cs.line, 2);
  assert.equal(blk.layer2.gene_keys.cs.label, 'Life Work');
  assert.equal(blk.layer2.gene_keys.cs.line_label, 'Dancer');
});

test('Layer 2 GK — ce=8.2 (Evolution / Passion & Relationships)', () => {
  assert.equal(blk.layer2.gene_keys.ce.gate, 8);
  assert.equal(blk.layer2.gene_keys.ce.line, 2);
  assert.equal(blk.layer2.gene_keys.ce.label, 'Evolution');
  assert.equal(blk.layer2.gene_keys.ce.line_label, 'Passion & Relationships');
});

test('Layer 2 GK — us=29.4 (Radiance / Friendship)', () => {
  assert.equal(blk.layer2.gene_keys.us.gate, 29);
  assert.equal(blk.layer2.gene_keys.us.line, 4);
  assert.equal(blk.layer2.gene_keys.us.label, 'Radiance');
  assert.equal(blk.layer2.gene_keys.us.line_label, 'Friendship');
});

test('Layer 2 GK — ue=30.4 (Purpose / Breath)', () => {
  assert.equal(blk.layer2.gene_keys.ue.gate, 30);
  assert.equal(blk.layer2.gene_keys.ue.line, 4);
  assert.equal(blk.layer2.gene_keys.ue.label, 'Purpose');
  assert.equal(blk.layer2.gene_keys.ue.line_label, 'Breath');
});

// ── Layer 2 — Human Design ─────────────────────────────────────────────
test('Layer 2 HD — Generator / 2/4 / Emotional Solar Plexus', () => {
  assert.equal(blk.layer2.human_design.type, 'Generator');
  assert.equal(blk.layer2.human_design.profile, '2/4');
  assert.equal(blk.layer2.human_design.authority, 'Emotional Solar Plexus');
  assert.equal(blk.layer2.human_design.strategy, 'Wait to Respond');
  assert.equal(blk.layer2.human_design.incarnation_cross,
               'Right Angle Cross of 14/8 | 29/30');
  assert.deepEqual(blk.layer2.human_design.incarnation_cross_gates,
                   { personality_sun: 14, personality_earth: 8,
                     design_sun: 29, design_earth: 30 });
});

// ── Layer 3 — temporal / octave / law-of-three ─────────────────────────
test('Layer 3 — octave derived from life_path (LP22 → root 4 → octave 4 / F)', () => {
  assert.equal(blk.layer3.octave, 4);
  assert.equal(blk.layer3.octave_note, 'F');
  assert.equal(blk.layer3.law_of_three.triad, 'Active');
});

test('Layer 3 — temporal anchors preserved', () => {
  assert.equal(blk.layer3.lunar_phase, 6);
  assert.equal(blk.layer3.solar_quarter, 3);
  assert.equal(blk.layer3.temporal_gate, 1);
});

// ── Layer 4 — vibrational + Bhramari ──────────────────────────────────
test('Layer 4 — palette + authority resonance from HD authority', () => {
  assert.equal(blk.layer4.primary_hue, 72);
  assert.equal(blk.layer4.secondary_hue, 252);
  assert.equal(blk.layer4.authority_resonance.authority,
               'Emotional Solar Plexus');
  assert.equal(blk.layer4.authority_resonance.current, 'wave');
});

test('Layer 4 — Bhramari is optional; absent when no baseline supplied', () => {
  assert.equal(blk.layer4.bhramari, undefined);
});

// ── Layer 5 — name + cipher_name + dominant phoneme ───────────────────
test('Layer 5 — current_name + given/family split from legal_name', () => {
  assert.equal(blk.layer5.current_name, 'Markus Lehto');
  assert.equal(blk.layer5.given_name, 'Markus');
  assert.equal(blk.layer5.family_name, 'Lehto');
});

test('Layer 5 — gematria_ordinal mirrored on Layer 5 for convenience', () => {
  assert.equal(blk.layer5.gematria_ordinal, 143);
  assert.equal(blk.layer5.gematria_ordinal_root, 8);
});

test('Layer 5 — dominant_phoneme deterministic for every gate (not just Markus)', () => {
  assert.ok(blk.layer5.dominant_phoneme, 'Markus carries a phoneme via Life Work gate fallback');
  for (var g = 1; g <= 64; g++) {
    var p = om.phonemeForGate(g);
    assert.ok(p && typeof p === 'string' && p.length >= 2,
      'gate ' + g + ' must have a deterministic phoneme');
  }
});

test('Layer 5 — cipher_name resolves to the emergent "MAVARA" (gate 14 + Emotional · SP + line 2)', () => {
  // Per om-cipher-name-generator.md the cipher name emerges from the
  // sealed cipher layers, not the birth name. Markus' inputs (gate 14
  // / Emotional Solar Plexus authority / line 2) produce MAVARA. The
  // legacy temporal descriptor ("Markus of the Autumn Gate") moves to
  // `cipher_name_temporal` so older surfaces can still read it.
  assert.equal(blk.layer5.cipher_name, 'MAVARA');
  assert.equal(blk.layer5.cipher_name_display, 'MA·VA·RA');
  assert.deepEqual(blk.layer5.cipher_name_syllables, ['MA', 'VA', 'RA']);
  assert.equal(blk.layer5.cipher_name_pronunciation, 'MAH-VAH-RAH');
  assert.ok(blk.layer5.cipher_name_etymology, 'etymology surfaced');
  assert.equal(blk.layer5.cipher_name_temporal, 'Markus of the Autumn Gate');
});

// ── Layer 6 — hexagonal / Lissajous / crack sigil ─────────────────────
test('Layer 6 — sigil SVG generated with hex-lissajous-crack form', () => {
  assert.equal(blk.layer6.form, 'hex-lissajous-crack');
  assert.ok(blk.layer6.svg && blk.layer6.svg.startsWith('<svg'));
  assert.ok(/cu-om-cipher-sigil-hex/.test(blk.layer6.svg));
  assert.ok(/cu-sigil-hex/.test(blk.layer6.svg), 'hex base ring drawn');
  assert.ok(/cu-sigil-lissajous/.test(blk.layer6.svg), 'inner Lissajous wave drawn');
  assert.ok(/cu-sigil-crack/.test(blk.layer6.svg), 'growth-edge crack drawn');
  assert.deepEqual(blk.layer6.params.cross_axes_drawn.sort(),
    ['design_earth','design_sun','personality_earth','personality_sun'].sort());
  assert.equal(blk.layer6.params.crack_drawn, true);
});

test('Layer 6 — sigil is deterministic across runs for identical input', () => {
  const a = om.generate(MARKUS_INPUT, { featureFlag: true });
  const b = om.generate(MARKUS_INPUT, { featureFlag: true });
  assert.equal(a.om_cipher_block.layer6.svg, b.om_cipher_block.layer6.svg);
});

test('Layer 6 — sigil changes when meaningful source data changes', () => {
  const alt = Object.assign({}, MARKUS_INPUT, {
    compass: Object.assign({}, MARKUS_INPUT.compass, {
      field: { gk_num: 50, gk_line: 3 },
    }),
    human_design: Object.assign({}, MARKUS_INPUT.human_design, {
      incarnation_cross: {
        label: 'Right Angle Cross of 14/8 | 50/30',
        gates: { personality_sun: 14, personality_earth: 8, design_sun: 50, design_earth: 30 },
      },
    }),
  });
  const r2 = om.generate(alt, { featureFlag: true });
  assert.notEqual(r2.om_cipher_block.layer6.svg, blk.layer6.svg,
    'changing Radiance gate + design_sun must alter the sigil');
});

test('Layer 6 — graceful fallback when cross gates / Radiance are missing', () => {
  const minimal = {
    birth_date: '1973-11-18',
    legal_name: 'Markus Lehto',
  };
  const r3 = om.generate(minimal, { featureFlag: true });
  assert.ok(r3.om_cipher_block, 'block still produced on minimal input');
  assert.ok(r3.om_cipher_block.layer6.svg.startsWith('<svg'),
    'sigil still renders something');
  assert.equal(r3.om_cipher_block.layer6.params.crack_drawn, false,
    'crack omitted when Radiance gate missing');
  assert.deepEqual(r3.om_cipher_block.layer6.params.cross_axes_drawn, [],
    'no axis markers when cross gates missing');
});

// ── Sealed contract — no Hebrew gematria, no sealed personal_year ─────
test('block excludes Hebrew gematria and sealed personal_year', () => {
  // Walk every field except `notes` (which carries explicit exclusion
  // markers). No Hebrew gematria value, no annually-recomputed
  // personal_year, must appear in the sealed layers.
  const layers = {
    layer1: blk.layer1, layer2: blk.layer2, layer3: blk.layer3,
    layer4: blk.layer4, layer5: blk.layer5, layer6: blk.layer6,
  };
  const dump = JSON.stringify(layers).toLowerCase();
  assert.ok(!/hebrew/.test(dump),
    'sealed layers must not carry Hebrew gematria fields; got: ' + dump.slice(0, 200));
  assert.ok(!/personal_year/.test(dump),
    'sealed layers must not carry personal_year; got: ' + dump.slice(0, 200));
  assert.equal(blk.notes.hebrew_gematria_excluded, true);
  assert.equal(blk.notes.personal_year_excluded_from_sealed, true);
});

// ── Bhramari is optional + measured ────────────────────────────────────
test('Bhramari baseline surfaces in Layer 4 only when supplied', () => {
  const withHum = Object.assign({}, MARKUS_INPUT, {
    bhramari_baseline: { hz: 220.5, metadata: { captured_at: '2026-05-18T00:00:00Z' } },
  });
  const r4 = om.generate(withHum, { featureFlag: true, bhramariFlag: true });
  assert.ok(r4.om_cipher_block.layer4.bhramari,
    'Layer 4 bhramari present when baseline supplied + flag enabled');
  assert.equal(r4.om_cipher_block.layer4.bhramari.baseline_hz, 220.5);
});

console.log('\n' + (failed === 0 ? '✅ all passed' : '❌ ' + failed + ' failed') +
  ` (${passed} passed, ${failed} failed)`);
if (failed > 0) process.exit(1);
