// Focused tests for phRenderPublicHome CONSUMING model.visualIdentity
// (docs/home-design-grammar.md §3, §5, §8). PR #150 shipped the render, #151
// polished it, #152 added phPublicVisualIdentity + attached `visualIdentity`
// to the public model. This layer wires that identity into the render: the
// .phpub root carries data-tone / data-density / data-motion / data-type / a
// primary data-motif, and each room carries a position-keyed treatment
// (data-intensity, data-motif, a --phpub-room-accent palette-role var, and a
// decorative aria-hidden glyph). All values stay public-safe and the rendered
// HTML still passes validatePublicHomeLanguage().
//
// Like the sibling home-*.test.mjs, studio.html is a single ~1MB app with no
// bundler, so we extract the real source blocks verbatim and exercise the
// shipped code, plus scan the raw file for the scoped CSS that reads the hooks.
//
// Run: node tests/home-public-render-visual-identity.test.mjs

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

const { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage } = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',           '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>',      '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',          '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',       '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_VISUAL_IDENTITY_START>', '// <HOME_PUBLIC_VISUAL_IDENTITY_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',           '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',          '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage };'
)();

// A cОMpass export + palette used to build a rich source-seeded preview.
function sampleCompass() {
  return {
    companion: 'Mara Lindgren',
    profile: { first_name: 'Mara', last_name: 'Lindgren', email: 'mara@example.com', website: 'https://mara.example' },
    points: {
      work:  { web_heading: 'Hand-thrown pottery', web_intro: 'I make functional stoneware for everyday rituals.',
               theme: 'Craft', highlights: ['Wheel-thrown mugs', 'Seasonal workshops', 'Glaze study'] },
      lens:  { web_intro: 'I notice the small rhythms most people walk past.', theme: 'Attention' },
      field: { raw: 'Restored by the coast and long walks by the water.', theme: 'Coast' },
      call:  { web_closing: 'Come learn to make something with your own hands.', theme: 'Invitation' }
    }
  };
}
const sampleCipher = { om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } } };

function samplePreview() {
  const { phHomeSourceSeeds } = new Function(
    extractBlock('// <HOME_SOURCE_SEEDS_START>', '// <HOME_SOURCE_SEEDS_END>') +
    '\nreturn { phHomeSourceSeeds };'
  )();
  return {
    name: 'Mara Lindgren',
    sections: {
      hero:  { heading: 'Hand-thrown pottery', intro: 'A small home for everyday craft.', source: 'compass' },
      work:  { heading: 'Hand-thrown pottery', intro: 'I make functional stoneware for everyday rituals.',
               highlights: ['Wheel-thrown mugs', 'Seasonal workshops', 'Glaze study'], closing: '', source: 'compass' },
      lens:  { heading: '', intro: 'I notice the small rhythms most people walk past.', highlights: [], closing: '', source: 'compass' },
      field: { heading: '', intro: 'Restored by the coast.', highlights: [], closing: '', source: 'compass' },
      call:  { heading: '', intro: '', highlights: [], closing: 'Come learn to make something.', source: 'compass' },
      invitation: { body: '', contact: ['Email: mara@example.com'], source: 'empty' }
    },
    sourceSeeds: phHomeSourceSeeds({ compassData: sampleCompass(), cipherContract: sampleCipher })
  };
}

console.log('hOMe public render — consumes model.visualIdentity');

// ── Root carries the identity descriptors as data-* hooks ────────────
test('root .phpub carries data-tone / density / motion / type / motif', () => {
  const model = phPublicHomeModel(samplePreview());
  const vi = model.visualIdentity;
  const out = phRenderPublicHome(model);

  const root = out.match(/<div class="phpub"[^>]*>/)[0];
  assert.match(root, new RegExp('data-tone="' + vi.tone + '"'));
  assert.match(root, new RegExp('data-density="' + vi.density + '"'));
  assert.match(root, new RegExp('data-motion="' + vi.motion + '"'));
  assert.match(root, new RegExp('data-type="' + vi.typeDirection + '"'));
  // Primary motif surfaces as a decorative root hook.
  assert.match(root, new RegExp('data-motif="' + vi.motifs[0] + '"'));
});

test('emitted identity values are only from the public-safe vocab', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  assert.match(out, /data-tone="(warm|grounded|luminous|clear|vivid)"/);
  assert.match(out, /data-density="(sparse|balanced|rich)"/);
  assert.match(out, /data-motion="(still|subtle|alive)"/);
  assert.match(out, /data-type="(editorial|modern|grounded|expressive)"/);
});

// ── Per-room treatments land by position, never by dimension name ────
test('each room carries a position-keyed treatment (intensity + accent var)', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);
  const sections = out.match(/<section class="phpub-room s-\d"[^>]*>/g) || [];
  assert.equal(sections.length, 4);
  sections.forEach((sec, i) => {
    assert.match(sec, /data-intensity="(soft|medium|bold)"/, 'room ' + (i + 1) + ' intensity');
    // Accent is a palette ROLE var, never a raw colour or dimension key.
    assert.match(sec, /--phpub-room-accent:var\(--phpub-(root|expression|radiance)\)/,
      'room ' + (i + 1) + ' accent var');
  });
  // The internal dimension keys never appear as attribute values or classes.
  [/s-work/, /s-lens/, /s-field/, /s-call/, /"work"/i, /"lens"/i, /"call"/i].forEach((re) => {
    assert.ok(!re.test(out), 'internal dimension key leaked: ' + re);
  });
});

test('room intensity reflects that room\'s content weight', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);
  const sections = out.match(/<section class="phpub-room s-\d"[^>]*>/g) || [];
  // Work room (body + 3 highlights) is bold; empty-ish rooms are softer.
  assert.match(sections[0], /data-intensity="bold"/);
  assert.ok(model.visualIdentity.roomTreatments.every((t, i) =>
    sections[i].includes('data-intensity="' + t.intensity + '"')),
    'each room intensity must match its treatment');
});

test('rooms emit a decorative aria-hidden motif glyph', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);
  const glyphs = out.match(/<span class="phpub-room-glyph" aria-hidden="true">/g) || [];
  assert.ok(glyphs.length >= 1, 'expected at least one decorative room glyph');
  // Each treatment's glyph appears in the output.
  model.visualIdentity.roomTreatments.forEach((t) => {
    if (t.glyph) assert.ok(out.includes(t.glyph), 'missing room glyph: ' + t.glyph);
  });
});

// ── Fallback: no visualIdentity → grounded, still-renders defaults ───
test('missing visualIdentity falls back to calm grounded defaults', () => {
  const model = phPublicHomeModel(samplePreview());
  delete model.visualIdentity;
  const out = phRenderPublicHome(model);
  const root = out.match(/<div class="phpub"[^>]*>/)[0];
  assert.match(root, /data-tone="grounded"/);
  assert.match(root, /data-density="balanced"/);
  assert.match(root, /data-motion="subtle"/);
  assert.match(root, /data-type="grounded"/);
  // Rooms still carry a safe default treatment.
  const sections = out.match(/<section class="phpub-room s-\d"[^>]*>/g) || [];
  assert.equal(sections.length, 4);
  sections.forEach((sec) => {
    assert.match(sec, /data-intensity="medium"/);
    assert.match(sec, /--phpub-room-accent:var\(--phpub-radiance\)/);
  });
  assert.equal(validatePublicHomeLanguage(out).ok, true);
});

test('renderer is safe when visualIdentity is null / malformed', () => {
  for (const bad of [null, 'nope', 42, { tone: 'made-up', roomTreatments: 'x' }]) {
    const out = phRenderPublicHome({ rooms: [{ label: 'A' }], visualIdentity: bad });
    assert.equal(typeof out, 'string');
    // Bogus tone is rejected in favour of the grounded default.
    assert.match(out, /data-tone="grounded"/);
    assert.equal(validatePublicHomeLanguage(out).ok, true);
  }
});

// ── Firewall stays clean with the enriched, identity-driven render ───
test('identity-driven render (rich + empty) still passes the firewall', () => {
  const rich  = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  const empty = phRenderPublicHome(phPublicHomeModel({}));
  assert.equal(validatePublicHomeLanguage(rich).ok, true);
  assert.equal(validatePublicHomeLanguage(empty).ok, true);
  // No internal / branded name, and no provenance data-source attribute.
  [/\bCompass\b/i, /\bNexus\b/i, /\bSparks?\b/i, /\bOM[\s-]?Cipher\b/i,
   /\bLiving Profile\b/i, /\bField Observations?\b/i, /\bdata-source\b/].forEach((re) => {
    assert.ok(!re.test(rich), 'leaked: ' + re);
  });
});

console.log('\nStatic CSS assertions (scoped .phpub-* in studio.html)');

test('scoped CSS reads density / type / motion / tone from data-* on the root', () => {
  assert.match(html, /\.phpub\[data-density="rich"\]/);
  assert.match(html, /\.phpub\[data-type="editorial"\]/);
  assert.match(html, /\.phpub\[data-motion="alive"\]/);
  assert.match(html, /\.phpub\[data-tone="luminous"\]/);
  // "still" motion halts the breathing atmosphere.
  assert.match(html, /\.phpub\[data-motion="still"\][\s\S]*?\.phpub-halo/);
});

test('density feeds section spacing, type feeds display type, motion feeds halo pace', () => {
  // Density scale variable drives the room grid gap + room padding.
  assert.match(html, /gap: calc\(clamp\([^)]*\) \* var\(--phpub-space/);
  assert.match(html, /padding: calc\(clamp\([^)]*\) \* var\(--phpub-space/);
  // Type direction variables drive the display type size + tracking.
  assert.match(html, /font-size: calc\(clamp\([^)]*\) \* var\(--phpub-type-scale/);
  assert.match(html, /letter-spacing: var\(--phpub-tracking/);
  // Motion drives the halo animation duration; tone drives the halo mix.
  assert.match(html, /animation: phpub-breathe var\(--phpub-motion-dur/);
  assert.match(html, /var\(--phpub-accent\) var\(--phpub-halo-1/);
});

test('per-room treatment CSS keys off data-intensity + --phpub-room-accent', () => {
  ['soft', 'medium', 'bold'].forEach((k) => {
    assert.ok(html.includes('.phpub-room[data-intensity="' + k + '"]'),
      'missing intensity rule: ' + k);
  });
  assert.match(html, /--phpub-room-accent: var\(--phpub-accent\)/);
  assert.match(html, /var\(--phpub-room-accent\) var\(--phpub-room-glow/);
  assert.match(html, /\.phpub-room-glyph\s*\{/);
});

test('reduced-motion still silences the phpub atmosphere', () => {
  const marker = '.phpub-halo, .phpub-scrollcue::before { animation: none';
  assert.ok(html.includes(marker), 'reduced-motion must silence halo/cue animations');
});

console.log('\n' + passed + ' checks passed.');
