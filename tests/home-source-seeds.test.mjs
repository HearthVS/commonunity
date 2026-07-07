// Focused tests for the first-class hOMe source seeds
// (docs/home-design-grammar.md §8 "Required internal source inputs" +
// roadmap #11: "Wire cOMpass and OM Cipher as first-class builder
// inputs"). The hOMe builder must read the person's cOMpass JSON as its
// primary *content* seed and the OM Cipher palette as its primary
// *visual* seed — as an explicit, testable source contract — before
// asking the person to fill or style anything, and without ever leaking
// those internal system names onto the public visitor surface.
//
// studio.html is a single ~1MB app with canvas / LLM / DOM dependencies
// and no bundler, so (like tests/home-language-firewall.test.mjs) we do
// not boot the page in jsdom. Instead we:
//   1. extract the real HOME_SOURCE_SEEDS block verbatim from studio.html
//      and exercise it, so the tests run against the shipped source;
//   2. extract the HOME_LANGUAGE_FIREWALL block and prove a representative
//      public model assembled from a seed passes the firewall; and
//   3. statically assert the render wiring (buildWebsitePreview attaches
//      the seeds, phApplyPaletteRoles consumes the palette seed, and the
//      helpers are exposed on window.CommonUnity.builder).
//
// Run: node tests/home-source-seeds.test.mjs

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

// ── Load the source-seed + firewall blocks verbatim ─────────────────
const { phCompassContentSeed, phOmCipherPaletteSeed, phHomeSourceSeeds } =
  new Function(
    extractBlock('// <HOME_SOURCE_SEEDS_START>', '// <HOME_SOURCE_SEEDS_END>') +
    '\nreturn { phCompassContentSeed, phOmCipherPaletteSeed, phHomeSourceSeeds };'
  )();

const { validatePublicHomeLanguage: validate } = new Function(
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>', '// <HOME_LANGUAGE_FIREWALL_END>') +
  '\nreturn { validatePublicHomeLanguage };'
)();

console.log('hOMe source seeds unit tests');

// A realistic cOMpass JSON export (mirrors the state.compassData shape
// exercised in tests/fixtures and buildWebsitePreview).
function sampleCompass() {
  return {
    companion: 'Mara Lindgren',
    profile: {
      display_name: '',
      first_name: 'Mara',
      last_name: 'Lindgren',
      email: 'mara@example.com',
      website: 'https://mara.example',
      linkedin_url: 'not-a-url'
    },
    points: {
      work: {
        web_heading: 'Hand-thrown pottery',
        web_intro: 'I make functional stoneware for everyday rituals.',
        theme: 'Craft',
        highlights: ['Wheel-thrown mugs', { text: 'Seasonal workshops' }, { label: 'Custom commissions' }]
      },
      lens: {
        web_intro: 'I notice the small rhythms most people walk past.',
        theme: 'Attention',
        summary: 'A slower way of seeing.'
      },
      field: {
        raw: 'Restored by the coast and long walks.',
        theme: 'Coast',
        highlights: []
      },
      call: {
        web_closing: 'Come learn to make something with your own hands.',
        summary: 'Helping people slow down and create.',
        theme: 'Invitation'
      }
    }
  };
}

// ── Content seed: extraction ────────────────────────────────────────
test('content seed maps threshold / dimensions / highlights / themes / offers', () => {
  const seed = phCompassContentSeed(sampleCompass());
  assert.equal(seed.present, true);
  assert.equal(seed.name, 'Mara Lindgren');

  // Threshold / hero prefers a dimension web heading, then intro copy.
  assert.equal(seed.threshold.heading, 'Hand-thrown pottery');
  assert.equal(seed.threshold.intro, 'I notice the small rhythms most people walk past.');

  // Per-dimension copy.
  assert.equal(seed.dimensions.work.heading, 'Hand-thrown pottery');
  assert.equal(seed.dimensions.work.body, 'I make functional stoneware for everyday rituals.');
  assert.equal(seed.dimensions.lens.body, 'I notice the small rhythms most people walk past.');
  assert.equal(seed.dimensions.field.body, 'Restored by the coast and long walks.');

  // Highlights normalise strings + {text|label|title} and cap at 6.
  assert.deepEqual(seed.dimensions.work.highlights,
    ['Wheel-thrown mugs', 'Seasonal workshops', 'Custom commissions']);
  assert.deepEqual(seed.dimensions.field.highlights, []);

  // Themes collected across dimensions.
  assert.deepEqual(seed.themes, ['Craft', 'Attention', 'Coast', 'Invitation']);

  // Offers / invitation seed from the call dimension + valid contacts only
  // (the malformed linkedin_url is dropped).
  assert.equal(seed.invitation.body, 'Come learn to make something with your own hands.');
  assert.deepEqual(seed.invitation.contact, [
    { kind: 'email', value: 'mara@example.com' },
    { kind: 'website', value: 'https://mara.example' }
  ]);
});

test('content seed falls back to companion name when no profile name', () => {
  const seed = phCompassContentSeed({ companion: 'Eda Solberg', points: {} });
  assert.equal(seed.name, 'Eda Solberg');
  assert.equal(seed.threshold.heading, 'Eda Solberg');
});

test('content seed is present:false and safe on empty / null input', () => {
  for (const input of [null, undefined, {}, { points: {} }, 'nope', 0]) {
    const seed = phCompassContentSeed(input);
    assert.equal(seed.present, false, 'expected empty for ' + JSON.stringify(input));
    assert.equal(seed.name, '');
    assert.deepEqual(seed.themes, []);
    assert.deepEqual(seed.invitation.contact, []);
    assert.deepEqual(seed.dimensions.work.highlights, []);
  }
});

// ── Visual seed: palette role extraction ────────────────────────────
test('palette seed maps primary/secondary/accent onto root/expression/radiance', () => {
  const seed = phOmCipherPaletteSeed({
    om_cipher: {
      palette: {
        primary: 'oklch(0.55 0.20 280)',
        secondary: 'oklch(0.40 0.08 250)',
        seasonal_accent: 'oklch(0.75 0.15 60)'
      }
    }
  });
  assert.equal(seed.present, true);
  assert.equal(seed.sources.primary, 'oklch(0.55 0.20 280)');
  // Role mapping mirrors phDerivePaletteTheme.
  assert.equal(seed.roles.expression, 'oklch(0.55 0.20 280)'); // ← primary
  assert.equal(seed.roles.root, 'oklch(0.40 0.08 250)');       // ← secondary
  assert.equal(seed.roles.radiance, 'oklch(0.75 0.15 60)');    // ← accent
});

test('palette seed accepts legacy `accent` when `seasonal_accent` is absent', () => {
  const seed = phOmCipherPaletteSeed({ om_cipher: { palette: { primary: '#a00', accent: '#0a0' } } });
  assert.equal(seed.sources.accent, '#0a0');
  assert.equal(seed.roles.radiance, '#0a0');
});

test('palette seed resolves all three roles from a partial palette', () => {
  const seed = phOmCipherPaletteSeed({ om_cipher: { palette: { primary: '#123456' } } });
  assert.equal(seed.present, true);
  assert.equal(seed.roles.root, '#123456');
  assert.equal(seed.roles.expression, '#123456');
  assert.equal(seed.roles.radiance, '#123456');
});

test('palette seed is present:false with null roles when no colours', () => {
  for (const input of [null, undefined, {}, { om_cipher: {} }, { om_cipher: { palette: {} } }]) {
    const seed = phOmCipherPaletteSeed(input);
    assert.equal(seed.present, false, 'expected absent for ' + JSON.stringify(input));
    assert.equal(seed.roles, null);
    assert.deepEqual(seed.sources, { primary: '', secondary: '', accent: '' });
  }
});

// ── Combined seed layer ─────────────────────────────────────────────
test('phHomeSourceSeeds combines content + palette seeds', () => {
  const seeds = phHomeSourceSeeds({
    compassData: sampleCompass(),
    cipherContract: { om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } } }
  });
  assert.equal(seeds.content.present, true);
  assert.equal(seeds.palette.present, true);
  assert.equal(seeds.content.name, 'Mara Lindgren');
  assert.equal(seeds.palette.roles.expression, '#a00');
});

test('phHomeSourceSeeds is safe with no input', () => {
  const seeds = phHomeSourceSeeds();
  assert.equal(seeds.content.present, false);
  assert.equal(seeds.palette.present, false);
});

// ── Public-language safety ──────────────────────────────────────────
// The seeds are internal builder material, but their VALUES must be able
// to flow into a public model without tripping the firewall, and the
// system names must never appear in the seeds themselves.
test('a public model assembled from the content seed is firewall-clean', () => {
  const seed = phCompassContentSeed(sampleCompass());
  // Assemble a visitor model the way a public render would: warm labels,
  // never the internal dimension keys.
  const publicModel = {
    heading: seed.threshold.heading,
    intro: seed.threshold.intro,
    sections: [
      { label: 'What I make', body: seed.dimensions.work.body, highlights: seed.dimensions.work.highlights },
      { label: 'How I perceive', body: seed.dimensions.lens.body },
      { label: 'What keeps me alive', body: seed.dimensions.field.body },
      { label: "What I'm here for", body: seed.invitation.body }
    ]
  };
  const r = validate(publicModel);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

test('content seed can carry internal dimension data without leaking as public text', () => {
  // The whole seed object (internal keys work/lens/field/call, themes, etc.)
  // must not itself contain any branded/provenance/taxonomy violation in a
  // value a visitor would read. Object keys are builder architecture, not
  // rendered text, so the firewall (which scans values) stays clean.
  const seed = phCompassContentSeed(sampleCompass());
  const r = validate(seed);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
});

test('palette seed never contains the system name "OM Cipher" or "Compass"', () => {
  const seed = phOmCipherPaletteSeed({
    om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } }
  });
  const json = JSON.stringify(seed);
  assert.ok(!/cipher/i.test(json), 'palette seed must not carry the OM Cipher system name');
  assert.ok(!/compass/i.test(json), 'palette seed must not carry the cOMpass system name');
  // And it passes the firewall directly.
  assert.equal(validate(seed).ok, true);
});

console.log('\nStatic wiring assertions');

test('HOME_SOURCE_SEEDS sentinel block exists in studio.html', () => {
  assert.match(html, /\/\/ <HOME_SOURCE_SEEDS_START>/);
  assert.match(html, /\/\/ <HOME_SOURCE_SEEDS_END>/);
});

test('the three seed helpers are exposed on window.CommonUnity.builder', () => {
  assert.match(html, /compassContentSeed:\s*phCompassContentSeed/);
  assert.match(html, /omCipherPaletteSeed:\s*phOmCipherPaletteSeed/);
  assert.match(html, /homeSourceSeeds:\s*phHomeSourceSeeds/);
});

test('buildWebsitePreview attaches the source seeds to its model', () => {
  assert.match(html, /sourceSeeds:\s*sourceSeeds/);
  assert.match(html, /phHomeSourceSeeds\(\{/);
});

test('phApplyPaletteRoles derives its theme through the palette seed', () => {
  assert.match(html,
    /phDerivePaletteTheme\(phOmCipherPaletteSeed\(contract\)\.sources\)/);
});

console.log('\n' + passed + ' checks passed.');
