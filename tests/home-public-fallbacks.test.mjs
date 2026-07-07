// Focused tests for visitor-facing public hOMe fallback prose
// (docs/home-design-grammar.md §3, §6). When a person hasn't written
// their own hero intro / room body / invitation yet, the visitor still
// meets warm, person-first copy — never CommonUnity's internal method or
// source language (Compass, Living Profile, Nexus, Field Observations,
// Spark, provenance/source phrases, or the fixed Work/Lens/Field/Call
// taxonomy as on-screen labels).
//
// Internal builder scaffolding (the seeded-field readiness band, the
// "Source notes" disclosure, the in-place tune form) is stUdio chrome and
// legitimately still references those source systems — that split is what
// keeps the visitor surface clean without stripping the builder's tools.
//
// studio.html is a single ~1MB app with canvas / LLM / DOM dependencies
// and no bundler, so (like tests/home-language-firewall.test.mjs) we do
// not boot the page in jsdom. Instead we:
//   1. extract the real HOME_PUBLIC_FALLBACKS + HOME_PUBLIC_LABELS blocks
//      verbatim from studio.html and exercise them, so the tests run
//      against the shipped source, not a copy;
//   2. extract the HOME_LANGUAGE_FIREWALL block and prove every fallback,
//      and a representative visitor render assembled from them, passes; and
//   3. statically assert the render wiring uses the fallbacks and that the
//      internal source data / builder scaffolding is left intact.
//
// Run: node tests/home-public-fallbacks.test.mjs

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

// ── Load the fallback + label + firewall blocks verbatim ────────────
const { PH_PUBLIC_FALLBACKS } = new Function(
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>', '// <HOME_PUBLIC_FALLBACKS_END>') +
  '\nreturn { PH_PUBLIC_FALLBACKS };'
)();

const { phPublicRoomLabel, phPublicRoomEyebrow } = new Function(
  extractBlock('// <HOME_PUBLIC_LABELS_START>', '// <HOME_PUBLIC_LABELS_END>') +
  '\nreturn { phPublicRoomLabel, phPublicRoomEyebrow };'
)();

const { validatePublicHomeLanguage: validate } = new Function(
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>', '// <HOME_LANGUAGE_FIREWALL_END>') +
  '\nreturn { validatePublicHomeLanguage };'
)();

const DIMS = ['work', 'lens', 'field', 'call'];

console.log('hOMe public fallback prose tests');

// ── Every fallback string exists and is non-empty ───────────────────
test('all expected visitor-facing fallbacks are present and non-empty', () => {
  for (const key of ['heroIntro', 'roomEmpty', 'invitationEmpty', 'doorwayBlurb']) {
    assert.equal(typeof PH_PUBLIC_FALLBACKS[key], 'string');
    assert.ok(PH_PUBLIC_FALLBACKS[key].trim().length > 0, key + ' must be non-empty');
  }
});

// ── No banned internal term appears in any fallback ─────────────────
test('no fallback prose mentions internal method / source scaffolding', () => {
  const banned = /\b(Compass|Living Profile|Nexus|Field Observations?|Sparks?|OM[\s-]?Cipher)\b/i;
  for (const [key, value] of Object.entries(PH_PUBLIC_FALLBACKS)) {
    assert.ok(!banned.test(value),
      'fallback "' + key + '" leaks an internal term: ' + value);
    // the old "source material" / "awaiting source" system phrasing is gone
    assert.ok(!/\bsource\b/i.test(value),
      'fallback "' + key + '" still uses system "source" phrasing: ' + value);
  }
});

// ── Each fallback passes the shipped language firewall ──────────────
test('language firewall is clean on every fallback string', () => {
  for (const [key, value] of Object.entries(PH_PUBLIC_FALLBACKS)) {
    const r = validate(value);
    assert.equal(r.ok, true,
      'fallback "' + key + '" flagged by firewall: ' + JSON.stringify(r.violations));
  }
});

// ── A representative EMPTY public render passes the firewall (req #5) ─
// Assemble exactly the visitor-facing strings the render emits for a
// person who has written nothing yet: warm labels + eyebrows (PR #146)
// plus the fallback prose. This is the worst case for leakage.
test('representative empty visitor render passes the language firewall', () => {
  const model = {
    name: 'Mara Ellison',
    heroIntro: PH_PUBLIC_FALLBACKS.heroIntro,
    invitation: PH_PUBLIC_FALLBACKS.invitationEmpty,
    tabs: DIMS.map((key) => phPublicRoomLabel(key)),
    sections: DIMS.map((key) => ({
      label:    phPublicRoomLabel(key),
      eyebrow:  phPublicRoomEyebrow(key),
      heading:  phPublicRoomLabel(key),
      body:     PH_PUBLIC_FALLBACKS.roomEmpty,
      doorway:  PH_PUBLIC_FALLBACKS.doorwayBlurb
    }))
  };
  const r = validate(model);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  assert.deepEqual(r.violations, []);
});

// ── Internal source data does not leak through the public render ─────
// The internal engine tags each section with a `source` ('compass',
// 'captured', etc.) and the builder tune form references Field
// Observations. Those live on the model / builder chrome, NOT on the
// visitor-facing fields — so the public render helpers stay clean even
// when the internal source data is present.
test('internal source data can stay on the model without public leakage', () => {
  const publicView = DIMS.map((key) => ({
    label:   phPublicRoomLabel(key, { source: 'compass' }),
    eyebrow: phPublicRoomEyebrow(key, { source: 'compass' }),
    heading: phPublicRoomLabel(key, { source: 'compass' }),
    body:    PH_PUBLIC_FALLBACKS.roomEmpty
  }));
  const r = validate(publicView);
  assert.equal(r.ok, true, JSON.stringify(r.violations));

  // Sanity: the firewall WOULD catch the internal term if it leaked into
  // a visitor-facing field — proving the guard is real, not vacuous.
  const leaked = validate({ heading: 'Sourced from your Compass' });
  assert.equal(leaked.ok, false);
});

console.log('\nStatic wiring + preserved-internal assertions');

// ── The render reads the fallback prose (not the old leaky strings) ──
test('phRenderThreshold hero intro falls back to PH_PUBLIC_FALLBACKS.heroIntro', () => {
  assert.match(html, /hero\.intro\s*\|\|\s*PH_PUBLIC_FALLBACKS\.heroIntro/);
});

test('room + invitation empty states use the public fallbacks', () => {
  assert.match(html, /lp-empty">'\s*\+\s*lpEscape\(PH_PUBLIC_FALLBACKS\.roomEmpty\)/);
  assert.match(html, /lp-empty">'\s*\+\s*lpEscape\(PH_PUBLIC_FALLBACKS\.invitationEmpty\)/);
});

test('doorway blurb falls back to PH_PUBLIC_FALLBACKS.doorwayBlurb', () => {
  assert.match(html, /PH_PUBLIC_FALLBACKS\.doorwayBlurb/);
});

// ── The old leaky visitor strings are gone from the hOMe render ─────
// Scope to the public hOMe render region only — the same phrasing is used
// elsewhere (e.g. Living Profile), which is a separate surface.
test('the old internal-leaking fallback strings are removed from the hOMe render', () => {
  const homeRender = html.slice(
    html.indexOf('function phRenderRoom(model, key)'),
    html.indexOf('wpBody.innerHTML = html;')
  );
  assert.ok(homeRender.length > 0, 'hOMe render region should be found');
  assert.doesNotMatch(homeRender, /Compass points you here/);
  assert.doesNotMatch(homeRender, /Not enough source material yet/);
  assert.doesNotMatch(homeRender, /Awaiting source/);
});

// ── The visitor room nav uses warm public labels, not the taxonomy ──
test('room navigation tabs use phPublicRoomLabel, not fixed taxonomy', () => {
  assert.match(html,
    /label\s*=\s*t\.key === 'home'\s*\?\s*'Home'\s*:\s*phPublicRoomLabel\(t\.key, model\.sections\[t\.key\]\)/);
  // the hardcoded taxonomy nav labels are gone from the tab array
  assert.doesNotMatch(html, /\{ key: 'work',\s*label: 'The Work'/);
});

// ── Builder scaffolding still references its source systems (req #3) ─
test('seeded-field readiness band still names Compass / Living Profile / Spark / Field Observations', () => {
  const band = extractBlock('function phRenderSeedReadiness', 'function phRenderThreshold');
  assert.match(band, /Compass/);
  assert.match(band, /Living Profile/);
  assert.match(band, /Studio Spark/);
  assert.match(band, /Field Observations/);
});

test('internal FOURFOLD builder standard still names the four dimensions', () => {
  assert.match(html, /var FOURFOLD = \{[^]*?work:\s*\{\s*name:\s*'The Work'/);
});

console.log('\n' + passed + ' checks passed.');
