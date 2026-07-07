// Focused tests for the public hOMe visual identity contract
// (docs/home-design-grammar.md §3, §5, §8; roadmap "visual identity
// generation foundation"). phPublicVisualIdentity turns the first-class
// source seeds (HOME_SOURCE_SEEDS — content + palette) into a structured,
// deterministic, public-safe descriptor a future renderer / generated-visual
// layer consumes: palette roles, tone, density, motifs, imagery, per-room
// treatments, motion, and type direction.
//
// Like the sibling home-*.test.mjs, we do not boot the ~1MB studio.html in
// jsdom; we extract the real source blocks verbatim and exercise the shipped
// code: HOME_SOURCE_SEEDS + HOME_LANGUAGE_FIREWALL + HOME_PUBLIC_VISUAL_IDENTITY.
//
// Run: node tests/home-public-visual-identity.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioPath = join(__dirname, '..', 'studio.html');
const html = readFileSync(studioPath, 'utf8');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function extractBlock(startSentinel, endSentinel) {
  const startIdx = html.indexOf(startSentinel);
  const endIdx = html.indexOf(endSentinel);
  assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'sentinel block must exist: ' + startSentinel);
  const bodyStart = html.indexOf('\n', startIdx) + 1;
  return html.slice(bodyStart, endIdx);
}

// ── Load seeds + firewall + visual identity verbatim ────────────────
const { phPublicVisualIdentity, phHomeSourceSeeds, validatePublicHomeLanguage } = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',           '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>',      '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_VISUAL_IDENTITY_START>', '// <HOME_PUBLIC_VISUAL_IDENTITY_END>') +
  '\nreturn { phPublicVisualIdentity, phHomeSourceSeeds, validatePublicHomeLanguage };'
)();

console.log('hOMe public visual identity unit tests');

const PALETTE = { om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } } };

function richCompass() {
  return {
    companion: 'Mara Lindgren',
    profile: { first_name: 'Mara', last_name: 'Lindgren' },
    points: {
      work:  { web_heading: 'Hand-thrown pottery', web_intro: 'I make functional stoneware.',
               theme: 'Craft', highlights: ['Wheel-thrown mugs', 'Seasonal workshops', 'Glaze study'] },
      lens:  { web_intro: 'I notice small rhythms.', theme: 'Attention', highlights: ['Slow looking'] },
      field: { raw: 'Restored by the coast and long walks by the water.', theme: 'Coast' },
      call:  { web_closing: 'Come make something by hand.', theme: 'Invitation' }
    }
  };
}

function seedsFrom(compassData, cipherContract) {
  return phHomeSourceSeeds({ compassData, cipherContract });
}

// ── Palette seeding ─────────────────────────────────────────────────
test('seeds the three public palette roles from the OM Cipher palette', () => {
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  assert.equal(vi.palette.present, true);
  assert.deepEqual(vi.palette.roles, { root: '#00a', expression: '#a00', radiance: '#0a0' });
});

test('palette is absent (null roles) when no colours are present', () => {
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), null));
  assert.equal(vi.palette.present, false);
  assert.equal(vi.palette.roles, null);
});

// ── Density derivation ──────────────────────────────────────────────
test('density scales with the amount of room/highlight content', () => {
  const empty = phPublicVisualIdentity(seedsFrom({}, null));
  assert.equal(empty.density, 'sparse');

  const rich = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  // 4 bodies + 4 highlights = 8 units → rich.
  assert.equal(rich.density, 'rich');

  const mid = phPublicVisualIdentity(seedsFrom({
    points: { work: { web_intro: 'A', theme: 'x', highlights: ['h1', 'h2'] }, lens: { web_intro: 'B' } }
  }, null));
  // 2 bodies + 2 highlights = 4 units → balanced.
  assert.equal(mid.density, 'balanced');
});

// ── Motion / type / imagery defaults ────────────────────────────────
test('motion follows density and stills an empty home', () => {
  assert.equal(phPublicVisualIdentity(seedsFrom({}, null)).motion, 'still');
  assert.equal(phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE)).motion, 'alive');
});

test('type direction maps deterministically from tone', () => {
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  assert.ok(['editorial', 'modern', 'grounded', 'expressive'].includes(vi.typeDirection));
});

test('tone is a public-safe word and grounded when there is no source', () => {
  assert.equal(phPublicVisualIdentity(seedsFrom({}, null)).tone, 'grounded');
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  assert.ok(['warm', 'grounded', 'luminous', 'clear', 'vivid'].includes(vi.tone));
});

test('imagery defaults atmospheric with a palette, abstract without', () => {
  assert.equal(phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE)).imagery, 'atmosphere');
  assert.equal(phPublicVisualIdentity(seedsFrom(richCompass(), null)).imagery, 'abstract');
});

// ── Motifs ──────────────────────────────────────────────────────────
test('motifs are anchored by threshold and drawn from a public-safe vocab', () => {
  const vocab = ['threshold', 'weave', 'water', 'hearth', 'signal', 'orbit', 'garden', 'studio'];
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  assert.equal(vi.motifs[0], 'threshold');
  assert.ok(vi.motifs.length >= 2);
  vi.motifs.forEach((m) => assert.ok(vocab.includes(m), 'unexpected motif: ' + m));
  // Unique.
  assert.equal(new Set(vi.motifs).size, vi.motifs.length);
  // "water"/"coast" theme should surface the water motif.
  assert.ok(vi.motifs.includes('water'));
});

test('an empty home still gets a small, sensible default motif set', () => {
  const vi = phPublicVisualIdentity(seedsFrom({}, null));
  assert.equal(vi.motifs[0], 'threshold');
  assert.ok(vi.motifs.length >= 2);
});

// ── Room treatments ─────────────────────────────────────────────────
test('room treatments cover all four public rooms in order', () => {
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  assert.equal(vi.roomTreatments.length, 4);
  const roles = ['root', 'expression', 'radiance'];
  const intensities = ['soft', 'medium', 'bold'];
  vi.roomTreatments.forEach((t) => {
    assert.ok(roles.includes(t.accent), 'accent role: ' + t.accent);
    assert.ok(intensities.includes(t.intensity), 'intensity: ' + t.intensity);
    assert.equal(typeof t.motif, 'string');
    assert.equal(typeof t.glyph, 'string');
    assert.equal(typeof t.cue, 'string');
  });
  // Intensity reflects content: work room (3 highlights + body) is bold.
  assert.equal(vi.roomTreatments[0].intensity, 'bold');
});

test('room treatments are never keyed by the raw dimension name', () => {
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  const json = JSON.stringify(vi.roomTreatments);
  // No dimension word appears as a treatment value.
  assert.ok(!/"(work|lens|field|call)"/i.test(json));
});

// ── Determinism ─────────────────────────────────────────────────────
test('output is fully deterministic for the same source', () => {
  const a = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  const b = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  assert.deepEqual(a, b);
});

// ── Input shapes ────────────────────────────────────────────────────
test('accepts raw seeds, a model with sourceSeeds, and raw state', () => {
  const seeds = seedsFrom(richCompass(), PALETTE);
  const fromSeeds = phPublicVisualIdentity(seeds);
  const fromModel = phPublicVisualIdentity({ sourceSeeds: seeds });
  const fromState = phPublicVisualIdentity({ compassData: richCompass(), cipherContract: PALETTE });
  assert.deepEqual(fromSeeds, fromModel);
  assert.deepEqual(fromSeeds, fromState);
});

test('is safe on null / empty / bad input', () => {
  for (const input of [null, undefined, {}, 'nope', 0]) {
    const vi = phPublicVisualIdentity(input);
    assert.equal(vi.palette.present, false);
    assert.equal(vi.roomTreatments.length, 4);
    assert.equal(vi.tone, 'grounded');
  }
});

// ── Public-language firewall ────────────────────────────────────────
test('the visual identity output passes the language firewall', () => {
  const cases = [
    phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE)),
    phPublicVisualIdentity(seedsFrom({}, null)),
    phPublicVisualIdentity({ compassData: richCompass(), cipherContract: PALETTE })
  ];
  cases.forEach((vi) => {
    const r = validatePublicHomeLanguage(vi);
    assert.equal(r.ok, true, JSON.stringify(r.violations));
  });
});

test('no branded / source-system name appears in any value', () => {
  const vi = phPublicVisualIdentity(seedsFrom(richCompass(), PALETTE));
  const json = JSON.stringify(vi);
  [/\bCompass\b/i, /\bNexus\b/i, /\bSparks?\b/i, /\bOM[\s-]?Cipher\b/i,
   /\bLiving Profile\b/i, /\bField Observations?\b/i].forEach((re) => {
    assert.ok(!re.test(json), 'leaked: ' + re);
  });
});

console.log('\nStatic wiring assertions');

test('HOME_PUBLIC_VISUAL_IDENTITY sentinel block exists in studio.html', () => {
  assert.match(html, /\/\/ <HOME_PUBLIC_VISUAL_IDENTITY_START>/);
  assert.match(html, /\/\/ <HOME_PUBLIC_VISUAL_IDENTITY_END>/);
});

test('phPublicVisualIdentity is exposed on window.CommonUnity.builder', () => {
  assert.match(html, /publicVisualIdentity:\s*phPublicVisualIdentity/);
});

test('phPublicHomeModel attaches the visual identity to its output', () => {
  const block = extractBlock('// <HOME_PUBLIC_MODEL_START>', '// <HOME_PUBLIC_MODEL_END>');
  assert.match(block, /visualIdentity:\s*visualIdentity/);
  assert.match(block, /phPublicVisualIdentity\(seeds\)/);
});

console.log('\n' + passed + ' checks passed.');
