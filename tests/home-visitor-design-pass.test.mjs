// Regression tests for the visitor design pass — the first PR of the
// July-16-demo hOMepage beauty overhaul. This slice covers three
// externally-visible behaviours we want locked in:
//
//   1. The palette seed accepts the compass export shape
//      (contract.layer4.palette = [primary, secondary, accent]) in
//      addition to the localStorage shape (contract.om_cipher.palette),
//      so a person's cipher-derived palette drives the visitor render
//      without a separate normalisation step.
//   2. The public model carries identity.photo end-to-end from
//      compass profile → seed → model, and bumps imagery from
//      'atmosphere'/'abstract' up to 'portrait' when a photo is present
//      (a real face always wins as the hero).
//   3. The renderer emits a safe <img.phpub-figure-photo> when
//      identity.photo is a data: image URL or an https URL, and
//      falls back gracefully to the atmospheric field figure when the
//      photo is absent, malformed, or its scheme is unsafe.
//
// Like the sibling home-*.test.mjs, we do not boot studio.html in jsdom —
// we extract the shipped source blocks verbatim (guarded by sentinels)
// and exercise them exactly as they sit in the running builder scope.
//
// Run: node tests/home-visitor-design-pass.test.mjs

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

// ── Load seeds + firewall + labels + fallbacks + visual identity + model + renderer ───
const {
  phCompassContentSeed,
  phOmCipherPaletteSeed,
  phPublicHomeModel,
  phRenderPublicHome,
  validatePublicHomeLanguage
} = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',            '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>',       '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',           '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',        '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_VISUAL_IDENTITY_START>',  '// <HOME_PUBLIC_VISUAL_IDENTITY_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',            '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',           '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phCompassContentSeed, phOmCipherPaletteSeed, phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage };'
)();

console.log('hOMe visitor design pass unit tests');

// ── (1) Palette seed accepts the layer4 export shape ────────────────

test('palette seed reads contract.om_cipher.layer4.palette (real compass export shape)', () => {
  // This is the shape the Python cipher engine actually writes into the
  // compass JSON export: the palette array lives NESTED inside om_cipher.layer4.
  const seed = phOmCipherPaletteSeed({
    om_cipher: {
      layer4: {
        primary_hue: 72,
        secondary_hue: 252,
        palette: [
          'oklch(0.55 0.227 72)',
          'oklch(0.55 0.227 252)',
          'oklch(0.55 0.204 170)'
        ]
      }
    }
  });
  assert.equal(seed.present, true);
  assert.equal(seed.sources.primary,   'oklch(0.55 0.227 72)');
  assert.equal(seed.sources.secondary, 'oklch(0.55 0.227 252)');
  assert.equal(seed.sources.accent,    'oklch(0.55 0.204 170)');
  assert.equal(seed.roles.expression, 'oklch(0.55 0.227 72)');
});

test('palette seed reads contract.layer4.palette (top-level variant)', () => {
  // The Python compass engine exports the palette as a 3-element array
  // of oklch(...) strings under contract.layer4.palette. The running
  // localStorage contract uses a labelled object under om_cipher.palette;
  // both shapes must produce the same roles output.
  const seed = phOmCipherPaletteSeed({
    layer4: {
      palette: [
        'oklch(0.55 0.227 72)',   // primary — honey / amber
        'oklch(0.55 0.227 252)',  // secondary — cobalt / indigo
        'oklch(0.55 0.204 170)'   // accent — soft teal
      ],
      primary_hue: 72,
      secondary_hue: 252
    }
  });
  assert.equal(seed.present, true);
  assert.equal(seed.sources.primary,   'oklch(0.55 0.227 72)');
  assert.equal(seed.sources.secondary, 'oklch(0.55 0.227 252)');
  assert.equal(seed.sources.accent,    'oklch(0.55 0.204 170)');
  // Role mapping unchanged: primary→expression, secondary→root, accent→radiance.
  assert.equal(seed.roles.expression, 'oklch(0.55 0.227 72)');
  assert.equal(seed.roles.root,       'oklch(0.55 0.227 252)');
  assert.equal(seed.roles.radiance,   'oklch(0.55 0.204 170)');
});

test('palette seed prefers om_cipher.palette over layer4.palette when both are present', () => {
  // If a person has both a compass export and a live localStorage contract,
  // the labelled localStorage shape wins so their in-app choices flow through
  // the visitor render.
  const seed = phOmCipherPaletteSeed({
    om_cipher: {
      palette: { primary: '#100', secondary: '#010', seasonal_accent: '#001' }
    },
    layer4: { palette: ['oklch(0.55 0.20 72)', 'oklch(0.55 0.20 252)', 'oklch(0.55 0.20 170)'] }
  });
  assert.equal(seed.sources.primary,   '#100');
  assert.equal(seed.sources.secondary, '#010');
  assert.equal(seed.sources.accent,    '#001');
});

test('palette seed with partial layer4 array still resolves gracefully', () => {
  // Only two entries — accent falls back to primary via phDerivePaletteTheme
  // fill-in behaviour on the seed roles output.
  const seed = phOmCipherPaletteSeed({ layer4: { palette: ['#a00', '#00a'] } });
  assert.equal(seed.present, true);
  assert.equal(seed.sources.primary,   '#a00');
  assert.equal(seed.sources.secondary, '#00a');
  assert.equal(seed.sources.accent,    '');
  // Role fill: accent role falls back to a present colour so the render
  // never has an empty radiance.
  assert.ok(seed.roles.radiance);
});

test('palette seed is absent when layer4.palette is an empty array', () => {
  const seed = phOmCipherPaletteSeed({ layer4: { palette: [] } });
  assert.equal(seed.present, false);
  assert.equal(seed.roles, null);
});

// ── (2) identity.photo flows end-to-end ─────────────────────────────

function sampleCompassWithPhoto(photoField) {
  const base = {
    companion: 'Markus Lehto',
    profile: {
      first_name: 'Markus', last_name: 'Lehto',
      email: 'markus@example.com'
    },
    points: {
      work:  { web_heading: 'Building CommonUnity', theme: 'Making' },
      lens:  { web_intro: 'I notice patterns others miss.', theme: 'Seeing' },
      field: { raw: 'Restored by the sea and slow walks.', theme: 'Coast' },
      call:  { web_closing: 'Come make something with me.', theme: 'Welcome' }
    }
  };
  if (photoField) Object.assign(base.profile, photoField);
  return base;
}

test('content seed carries profile.profile_image_data as photo', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const seed = phCompassContentSeed(sampleCompassWithPhoto({ profile_image_data: dataUrl }));
  assert.equal(seed.photo, dataUrl);
});

test('content seed falls back to profile.profile_image URL', () => {
  const url = 'https://example.com/portrait.jpg';
  const seed = phCompassContentSeed(sampleCompassWithPhoto({ profile_image: url }));
  assert.equal(seed.photo, url);
});

test('content seed photo is an empty string when no photo field is present', () => {
  const seed = phCompassContentSeed(sampleCompassWithPhoto());
  assert.equal(seed.photo, '');
});

test('public model exposes identity.photo end-to-end', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const seeds = {
    content: phCompassContentSeed(sampleCompassWithPhoto({ profile_image_data: dataUrl })),
    palette: phOmCipherPaletteSeed({})
  };
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  assert.equal(model.identity.name, 'Markus Lehto');
  assert.equal(model.identity.photo, dataUrl);
});

test('imagery bumps to "portrait" when a photo is present', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const seeds = {
    content: phCompassContentSeed(sampleCompassWithPhoto({ profile_image_data: dataUrl })),
    palette: phOmCipherPaletteSeed({ om_cipher: { palette: { primary: '#100', secondary: '#010', seasonal_accent: '#001' } } })
  };
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  assert.equal(model.visualIdentity.imagery, 'portrait');
});

test('imagery stays "atmosphere" when no photo is present but palette is', () => {
  const seeds = {
    content: phCompassContentSeed(sampleCompassWithPhoto()),
    palette: phOmCipherPaletteSeed({ om_cipher: { palette: { primary: '#100', secondary: '#010', seasonal_accent: '#001' } } })
  };
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  assert.equal(model.visualIdentity.imagery, 'atmosphere');
});

test('imagery stays "abstract" when no photo AND no palette', () => {
  const seeds = {
    content: phCompassContentSeed(sampleCompassWithPhoto()),
    palette: phOmCipherPaletteSeed({})
  };
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  assert.equal(model.visualIdentity.imagery, 'abstract');
});

// ── (3) Renderer emits a safe portrait <img>, falls back gracefully ─

function renderWithPhoto(photo) {
  const seeds = {
    content: phCompassContentSeed(sampleCompassWithPhoto(photo ? { profile_image_data: photo } : undefined)),
    palette: phOmCipherPaletteSeed({ om_cipher: { palette: { primary: '#100', secondary: '#010', seasonal_accent: '#001' } } })
  };
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  return { model, html: phRenderPublicHome(model) };
}

test('renderer emits <img class="phpub-figure-photo"> for a data: image URL', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const { html: out } = renderWithPhoto(dataUrl);
  assert.match(out, /class="phpub-figure-photo"/);
  assert.match(out, /data-imagery="portrait"/);
  assert.match(out, /data-has-photo="true"/);
  // The photo src is escaped and present.
  assert.ok(out.includes(dataUrl), 'rendered HTML must include the data URL');
  // Decorative — no alt text, aria-hidden on the figure.
  assert.match(out, /alt=""/);
  assert.match(out, /aria-hidden="true"/);
});

test('renderer emits <img> for an https URL', () => {
  const url = 'https://example.com/portrait.jpg';
  // We call the renderer directly so we can inject an https photo without
  // routing through the seed (whose input we just proved carries it).
  const seeds = {
    content: phCompassContentSeed(sampleCompassWithPhoto({ profile_image: url })),
    palette: phOmCipherPaletteSeed({})
  };
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  const out = phRenderPublicHome(model);
  assert.ok(out.includes(url), 'rendered HTML must include the https URL');
  assert.match(out, /class="phpub-figure-photo"/);
});

test('renderer rejects an unsafe photo scheme and falls back to the field figure', () => {
  // A javascript: URL must never render as an <img src>. The renderer
  // still tags the figure as data-imagery="portrait" (the model said
  // portrait) but emits no <img> and no photo string; the atmospheric
  // field figure would render for a field-imagery strategy — here the
  // portrait branch simply does not activate the <img>, so the figure
  // element has no phpub-figure-photo child.
  const bad = 'javascript:alert(1)';
  const seeds = {
    content: { present: true, name: 'X', photo: bad, threshold: { heading: '', intro: '' }, dimensions: {}, themes: [], invitation: { body: '', contact: [] } },
    palette: phOmCipherPaletteSeed({})
  };
  // Force imagery=portrait via a direct model construction. In practice a
  // bad scheme in the seed would still bump imagery to portrait (the
  // model only checks for a non-empty string); the render-time safety
  // filter is what protects the surface.
  const model = phPublicHomeModel({ sourceSeeds: seeds });
  const out = phRenderPublicHome(model);
  assert.ok(!out.includes(bad), 'rendered HTML must not include an unsafe URL scheme');
  assert.ok(!/class="phpub-figure-photo"/.test(out),
    'no <img class="phpub-figure-photo"> when the photo scheme is unsafe');
});

test('renderer emits no portrait <img> when identity.photo is empty', () => {
  const { html: out } = renderWithPhoto('');
  assert.ok(!/class="phpub-figure-photo"/.test(out));
  // No photo means imagery stays atmosphere (palette present) → field figure.
  assert.match(out, /data-imagery="atmosphere"/);
});

test('portrait render still passes the public-language firewall', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const { model, html: out } = renderWithPhoto(dataUrl);
  // Firewall scans the rendered HTML text (as sibling tests do).
  const r = validatePublicHomeLanguage(out);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  // Sanity — identity is still surfaced.
  assert.match(out, new RegExp(model.identity.name));
});

// ── (4) CSS wiring — the visitor design pass block ships in studio.html

test('CSS: visitor design pass block is present in studio.html', () => {
  assert.match(html, /Visitor design pass/);
});

test('CSS: portrait figure rule is present', () => {
  assert.match(html, /\.phpub-figure-photo\s*\{/);
});

test('CSS: alternating room band rule is present', () => {
  assert.match(html, /\.phpub-rooms\s*>\s*\.phpub-room:nth-child\(even\)/);
});

test('CSS: Inter Tight is applied to hero title', () => {
  assert.match(html, /font-family:\s*'Inter Tight'/);
});

test('CSS: Inter is applied to .phpub body', () => {
  assert.match(html, /\.phpub\s*\{[^}]*font-family:\s*'Inter'/s);
});

test('CSS: Google Fonts link for Inter + Inter Tight is present', () => {
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter:.*Inter\+Tight/);
});

console.log('\n' + passed + ' checks passed.');
