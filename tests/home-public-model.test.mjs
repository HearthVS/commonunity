// Focused tests for the clean public hOMe render model
// (docs/home-design-grammar.md §3, §5, §8; roadmap "clean public hOMe
// render model"). phPublicHomeModel is the seam a future public
// render/publish surface consumes: it turns the internal preview model
// (buildWebsitePreview output, carrying builder chrome) and/or the
// first-class source seeds (HOME_SOURCE_SEEDS) into a model that holds
// ONLY visitor-facing fields — identity, hero, rooms with warm public
// labels, invitation, palette roles, status — and re-runs the language
// firewall over the assembled model.
//
// studio.html is a single ~1MB app with canvas / LLM / DOM dependencies
// and no bundler, so (like the sibling home-*.test.mjs) we do not boot the
// page in jsdom. Instead we extract the real source blocks verbatim from
// studio.html and exercise the shipped code:
//   HOME_SOURCE_SEEDS + HOME_LANGUAGE_FIREWALL + HOME_PUBLIC_LABELS +
//   HOME_PUBLIC_FALLBACKS + HOME_PUBLIC_MODEL, wired together exactly as
//   they sit in the running builder scope.
//
// Run: node tests/home-public-model.test.mjs

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

// ── Load seeds + firewall + labels + fallbacks + public model verbatim ──
const { phPublicHomeModel, validatePublicHomeLanguage } = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',    '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>', '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',    '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>', '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',     '// <HOME_PUBLIC_MODEL_END>') +
  '\nreturn { phPublicHomeModel, validatePublicHomeLanguage };'
)();

console.log('hOMe public model unit tests');

// A realistic cOMpass JSON export (mirrors state.compassData / the shape
// buildWebsitePreview reads) used to build the source seeds.
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
      lens: {
        web_intro: 'I notice the small rhythms most people walk past.',
        theme: 'Attention'
      },
      field: {
        raw: 'Restored by the coast and long walks.',
        theme: 'Coast'
      },
      call: {
        web_closing: 'Come learn to make something with your own hands.',
        theme: 'Invitation'
      }
    }
  };
}

// A preview model shaped like buildWebsitePreview output: sections carrying
// builder chrome (source tags) plus attached sourceSeeds.
function samplePreview() {
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
    sourceSeeds: (function () {
      // Build the same seeds the preview attaches, via the real helpers.
      const { phHomeSourceSeeds } = new Function(
        extractBlock('// <HOME_SOURCE_SEEDS_START>', '// <HOME_SOURCE_SEEDS_END>') +
        '\nreturn { phHomeSourceSeeds };'
      )();
      return phHomeSourceSeeds({
        compassData: sampleCompass(),
        cipherContract: { om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } } }
      });
    })()
  };
}

// ── Consumes source seeds for copy + palette roles ──────────────────
test('public model consumes sourceSeeds for copy and palette roles', () => {
  // Raw state input (no preview sections) — everything must come from seeds.
  const model = phPublicHomeModel({
    compassData: sampleCompass(),
    cipherContract: { om_cipher: { palette: { primary: '#a00', secondary: '#00a', seasonal_accent: '#0a0' } } }
  });

  assert.equal(model.identity.name, 'Mara Lindgren');
  assert.equal(model.hero.heading, 'Hand-thrown pottery');
  assert.equal(model.hero.intro, 'I notice the small rhythms most people walk past.');

  // Room bodies/headings come from the content seed.
  const work = model.rooms[0];
  assert.equal(work.heading, 'Hand-thrown pottery');
  assert.equal(work.body, 'I make functional stoneware for everyday rituals.');
  assert.deepEqual(work.highlights, ['Wheel-thrown mugs', 'Seasonal workshops']);

  // Invitation body + structured contact from the seed (malformed linkedin dropped).
  assert.equal(model.invitation.body, 'Come learn to make something with your own hands.');
  assert.deepEqual(model.invitation.contact, [
    { kind: 'email', value: 'mara@example.com' },
    { kind: 'website', value: 'https://mara.example' }
  ]);

  // Palette roles mapped from the OM Cipher palette seed.
  assert.ok(model.palette && model.palette.roles);
  assert.equal(model.palette.roles.expression, '#a00'); // primary
  assert.equal(model.palette.roles.root, '#00a');       // secondary
  assert.equal(model.palette.roles.radiance, '#0a0');   // seasonal accent
});

test('public model reads a preview model and prefers the person\'s own preview copy', () => {
  const model = phPublicHomeModel(samplePreview());
  // Hero intro from the preview (person copy) wins over the seed threshold intro.
  assert.equal(model.hero.intro, 'A small home for everyday craft.');
  assert.equal(model.identity.name, 'Mara Lindgren');
  // Palette still resolved from the attached seeds.
  assert.equal(model.palette.roles.expression, '#a00');
});

// ── Public labels / fallbacks ───────────────────────────────────────
test('public model uses the warm public room labels, never raw dimension keys', () => {
  const model = phPublicHomeModel({ compassData: sampleCompass() });
  const labels = model.rooms.map((r) => r.label);
  assert.deepEqual(labels, ['What I make', 'How I perceive', 'What keeps me alive', 'What I’m here for']);
  // No raw dimension key appears as a label or heading value.
  model.rooms.forEach((r) => {
    ['work', 'lens', 'field', 'call'].forEach((k) => {
      assert.notEqual(r.label.toLowerCase(), k);
      assert.notEqual(String(r.heading).toLowerCase(), k);
    });
  });
});

test('public model falls back to PR-#147 public prose when copy is missing', () => {
  const model = phPublicHomeModel({}); // nothing filled in
  assert.equal(model.hero.intro,
    'This is a small, honest home for what a screen can hold of me. Enough to be met truthfully — step in and look around.');
  model.rooms.forEach((r) => {
    assert.equal(r.body, 'This part of my home is still taking shape — more will settle here soon.');
  });
  assert.equal(model.invitation.body, 'Ways to reach me and where to find me will live here soon.');
  assert.equal(model.status.present, false);
  assert.equal(model.status.roomsWithContent, 0);
});

// ── No internal-source leakage ──────────────────────────────────────
test('internal source terms in state/seed do not leak into the public model', () => {
  // Inject internal system names + provenance into the *internal* preview
  // chrome (source tags, an internal source-note field). None of these are
  // visitor-facing fields the public model should copy forward.
  const preview = samplePreview();
  preview.sections.work.source = 'compass';           // builder chrome
  preview.sections.work.sourceNote = 'sourced from Compass · Living Profile'; // internal only
  preview.provenance = 'OM Cipher palette; Nexus stream';
  preview.internalDebug = 'Field Observations · Spark';

  const model = phPublicHomeModel(preview);
  const json = JSON.stringify(model);
  // The visitor model carries none of the internal source-provenance fields.
  assert.ok(!/sourceNote/.test(json));
  assert.ok(!('source' in model.rooms[0]));
  assert.ok(!('provenance' in model));
  // And no branded system name leaked into a visitor-facing value.
  [/\bCompass\b/i, /\bNexus\b/i, /\bSparks?\b/i, /\bOM[\s-]?Cipher\b/i,
   /\bLiving Profile\b/i, /\bField Observations?\b/i, /\bsourced from\b/i].forEach((re) => {
    assert.ok(!re.test(json), 'leaked: ' + re);
  });
});

// ── Language firewall on the assembled model ────────────────────────
test('the default representative public model passes the language firewall', () => {
  const model = phPublicHomeModel(samplePreview());
  assert.ok(model.language, 'model should carry a language firewall result');
  assert.equal(model.language.ok, true, JSON.stringify(model.language.violations));
  assert.deepEqual(model.language.violations, []);
  // Independent re-validation of the whole model agrees.
  assert.equal(validatePublicHomeLanguage({
    identity: model.identity, hero: model.hero, rooms: model.rooms, invitation: model.invitation
  }).ok, true);
});

test('an intentionally injected leak is reported by the model firewall', () => {
  // A person who typed a branded term into their own hero copy: the firewall
  // must catch it in the assembled model.
  const preview = samplePreview();
  preview.sections.hero.intro = 'Sourced from my Compass and Living Profile.';
  const model = phPublicHomeModel(preview);
  assert.equal(model.language.ok, false);
  assert.ok(model.language.violations.length >= 1);
  const terms = model.language.violations.map((v) => v.term);
  assert.ok(terms.includes('Compass'));
  assert.ok(terms.includes('Living Profile'));
});

test('an injected raw dimension label is reported by the model firewall', () => {
  const preview = samplePreview();
  // Someone forces the raw taxonomy word as a custom section label.
  preview.sections.work.label = 'Work';
  const model = phPublicHomeModel(preview);
  assert.equal(model.rooms[0].label, 'Work'); // custom label honoured...
  assert.equal(model.language.ok, false);      // ...but the firewall flags it.
  assert.ok(model.language.violations.some((v) => v.type === 'taxonomy-label'));
});

// ── Safety on empty / bad input ─────────────────────────────────────
test('public model is safe and firewall-clean on null / empty input', () => {
  for (const input of [null, undefined, {}, 'nope', 0]) {
    const model = phPublicHomeModel(input);
    assert.equal(model.identity.name, '');
    assert.equal(model.rooms.length, 4);
    assert.equal(model.palette, null);
    assert.equal(model.language.ok, true, JSON.stringify(model.language.violations));
  }
});

console.log('\nStatic wiring assertions');

test('HOME_PUBLIC_MODEL sentinel block exists in studio.html', () => {
  assert.match(html, /\/\/ <HOME_PUBLIC_MODEL_START>/);
  assert.match(html, /\/\/ <HOME_PUBLIC_MODEL_END>/);
});

test('phPublicHomeModel is exposed on window.CommonUnity.builder', () => {
  assert.match(html, /publicHomeModel:\s*phPublicHomeModel/);
  assert.match(html, /buildPublicHomeModel:\s*phPublicHomeModel/);
});

test('the public model attaches a firewall result via validatePublicHomeLanguage', () => {
  const block = extractBlock('// <HOME_PUBLIC_MODEL_START>', '// <HOME_PUBLIC_MODEL_END>');
  assert.match(block, /model\.language\s*=\s*validate\(/);
});

console.log('\n' + passed + ' checks passed.');
