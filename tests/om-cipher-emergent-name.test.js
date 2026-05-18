// Emergent Cipher Name generator (om-cipher-name-generator.md).
//
// The cipher name is not derived from the birth name — it emerges from
// three sealed inputs:
//   Part 1 — Gate Phoneme   (dominant I Ching gate / Life Work)
//   Part 2 — Seed Syllable  (HD authority / dominant center)
//   Part 3 — Line Resonance (Life Work profile line)
//
// Run: OM_CIPHER_ENABLED=true node tests/om-cipher-emergent-name.test.js
'use strict';

process.env.OM_CIPHER_ENABLED = 'true';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const om = require('../sdk/om_cipher.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e.stack || e.message); failed++; }
}

console.log('Emergent Cipher Name — spec examples');

// ── 1. All eight spec examples produce the documented cipher name ──
const SPEC_EXAMPLES = [
  { gate: 14, authority: 'Emotional · Solar Plexus', line: 2, name: 'MAVARA',  syll: ['MA','VA','RA']  },
  { gate:  1, authority: 'Sacral',                   line: 3, name: 'AHVATE',  syll: ['AH','VA','TE']  },
  { gate: 34, authority: 'Sacral',                   line: 5, name: 'RIVALU',  syll: ['RI','VA','LU']  },
  { gate: 57, authority: 'Splenic',                  line: 1, name: 'THERAKI', syll: ['THE','RA','KI'] },
  { gate: 64, authority: 'Mental',                   line: 6, name: 'AHAOM',   syll: ['AHA','AU','OM'] },
  { gate: 13, authority: 'Self / G-Center',          line: 4, name: 'KOHASO',  syll: ['KO','HA','SO']  },
  { gate: 46, authority: 'Heart / Ego',              line: 1, name: 'BAYAKI',  syll: ['BA','YA','KI']  },
  { gate: 25, authority: 'Throat',                   line: 3, name: 'SAHATE',  syll: ['SA','HA','TE']  },
];

SPEC_EXAMPLES.forEach((ex) => {
  test(`spec: ${ex.gate} / ${ex.authority} / ${ex.line} → ${ex.name}`, () => {
    const r = om.generateCipherName(ex.gate, ex.authority, ex.line);
    assert.ok(r, 'generator should return a record');
    assert.equal(r.name, ex.name);
    assert.deepEqual(r.syllables, ex.syll);
    assert.equal(r.display_name, ex.syll.join('·'));
    assert.ok(r.pronunciation && /^[A-Z\-]+$/.test(r.pronunciation),
      'pronunciation should be all caps with hyphens');
    assert.ok(r.etymology && r.etymology.part_1 && r.etymology.part_2 && r.etymology.part_3,
      'etymology should expose all three parts');
  });
});

// ── 2. Markus etymology spot-check ──
test('Markus etymology surfaces gate / authority / line sources', () => {
  const r = om.generateCipherName(14, 'Emotional · Solar Plexus', 2);
  assert.equal(r.etymology.part_1.phoneme, 'MA');
  assert.match(r.etymology.part_1.source, /Gate 14/);
  assert.match(r.etymology.part_1.source, /Possession/);
  assert.equal(r.etymology.part_2.fragment, 'VA');
  assert.match(r.etymology.part_2.source, /Solar Plexus/);
  assert.equal(r.etymology.part_3.syllable, 'RA');
  assert.match(r.etymology.part_3.source, /Line 2/);
  assert.match(r.etymology.part_3.source, /Hermit/);
});

// ── 3. Authority matching is tolerant of label punctuation ──
test('authority matching tolerates · / _ punctuation in HD labels', () => {
  // The renderer surface emits "Emotional · Solar Plexus" with a middle
  // dot — the generator must match the Emotional row, not the Sacral row.
  const r = om.generateCipherName(14, 'Emotional · Solar Plexus', 2);
  assert.equal(r.name, 'MAVARA');
  // "Self/G-Center" with a slash should match the G-Center row.
  const r2 = om.generateCipherName(13, 'Self/G-Center', 4);
  assert.equal(r2.name, 'KOHASO');
});

// ── 4. Collision rule: AHA + AU + OM → AHAOM (not AHAAOM) ──
test('collision rule: vowel-on-vowel boundary drops part 2 leading vowels', () => {
  const r = om.generateCipherName(64, 'Mental', 6);
  assert.equal(r.name, 'AHAOM');
  assert.deepEqual(r.syllables, ['AHA', 'AU', 'OM']);
});

// ── 5. Markus end-to-end: om_cipher.layer5.cipher_name === MAVARA ──
test('Markus: om_cipher_block.layer5.cipher_name = MAVARA (not legacy "Autumn Gate")', () => {
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
      authority: 'Emotional · Solar Plexus',
      profile: '2/4',
      strategy: 'Wait to Respond',
    },
  };
  const rec = om.generate(MARKUS_INPUT, { featureFlag: true });
  assert.ok(rec && !rec.pending, 'engine should generate a sealed record');
  const l5 = rec.om_cipher_block && rec.om_cipher_block.layer5;
  assert.ok(l5, 'layer5 should be present');
  assert.equal(l5.cipher_name, 'MAVARA');
  assert.equal(l5.cipher_name_display, 'MA·VA·RA');
  assert.deepEqual(l5.cipher_name_syllables, ['MA', 'VA', 'RA']);
  assert.equal(l5.cipher_name_pronunciation, 'MAH-VAH-RAH');
  // Metadata cipher_name (read by Studio bridge) should also prefer the
  // emergent name, not the legacy "Markus of the Autumn Gate" string.
  assert.equal(rec.metadata.cipher_name, 'MAVARA');
  assert.notEqual(rec.metadata.cipher_name, 'Markus of the Autumn Gate');
});

// ── 6. Studio render prefers MAVARA over the legacy fallback ──
test('Studio cuCipherNameFromRecord prefers structured emergent name', () => {
  // Pull the helper directly from studio.html so the test exercises the
  // exact source the browser ships.
  const html = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
  function extractFn(name) {
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
  const SRC = extractFn('cuCipherNameFromRecord');
  const fn = new Function(SRC + '\nreturn cuCipherNameFromRecord;')();

  // Structured emergent name on the block wins over metadata.cipher_name.
  const recA = {
    pending: false,
    metadata: { cipher_name: 'Markus of the Autumn Gate' },
    om_cipher_block: { layer5: {
      cipher_name: 'MAVARA',
      cipher_name_display: 'MA·VA·RA',
    } },
  };
  assert.equal(fn(recA, { preferred_name: 'Markus' }), 'MA·VA·RA');

  // When the structured block has only the continuous form, use that.
  const recB = {
    pending: false,
    metadata: {},
    om_cipher_block: { layer5: { cipher_name: 'MAVARA' } },
  };
  assert.equal(fn(recB, { preferred_name: 'Markus' }), 'MAVARA');

  // Legacy fallback (no structured block) still resolves to a label.
  const recC = {
    pending: false,
    metadata: {
      cipher_name: 'Markus of the Autumn Gate',
      life_path: { label: 'Master Builder — material vision realized' },
      lunar_phase: { label: 'Last Quarter — release' },
    },
  };
  // Falls back to metadata.cipher_name when no structured block exists.
  assert.equal(fn(recC, { preferred_name: 'Markus' }), 'Markus of the Autumn Gate');
});

// ── 7. Studio render: enriched insight cards (LP 22, Personality 11) ──
test('Studio render emits enriched insight text for Life Path 22 and Personality 11', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');
  // The insight table is defined inline inside cuRenderOmCipherSection.
  // We assert the canonical phrasing is present in the shipped HTML so a
  // future refactor cannot silently drop the user-facing text.
  assert.match(html, /life_path_22:\s+'Master Builder\./);
  assert.match(html, /turn vision into material form/);
  assert.match(html, /personality_11:\s+'Others may sense an amplified intuitive charge/);
  assert.match(html, /expression_8:\s+'Power through stewardship/);
  assert.match(html, /soul_urge_6:\s+'The inner pull is harmony, care, and devotion/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
