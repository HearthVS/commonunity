// Focused tests for the enriched Prototype-2-style visual language of the
// visitor-facing hOMe render (the .phpub-* seam). PR #150 shipped a minimal
// render; this layer adds a luminous atmosphere (breathing halos + faint
// grain), per-room accents driven by the public palette radiance, and public
// web polish — while preserving the public/internal language firewall.
//
// Two kinds of assertion here:
//   1. Rendered-HTML: phRenderPublicHome now emits decorative, aria-hidden
//      atmosphere hooks and position-based per-room accent classes, and STILL
//      passes validatePublicHomeLanguage() (no internal leakage).
//   2. Static CSS: the scoped .phpub CSS in studio.html carries the atmosphere,
//      per-room accent, palette-role, and reduced-motion rules the render needs.
//
// Like the sibling home-*.test.mjs, studio.html is a single ~1MB app with no
// bundler, so we extract the real source blocks verbatim and also scan the raw
// file for the scoped CSS.
//
// Run: node tests/home-public-render-visuals.test.mjs

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
  extractBlock('// <HOME_SOURCE_SEEDS_START>',      '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>', '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',     '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',  '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',      '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',     '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage };'
)();

// A cОMpass export + palette used to build a rich source-seeded preview.
function sampleCompass() {
  return {
    companion: 'Mara Lindgren',
    profile: { first_name: 'Mara', last_name: 'Lindgren', email: 'mara@example.com', website: 'https://mara.example' },
    points: {
      work:  { web_heading: 'Hand-thrown pottery', web_intro: 'I make functional stoneware for everyday rituals.',
               highlights: ['Wheel-thrown mugs', 'Seasonal workshops'] },
      lens:  { web_intro: 'I notice the small rhythms most people walk past.' },
      field: { raw: 'Restored by the coast and long walks.' },
      call:  { web_closing: 'Come learn to make something with your own hands.' }
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
               highlights: ['Wheel-thrown mugs'], closing: '', source: 'compass' },
      lens:  { heading: '', intro: 'I notice the small rhythms most people walk past.', highlights: [], closing: '', source: 'compass' },
      field: { heading: '', intro: 'Restored by the coast.', highlights: [], closing: '', source: 'compass' },
      call:  { heading: '', intro: '', highlights: [], closing: 'Come learn to make something.', source: 'compass' },
      invitation: { body: '', contact: ['Email: mara@example.com'], source: 'empty' }
    },
    sourceSeeds: phHomeSourceSeeds({ compassData: sampleCompass(), cipherContract: sampleCipher })
  };
}

console.log('hOMe public render — enriched visuals');

// ── Rendered HTML carries decorative atmosphere hooks ────────────────
test('hero and invitation emit aria-hidden atmosphere (halo + grain)', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  // Atmosphere layer appears twice (hero + invitation) and is decorative only.
  const atmosCount = (out.match(/class="phpub-atmos" aria-hidden="true"/g) || []).length;
  assert.ok(atmosCount >= 2, 'expected atmosphere in hero + invitation, saw ' + atmosCount);
  assert.match(out, /class="phpub-halo"/);
  assert.match(out, /class="phpub-grain"/);
  // A gentle scroll cue in the hero and a luminous mark in the invitation.
  assert.match(out, /class="phpub-scrollcue" aria-hidden="true"/);
  assert.match(out, /class="phpub-invitation-mark" aria-hidden="true"/);
});

// ── Per-room position accent classes (never the raw dimension key) ───
test('each room carries a position-based accent class s-N', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  ['phpub-room s-1', 'phpub-room s-2', 'phpub-room s-3', 'phpub-room s-4'].forEach((cls) => {
    assert.ok(out.includes(cls), 'missing per-room accent hook: ' + cls);
  });
  // The raw internal dimension keys must never become classes.
  [/s-work/, /s-lens/, /s-field/, /s-call/].forEach((re) => {
    assert.ok(!re.test(out), 'internal dimension key leaked as a class: ' + re);
  });
});

// ── Palette roles still drive scoped CSS custom properties ───────────
test('palette roles become scoped CSS vars the visuals read from', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  assert.match(out, /--phpub-expression:#a00/);
  assert.match(out, /--phpub-root:#00a/);
  assert.match(out, /--phpub-radiance:#0a0/);
});

// ── The enriched render stays firewall-clean ─────────────────────────
test('enriched render still passes the language firewall (rich + empty)', () => {
  const rich  = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  const empty = phRenderPublicHome(phPublicHomeModel({}));
  assert.equal(validatePublicHomeLanguage(rich).ok, true);
  assert.equal(validatePublicHomeLanguage(empty).ok, true);
  // No internal / branded system name anywhere, even in decorative markup.
  [/\bCompass\b/i, /\bNexus\b/i, /\bSparks?\b/i, /\bOM[\s-]?Cipher\b/i,
   /\bLiving Profile\b/i, /\bField Observations?\b/i].forEach((re) => {
    assert.ok(!re.test(rich), 'leaked internal term: ' + re);
  });
});

test('decorative atmosphere holds no text for a screen reader to announce', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  // The halo/grain/mark spans are self-closing empties — assert they carry no text node.
  assert.match(out, /<span class="phpub-halo"><\/span>/);
  assert.match(out, /<span class="phpub-grain"><\/span>/);
  assert.match(out, /<div class="phpub-invitation-mark" aria-hidden="true"><\/div>/);
});

console.log('\nStatic CSS assertions (scoped .phpub-* in studio.html)');

test('scoped CSS defines the atmosphere: breathing halo + grain', () => {
  assert.match(html, /\.phpub-halo\s*\{/);
  assert.match(html, /\.phpub-grain\s*\{/);
  assert.match(html, /@keyframes phpub-breathe\b/);
  assert.match(html, /feTurbulence/); // the inline grain noise
});

test('scoped CSS maps the four per-room accents from the palette radiance', () => {
  ['.phpub-room.s-1', '.phpub-room.s-2', '.phpub-room.s-3', '.phpub-room.s-4'].forEach((sel) => {
    assert.ok(html.includes(sel), 'missing per-room accent rule: ' + sel);
  });
  // Accents are derived from the palette radiance role, not hardcoded alone.
  assert.match(html, /--phpub-accent:\s*color-mix\(in srgb, var\(--phpub-radiance\)/);
});

test('scoped CSS derives surfaces/ink from the palette root + expression roles', () => {
  assert.match(html, /--phpub-surface:/);
  assert.match(html, /--phpub-ink-soft:\s*color-mix\(in srgb, var\(--phpub-expression\)/);
  assert.match(html, /--phpub-line:\s*color-mix\(in srgb, var\(--phpub-expression\)/);
});

test('scoped CSS respects prefers-reduced-motion for the phpub atmosphere', () => {
  // Find the reduced-motion block that governs the phpub halos/cue specifically.
  const marker = '.phpub-halo, .phpub-scrollcue::before { animation: none';
  assert.ok(html.includes(marker), 'phpub reduced-motion rule must silence the halo/cue animations');
  const mediaIdx = html.lastIndexOf('@media (prefers-reduced-motion: reduce)', html.indexOf(marker));
  assert.ok(mediaIdx !== -1 && mediaIdx < html.indexOf(marker),
    'the phpub reduced-motion rule must live inside a prefers-reduced-motion media query');
});

test('scoped CSS gives accessible focus-visible + selection styling', () => {
  assert.match(html, /\.phpub :focus-visible\s*\{/);
  assert.match(html, /\.phpub ::selection\s*\{/);
});

console.log('\n' + passed + ' checks passed.');
