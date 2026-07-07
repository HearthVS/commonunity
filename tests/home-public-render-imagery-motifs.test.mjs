// Focused tests for phRenderPublicHome CONSUMING model.visualIdentity's
// imagery strategy and the BROADER motifs set (docs/home-design-grammar.md
// §3, §5, §8). PR #152 added phPublicVisualIdentity (palette, tone, density,
// motifs, imagery, per-room treatments); PR #153 wired tone/density/motion/
// type + the primary motif + per-room treatments into the render. This layer
// consumes the two remaining unused fields:
//   • visualIdentity.imagery → a decorative, aria-hidden hero "figure":
//     field strategies (atmosphere / abstract) layer luminous fields; framed
//     strategies (portrait / place / object) show an intentional inline-SVG
//     mark. No real media generation yet.
//   • the WHOLE visualIdentity.motifs list (not just motifs[0]) → a subtle
//     aria-hidden glyph rail + a data-motifs hook on the root.
// It also extends tone to a faint surface tone-tint. All values stay
// public-safe and the rendered HTML still passes validatePublicHomeLanguage().
//
// Like the sibling home-*.test.mjs, studio.html is a single ~1MB app with no
// bundler, so we extract the real source blocks verbatim and exercise the
// shipped code, plus scan the raw file for the scoped CSS that reads the hooks.
//
// Run: node tests/home-public-render-imagery-motifs.test.mjs

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

// A cОMpass export + palette used to build a rich source-seeded preview. The
// "water"/"coast" themes deliberately surface >1 motif so the broader set is
// exercised, and the present palette makes the imagery strategy atmospheric.
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

function samplePreview(cipher) {
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
    sourceSeeds: phHomeSourceSeeds({ compassData: sampleCompass(), cipherContract: cipher === undefined ? sampleCipher : cipher })
  };
}

const IMAGERY_VOCAB = ['portrait', 'place', 'object', 'abstract', 'atmosphere'];
const MOTIF_VOCAB = ['threshold', 'weave', 'water', 'hearth', 'signal', 'orbit', 'garden', 'studio'];

console.log('hOMe public render — consumes imagery strategy + broader motif set');

// ── Imagery strategy → a root hook + a decorative hero figure ────────
test('root carries data-imagery from the public-safe strategy vocab', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);
  const root = out.match(/<div class="phpub"[^>]*>/)[0];
  assert.match(root, new RegExp('data-imagery="' + model.visualIdentity.imagery + '"'));
  assert.match(root, /data-imagery="(portrait|place|object|abstract|atmosphere)"/);
});

test('a present palette renders a field-strategy hero figure (layered fields)', () => {
  // Present palette → atmosphere; field strategies layer luminous fields.
  const model = phPublicHomeModel(samplePreview());
  assert.equal(model.visualIdentity.imagery, 'atmosphere');
  const out = phRenderPublicHome(model);
  const fig = out.match(/<div class="phpub-figure"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.match(fig, /data-imagery="atmosphere"/);
  assert.match(fig, /aria-hidden="true"/);
  const fields = fig.match(/<span class="phpub-field/g) || [];
  assert.ok(fields.length >= 2, 'field imagery should layer multiple fields');
  // No inline-SVG mark for a field strategy.
  assert.ok(!/phpub-figure-mark/.test(fig));
});

test('a framed imagery strategy renders an intentional inline-SVG mark', () => {
  // portrait / place / object → a media-less framed mark, no stock image.
  ['portrait', 'place', 'object'].forEach((strategy) => {
    const out = phRenderPublicHome({ rooms: [{ label: 'A' }], visualIdentity: { imagery: strategy, motifs: ['threshold'] } });
    const fig = out.match(/<div class="phpub-figure"[^>]*>[\s\S]*?<\/svg>\s*<\/div>/)[0];
    assert.match(fig, new RegExp('data-imagery="' + strategy + '"'));
    assert.match(fig, /aria-hidden="true"/);
    assert.match(fig, /<svg class="phpub-figure-mark"[^>]*role="presentation"[^>]*>/);
    assert.match(fig, /phpub-figure-frame/);
    // No <img> / external media reference — decorative vector only.
    assert.ok(!/<img|url\(https?:/i.test(fig), 'framed figure must not embed real media');
    // The SVG is inert to AT + focus.
    assert.match(fig, /focusable="false"/);
  });
});

// ── Broader motif set → a decorative glyph rail + a root data-motifs ──
test('root data-motifs lists the WHOLE motif set, not just the primary', () => {
  const model = phPublicHomeModel(samplePreview());
  const motifs = model.visualIdentity.motifs;
  assert.ok(motifs.length >= 2, 'sample should produce multiple motifs');
  const out = phRenderPublicHome(model);
  const root = out.match(/<div class="phpub"[^>]*>/)[0];
  const m = root.match(/data-motifs="([^"]*)"/);
  assert.ok(m, 'root must carry data-motifs');
  assert.deepEqual(m[1].split(' '), motifs);
});

test('the motif rail renders one aria-hidden glyph mark per motif', () => {
  const model = phPublicHomeModel(samplePreview());
  const motifs = model.visualIdentity.motifs;
  const out = phRenderPublicHome(model);
  const rail = out.match(/<p class="phpub-motif-rail"[^>]*>[\s\S]*?<\/p>/)[0];
  assert.match(rail, /aria-hidden="true"/);
  const marks = rail.match(/<span class="phpub-motif-mark" data-motif="([^"]+)">/g) || [];
  assert.equal(marks.length, motifs.length, 'one mark per motif');
  assert.ok(marks.length >= 2, 'broader set (>1 motif) must be rendered, not just motifs[0]');
  // Every rendered motif is from the fixed public-safe vocab.
  motifs.forEach((mo) => {
    assert.ok(MOTIF_VOCAB.includes(mo), 'unexpected motif: ' + mo);
    assert.match(rail, new RegExp('data-motif="' + mo + '"'));
  });
});

test('a bogus motif is filtered out of both the rail and the root hook', () => {
  const out = phRenderPublicHome({
    rooms: [{ label: 'A' }],
    visualIdentity: { imagery: 'abstract', motifs: ['threshold', 'not-a-real-motif', 'water'] }
  });
  assert.ok(!/not-a-real-motif/.test(out), 'unknown motif must never surface');
  const root = out.match(/<div class="phpub"[^>]*>/)[0];
  assert.match(root, /data-motifs="threshold water"/);
  const marks = out.match(/<span class="phpub-motif-mark"/g) || [];
  assert.equal(marks.length, 2);
});

// ── Accessibility: every new decorative element is inert ─────────────
test('the imagery figure and motif rail are decorative + aria-hidden', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  const figure = out.match(/<div class="phpub-figure"[^>]*>/)[0];
  const rail = out.match(/<p class="phpub-motif-rail"[^>]*>/)[0];
  assert.match(figure, /aria-hidden="true"/);
  assert.match(rail, /aria-hidden="true"/);
  // Marks carry no text label — glyph only, so nothing to read aloud anyway.
  const railBlock = out.match(/<p class="phpub-motif-rail"[^>]*>[\s\S]*?<\/p>/)[0];
  assert.ok(!/aria-label|title=/.test(railBlock), 'rail marks expose no readable label');
});

// ── Fallbacks: missing / malformed imagery + motifs stay safe ────────
test('missing imagery defaults to a safe field figure; missing motifs → no rail', () => {
  const out = phRenderPublicHome({ rooms: [{ label: 'A' }], visualIdentity: {} });
  const root = out.match(/<div class="phpub"[^>]*>/)[0];
  // Default imagery is abstract (field strategy).
  assert.match(root, /data-imagery="abstract"/);
  assert.ok(!/data-motifs=/.test(root), 'no motifs → no data-motifs hook');
  // A field figure still renders; no motif rail with an empty set.
  assert.match(out, /<div class="phpub-figure" data-imagery="abstract"/);
  assert.ok(!/phpub-motif-rail/.test(out), 'empty motif set renders no rail');
});

test('renderer is safe when visualIdentity / imagery / motifs are malformed', () => {
  for (const bad of [null, 'nope', 42, { imagery: 'made-up', motifs: 'x' }, { imagery: 7, motifs: [1, {}, null] }]) {
    const out = phRenderPublicHome({ rooms: [{ label: 'A' }], visualIdentity: bad });
    assert.equal(typeof out, 'string');
    // Bogus imagery falls back to the abstract default.
    assert.match(out, /data-imagery="(portrait|place|object|abstract|atmosphere)"/);
    // No non-string / non-vocab motif ever surfaces.
    assert.ok(!/data-motif="\[object Object\]"|data-motif="1"|data-motif="null"/.test(out));
    assert.equal(validatePublicHomeLanguage(out).ok, true);
  }
});

// ── Firewall stays clean with the enriched, imagery/motif-driven render ─
test('imagery/motif-driven render (rich + framed + empty) passes the firewall', () => {
  const rich   = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  const noPal  = phRenderPublicHome(phPublicHomeModel(samplePreview(null))); // abstract imagery
  const framed = phRenderPublicHome({ rooms: [{ label: 'A' }], visualIdentity: { imagery: 'portrait', motifs: MOTIF_VOCAB.slice() } });
  const empty  = phRenderPublicHome(phPublicHomeModel({}));
  [rich, noPal, framed, empty].forEach((out) => {
    assert.equal(validatePublicHomeLanguage(out).ok, true);
  });
  // No branded / internal name, no provenance attribute, in any variant.
  [/\bCompass\b/i, /\bNexus\b/i, /\bSparks?\b/i, /\bOM[\s-]?Cipher\b/i,
   /\bLiving Profile\b/i, /\bField Observations?\b/i, /\bdata-source\b/].forEach((re) => {
    [rich, framed].forEach((out) => assert.ok(!re.test(out), 'leaked: ' + re));
  });
});

console.log('\nStatic CSS assertions (scoped .phpub-* in studio.html)');

test('scoped CSS keys the hero figure off data-imagery', () => {
  assert.match(html, /\.phpub-figure\s*\{/);
  assert.match(html, /\.phpub-figure\s+\.phpub-field\s*\{/);
  assert.match(html, /\.phpub-figure-mark\s*\{/);
  assert.match(html, /\.phpub-figure-frame\s*\{/);
  assert.match(html, /\.phpub-figure\[data-imagery="(place|object)"\]/);
});

test('scoped CSS styles the motif rail glyph marks', () => {
  assert.match(html, /\.phpub-motif-rail\s*\{/);
  assert.match(html, /\.phpub-motif-mark\s*\{/);
});

test('tone extends to a faint surface tone-tint (not just the halo)', () => {
  assert.match(html, /--phpub-tone-tint:/);
  // Surface uses the tone tint toward the radiance accent.
  assert.match(html, /--phpub-surface-2:\s*color-mix\(in srgb, var\(--phpub-radiance\) var\(--phpub-tone-tint/);
  // Each tone sets its own tint value alongside the halo.
  assert.match(html, /\.phpub\[data-tone="warm"\][^}]*--phpub-tone-tint:/);
  assert.match(html, /\.phpub\[data-tone="vivid"\][^}]*--phpub-tone-tint:/);
});

test('reduced-motion + still motion silence the figure fields', () => {
  assert.match(html, /\.phpub\[data-motion="still"\]\s+\.phpub-figure\s+\.phpub-field\s*\{\s*animation: none/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.phpub-figure \.phpub-field\s*\{\s*animation: none !important/);
});

console.log('\n' + passed + ' checks passed.');
