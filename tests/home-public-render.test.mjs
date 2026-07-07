// Focused tests for the pure, visitor-facing hOMe renderer
// (docs/home-design-grammar.md §3, §5, §8; Prototype 2 outward-facing
// direction). phRenderPublicHome consumes the clean public model from
// phPublicHomeModel (PR #149) and returns ONLY the HTML a stranger reads —
// a person-first threshold, a rooms index, the rooms with warm public
// labels, and an invitation — with no builder chrome and no internal /
// branded / taxonomy language, so the rendered HTML passes
// validatePublicHomeLanguage(). This is the first visible public hOMe render
// path, surfaced read-only behind the preview's "Preview as visitor" toggle.
//
// Like the sibling home-*.test.mjs, studio.html is a single ~1MB app with no
// bundler, so we don't boot the page in jsdom. Instead we extract the real
// source blocks verbatim and exercise the shipped code wired together exactly
// as it sits in the running builder scope.
//
// Run: node tests/home-public-render.test.mjs

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

// ── Load seeds + firewall + labels + fallbacks + model + renderer verbatim ──
const { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage } = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',      '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>', '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',     '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',  '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',      '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',     '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage };'
)();

console.log('hOMe public render unit tests');

// A realistic cOMpass JSON export used to build the source seeds.
function sampleCompass() {
  return {
    companion: 'Mara Lindgren',
    profile: {
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
        highlights: ['Wheel-thrown mugs', { text: 'Seasonal workshops' }]
      },
      lens: { web_intro: 'I notice the small rhythms most people walk past.', theme: 'Attention' },
      field: { raw: 'Restored by the coast and long walks.', theme: 'Coast' },
      call: { web_closing: 'Come learn to make something with your own hands.', theme: 'Invitation' }
    }
  };
}

const sampleCipher = { om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } } };

// A preview model shaped like buildWebsitePreview output.
function samplePreview() {
  const { phHomeSourceSeeds } = new Function(
    extractBlock('// <HOME_SOURCE_SEEDS_START>', '// <HOME_SOURCE_SEEDS_END>') +
    '\nreturn { phHomeSourceSeeds };'
  )();
  return {
    name: 'Mara Lindgren',
    sections: {
      hero: { heading: 'Hand-thrown pottery', intro: 'A small home for everyday craft.', source: 'compass' },
      work: { heading: 'Hand-thrown pottery', intro: 'I make functional stoneware for everyday rituals.',
              highlights: ['Wheel-thrown mugs'], closing: '', source: 'compass' },
      lens: { heading: '', intro: 'I notice the small rhythms most people walk past.', highlights: [], closing: '', source: 'compass' },
      field: { heading: '', intro: '', highlights: [], closing: '', source: 'empty' },
      call: { heading: '', intro: '', highlights: [], closing: '', source: 'empty' },
      invitation: { body: '', contact: ['Email: mara@example.com'], source: 'empty' }
    },
    sourceSeeds: phHomeSourceSeeds({ compassData: sampleCompass(), cipherContract: sampleCipher })
  };
}

// ── Renders public labels + content from the model ──────────────────
test('renderer emits person-first hero, public labels, and room content', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);

  // Person-first hero: the person's own hero intro (preview copy) wins.
  assert.match(out, /class="phpub-hero"/);
  assert.match(out, /Hand-thrown pottery/);            // hero heading
  assert.match(out, /A small home for everyday craft\./); // hero intro (person copy)

  // Warm public room labels appear; raw dimension keys never do.
  ['What I make', 'How I perceive', 'What keeps me alive', 'What I’m here for'].forEach((label) => {
    assert.ok(out.includes(label), 'missing public label: ' + label);
  });

  // Room body + highlight from the seed/preview content.
  assert.match(out, /I make functional stoneware for everyday rituals\./);
  assert.match(out, /Wheel-thrown mugs/);
});

test('renderer emits an invitation with structured contact links', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);
  assert.match(out, /class="phpub-invitation"/);
  assert.match(out, /Come learn to make something with your own hands\./);
  // email + website contact from the seed become real links (malformed dropped).
  assert.match(out, /href="mailto:mara@example\.com"/);
  assert.match(out, /href="https:\/\/mara\.example"/);
  assert.ok(!/not-a-url/.test(out));
});

// ── Palette roles become CSS variables ──────────────────────────────
test('palette roles are emitted as scoped CSS custom properties', () => {
  const model = phPublicHomeModel(samplePreview());
  const out = phRenderPublicHome(model);
  assert.match(out, /--phpub-expression:#a00/); // primary
  assert.match(out, /--phpub-root:#00a/);        // secondary
  assert.match(out, /--phpub-radiance:#0a0/);    // seasonal accent
});

test('no palette → no style attribute, still renders cleanly', () => {
  const model = phPublicHomeModel({ compassData: sampleCompass() }); // no cipher palette
  const out = phRenderPublicHome(model);
  assert.equal(model.palette, null);
  assert.ok(!/--phpub-root/.test(out));
  assert.match(out, /class="phpub"/);
});

// ── Fallbacks flow through the renderer ─────────────────────────────
test('renderer shows PR-#147 public fallback prose when copy is missing', () => {
  const out = phRenderPublicHome(phPublicHomeModel({}));
  assert.match(out,
    /This is a small, honest home for what a screen can hold of me\./);
  assert.match(out,
    /This part of my home is still taking shape — more will settle here soon\./);
  assert.match(out, /Ways to reach me and where to find me will live here soon\./);
});

// ── No builder chrome, no internal language ─────────────────────────
test('rendered HTML carries no builder chrome', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  // None of the builder-only surfaces leak into the visitor render body.
  [/Source notes/i, /Tune this room/i, /lp-source-tag/, /studio-project-header/,
   /Preview only/i, /data-ph-tune/, /From Compass/i, /Awaiting ·/].forEach((re) => {
    assert.ok(!re.test(out), 'builder chrome leaked: ' + re);
  });
});

test('rendered HTML has no internal terms and passes the firewall', () => {
  const out = phRenderPublicHome(phPublicHomeModel(samplePreview()));
  // No branded / internal system name anywhere in the rendered string.
  [/\bCompass\b/i, /\bNexus\b/i, /\bSparks?\b/i, /\bOM[\s-]?Cipher\b/i,
   /\bLiving Profile\b/i, /\bField Observations?\b/i, /\bsourced from\b/i,
   /\bsource\s*:/i].forEach((re) => {
    assert.ok(!re.test(out), 'leaked internal term: ' + re);
  });
  // The firewall agrees on the rendered visitor HTML string.
  const fw = validatePublicHomeLanguage(out);
  assert.equal(fw.ok, true, JSON.stringify(fw.violations));
});

test('firewall stays clean on the empty-fallback render too', () => {
  const out = phRenderPublicHome(phPublicHomeModel({}));
  assert.equal(validatePublicHomeLanguage(out).ok, true);
});

// ── HTML-escaping / safety ──────────────────────────────────────────
test('renderer escapes person copy (no raw HTML injection)', () => {
  const preview = samplePreview();
  preview.sections.hero.intro = 'Hi <script>alert(1)</script> & "friends"';
  const out = phRenderPublicHome(phPublicHomeModel(preview));
  assert.ok(!/<script>alert/.test(out));
  assert.match(out, /&lt;script&gt;/);
  assert.match(out, /&amp;/);
});

test('renderer is safe on null / empty / bad input', () => {
  for (const input of [null, undefined, {}, 'nope', 0]) {
    const out = phRenderPublicHome(input);
    assert.equal(typeof out, 'string');
    assert.match(out, /class="phpub"/);
    assert.equal(validatePublicHomeLanguage(out).ok, true);
  }
});

console.log('\nStatic wiring assertions');

test('HOME_PUBLIC_RENDER sentinel block exists in studio.html', () => {
  assert.match(html, /\/\/ <HOME_PUBLIC_RENDER_START>/);
  assert.match(html, /\/\/ <HOME_PUBLIC_RENDER_END>/);
});

test('phRenderPublicHome is exposed on window.CommonUnity.builder', () => {
  assert.match(html, /renderPublicHome:\s*phRenderPublicHome/);
});

test('a read-only "Preview as visitor" path is wired into the preview', () => {
  // Visitor view state, the toggle control, and the render call all exist.
  assert.match(html, /var phVisitorView = false;/);
  assert.match(html, /id="ph-visitor-toggle"/);
  assert.match(html, /function renderVisitorPreview\(/);
  assert.match(html, /phRenderPublicHome\(publicModel\)/);
  // The visitor path assembles the public model from the preview model.
  assert.match(html, /var publicModel = phPublicHomeModel\(model\);/);
});

console.log('\n' + passed + ' checks passed.');
