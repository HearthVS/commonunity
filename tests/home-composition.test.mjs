// Tests for the visitor composition overlay — the small, user-chosen
// presentation layer (HOME_COMPOSITION) that sits on top of the derived
// visual identity. This slice locks in:
//
//   1. phResolveComposition: migration-safe defaults, named-mode presets,
//      per-field override precedence, and rejection of invalid values.
//   2. phPublicHomeModel attaches a resolved `composition` to the model.
//   3. phRenderPublicHome emits data-* composition hooks ONLY for fields the
//      person set — so the all-'auto' default render is byte-for-byte
//      unchanged (backward compatible) — and a set density overrides the
//      derived density.
//   4. The composition never leaks internal language: a composed model still
//      passes validatePublicHomeLanguage().
//   5. The scoped .phpub CSS keys real layout off the composition hooks.
//
// Like the sibling home-*.test.mjs, we extract the shipped source blocks
// verbatim (guarded by sentinels) and exercise them in the builder scope.
//
// Run: node tests/home-composition.test.mjs

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

const {
  phDefaultComposition,
  phResolveComposition,
  phPublicHomeModel,
  phRenderPublicHome,
  validatePublicHomeLanguage
} = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',            '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>',       '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',           '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',        '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_VISUAL_IDENTITY_START>',  '// <HOME_PUBLIC_VISUAL_IDENTITY_END>') +
  extractBlock('// <HOME_COMPOSITION_START>',             '// <HOME_COMPOSITION_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',            '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',           '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phDefaultComposition, phResolveComposition, phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage };'
)();

console.log('hOMe composition overlay unit tests');

// ── (1) phResolveComposition ────────────────────────────────────────

test('default composition is all-auto (backward-compatible neutral)', () => {
  const d = phDefaultComposition();
  ['mode', 'paletteMode', 'accentIntensity', 'heroLayout', 'sectionRhythm', 'density', 'imageTreatment']
    .forEach((k) => assert.equal(d[k], 'auto', k + ' defaults to auto'));
});

test('resolving null / garbage yields the all-auto default', () => {
  [null, undefined, 42, 'x', {}].forEach((v) => {
    const r = phResolveComposition(v);
    assert.equal(r.mode, 'auto');
    assert.equal(r.paletteMode, 'auto');
    assert.equal(r.heroLayout, 'auto');
  });
});

test('a named mode seeds its concrete field preset', () => {
  const r = phResolveComposition({ mode: 'cinematic-profile' });
  assert.equal(r.mode, 'cinematic-profile');
  assert.equal(r.paletteMode, 'dark-contrast');
  assert.equal(r.heroLayout, 'portrait-forward');
  assert.equal(r.accentIntensity, 'bold');
  assert.equal(r.imageTreatment, 'full-bleed');

  const e = phResolveComposition({ mode: 'editorial-about' });
  assert.equal(e.paletteMode, 'warm-field');
  assert.equal(e.heroLayout, 'centered');
  assert.equal(e.sectionRhythm, 'editorial');

  const a = phResolveComposition({ mode: 'purpose-advisory' });
  assert.equal(a.paletteMode, 'clear-spacious');
  assert.equal(a.heroLayout, 'purpose-led');
  assert.equal(a.sectionRhythm, 'spacious');
});

test('explicit per-field override wins over the mode preset', () => {
  const r = phResolveComposition({ mode: 'cinematic-profile', accentIntensity: 'soft' });
  assert.equal(r.accentIntensity, 'soft');       // override wins
  assert.equal(r.paletteMode, 'dark-contrast');  // rest of preset intact
});

test("a stored 'auto' field never clobbers a mode's concrete choice", () => {
  const r = phResolveComposition({ mode: 'editorial-about', paletteMode: 'auto' });
  assert.equal(r.paletteMode, 'warm-field');
});

test('invalid mode / field values are rejected (fall back to auto/preset)', () => {
  const r = phResolveComposition({ mode: 'nope', heroLayout: 'sideways' });
  assert.equal(r.mode, 'auto');
  assert.equal(r.heroLayout, 'auto');
});

// ── (2) model attaches composition ──────────────────────────────────

test('phPublicHomeModel attaches a resolved composition', () => {
  const model = phPublicHomeModel({ name: 'Ada', composition: { mode: 'cinematic-profile' } });
  assert.ok(model.composition && typeof model.composition === 'object');
  assert.equal(model.composition.mode, 'cinematic-profile');
  assert.equal(model.composition.paletteMode, 'dark-contrast');
});

test('no composition input → resolved all-auto (default preserved)', () => {
  const model = phPublicHomeModel({ name: 'Ada' });
  assert.ok(model.composition);
  assert.equal(model.composition.mode, 'auto');
});

// ── (3) render emits hooks only for set fields ──────────────────────

function rootOf(out) { return out.match(/<div class="phpub"[^>]*>/)[0]; }

test('all-auto composition emits NO composition data-* hooks (backward compat)', () => {
  const model = phPublicHomeModel({ name: 'Ada' });
  const root = rootOf(phRenderPublicHome(model));
  assert.doesNotMatch(root, /data-composition=/);
  assert.doesNotMatch(root, /data-palette-mode=/);
  assert.doesNotMatch(root, /data-hero-layout=/);
  assert.doesNotMatch(root, /data-rhythm=/);
  assert.doesNotMatch(root, /data-image-treatment=/);
  assert.doesNotMatch(root, /data-accent-intensity=/);
});

test('a chosen mode emits the composition data-* hooks on the root', () => {
  const model = phPublicHomeModel({ name: 'Ada', composition: { mode: 'cinematic-profile' } });
  const root = rootOf(phRenderPublicHome(model));
  assert.match(root, /data-composition="cinematic-profile"/);
  assert.match(root, /data-palette-mode="dark-contrast"/);
  assert.match(root, /data-hero-layout="portrait-forward"/);
  assert.match(root, /data-accent-intensity="bold"/);
  assert.match(root, /data-image-treatment="full-bleed"/);
});

test('composition density overrides the derived data-density', () => {
  const model = phPublicHomeModel({ name: 'Ada', composition: { mode: 'auto', density: 'rich' } });
  const root = rootOf(phRenderPublicHome(model));
  assert.match(root, /data-density="rich"/);
  // still no other composition hooks, since only density was set
  assert.doesNotMatch(root, /data-composition=/);
});

test('class stays exactly "phpub" (unchanged root class contract)', () => {
  const model = phPublicHomeModel({ name: 'Ada', composition: { mode: 'editorial-about' } });
  const out = phRenderPublicHome(model);
  assert.match(out, /<div class="phpub" /);
});

// ── (4) firewall stays clean under composition ──────────────────────

test('a composed model still passes the public language firewall', () => {
  const model = phPublicHomeModel({
    name: 'Ada',
    composition: { mode: 'cinematic-profile' }
  });
  assert.ok(model.language);
  assert.deepEqual(model.language.violations, []);
  // Composition words never surface internal system names in the render.
  const out = phRenderPublicHome(model);
  assert.doesNotMatch(out, /OM Cipher|Compass|Nexus|Living Profile|Field Observation|Gene Key/i);
});

// ── (5) CSS keys real layout off the hooks ──────────────────────────

test('scoped .phpub CSS keys layout off the composition hooks', () => {
  assert.match(html, /\.phpub\[data-palette-mode="dark-contrast"\]/);
  assert.match(html, /\.phpub\[data-palette-mode="warm-field"\]/);
  assert.match(html, /\.phpub\[data-palette-mode="clear-spacious"\]/);
  assert.match(html, /\.phpub\[data-hero-layout="centered"\]/);
  assert.match(html, /\.phpub\[data-hero-layout="purpose-led"\]/);
  assert.match(html, /\.phpub\[data-rhythm="spacious"\]/);
  assert.match(html, /\.phpub\[data-accent-intensity="bold"\]/);
  assert.match(html, /\.phpub\[data-image-treatment="full-bleed"\]/);
});

console.log('\n' + passed + ' checks passed.');
