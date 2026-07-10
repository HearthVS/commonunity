// Fieldprint controls — proves the P0 bridge that promoted the builder to
// "Fieldprint" and its output to the "public hOMepage".
//
// Two layers, matching the sibling home-*.test.mjs:
//   1. Pure-function tests — the shipped model/render/cipher/image/composition
//      code is extracted verbatim from the sentinel blocks in studio.html and
//      exercised exactly as it runs in the builder scope (no jsdom; studio.html
//      is a single ~1.3MB app).
//   2. Source-contract string assertions — user-facing naming + the builder
//      control markup that lives in DOM code that can't be eval'd in isolation.
//
// Run: node tests/home-fieldprint-controls.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'studio.html'), 'utf8');

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log('  ok - ' + name); }

function extractBlock(startSentinel, endSentinel) {
  const startIdx = html.indexOf(startSentinel);
  const endIdx = html.indexOf(endSentinel);
  assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    'sentinel block must exist: ' + startSentinel);
  const bodyStart = html.indexOf('\n', startIdx) + 1;
  return html.slice(bodyStart, endIdx);
}

const {
  phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage,
  phPublicCipherField, phResolveCipherControls, phPublicRoomImage, phResolveComposition
} = new Function(
  extractBlock('// <HOME_SOURCE_SEEDS_START>',          '// <HOME_SOURCE_SEEDS_END>') +
  extractBlock('// <HOME_LANGUAGE_FIREWALL_START>',     '// <HOME_LANGUAGE_FIREWALL_END>') +
  extractBlock('// <HOME_PUBLIC_LABELS_START>',         '// <HOME_PUBLIC_LABELS_END>') +
  extractBlock('// <HOME_PUBLIC_FALLBACKS_START>',      '// <HOME_PUBLIC_FALLBACKS_END>') +
  extractBlock('// <HOME_PUBLIC_VISUAL_IDENTITY_START>','// <HOME_PUBLIC_VISUAL_IDENTITY_END>') +
  extractBlock('// <HOME_COMPOSITION_START>',           '// <HOME_COMPOSITION_END>') +
  extractBlock('// <HOME_PUBLIC_MODEL_START>',          '// <HOME_PUBLIC_MODEL_END>') +
  extractBlock('// <HOME_PUBLIC_RENDER_START>',         '// <HOME_PUBLIC_RENDER_END>') +
  '\nreturn { phPublicHomeModel, phRenderPublicHome, validatePublicHomeLanguage,' +
  ' phPublicCipherField, phResolveCipherControls, phPublicRoomImage, phResolveComposition };'
)();

console.log('Fieldprint · controls (cipher / palette / density / transition / images / privacy)');

// A base preview object shaped like buildWebsitePreview()'s output.
function basePreview(extra) {
  return Object.assign({
    name: 'Ronan Vale',
    sections: {
      hero:  { heading: 'Instruments for attention', intro: 'A small home for careful tools.', source: 'compass' },
      work:  { heading: 'Instruments for attention', intro: 'I build small tools.', highlights: ['Notebooks'],
               summary: 'Maker.', insights: ['Craft over scale'], source: 'compass' },
      lens:  { heading: '', intro: 'Pattern and pause.', source: 'compass' },
      field: { heading: '', intro: 'Coast and company.', source: 'compass' },
      call:  { heading: '', intro: 'Leave the field legible.', source: 'empty' },
      invitation: { body: 'Come by.', contact: [], source: 'compass' }
    },
    cipher: { svg: '<svg viewBox="0 0 10 10"><path d="M0 0h4v4H0z"/></svg>', hue: 200, palette: ['#123456', '#abcdef'] }
  }, extra || {});
}

// ── Cipher texture controls ─────────────────────────────────────────
test('phResolveCipherControls defaults to inside/medium and clamps ranges', () => {
  const d = phResolveCipherControls(undefined);
  assert.equal(d.mode, 'inside');
  assert.equal(d.intensity, 'medium');
  assert.equal(d.scale, null);          // absent → deterministic
  const c = phResolveCipherControls({ mode: 'wallpaper', intensity: 'bold', scale: 9999, x: -20, y: 200, opacity: 5 });
  assert.equal(c.mode, 'wallpaper');
  assert.equal(c.intensity, 'bold');
  assert.equal(c.scale, 800);           // clamped to max
  assert.equal(c.x, 0);                 // clamped to min
  assert.equal(c.y, 100);               // clamped to max
  assert.equal(c.opacity, 1);           // clamped to max
});

test('cipher mode "off" suppresses the field entirely (returns null)', () => {
  const out = phPublicCipherField(basePreview({ cipherControls: { mode: 'off' } }));
  assert.equal(out, null);
});

test('cipher control x/y/scale override the deterministic crop', () => {
  const withCtrl = phPublicCipherField(basePreview({ cipherControls: { x: 12, y: 34, scale: 456 } }));
  assert.ok(withCtrl && withCtrl.present);
  assert.equal(withCtrl.crop.x, 12);
  assert.equal(withCtrl.crop.y, 34);
  assert.equal(withCtrl.crop.scale, 456);
  // Without controls the crop is deterministic (not the user values).
  const noCtrl = phPublicCipherField(basePreview());
  assert.notEqual(noCtrl.crop.scale, 456);
});

test('render emits data-cipher-mode + data-cipher-intensity + opacity var', () => {
  const out = phRenderPublicHome(phPublicHomeModel(
    basePreview({ cipherControls: { mode: 'wallpaper', intensity: 'bold', opacity: 0.4 } })));
  assert.match(out, /data-cipher-mode="wallpaper"/);
  assert.match(out, /data-cipher-intensity="bold"/);
  assert.match(out, /--phpub-cipher-opacity:0\.4/);
});

test('cipher mode "subtle" renders a palette-only weave (no svg background-image)', () => {
  const out = phRenderPublicHome(phPublicHomeModel(
    basePreview({ cipherControls: { mode: 'subtle' } })));
  assert.match(out, /data-cipher-mode="subtle"/);
  assert.match(out, /phpub-cipher-weave" data-mode="subtle"/);
  // The subtle wash never paints the mark texture.
  assert.doesNotMatch(out, /data-mode="subtle" style="background-image/);
});

// ── Palette apply + intensity ───────────────────────────────────────
test('palette intensity flows into the model and the render hook', () => {
  const model = phPublicHomeModel(basePreview({ paletteIntensity: 'bold' }));
  assert.equal(model.paletteIntensity, 'bold');
  assert.match(phRenderPublicHome(model), /data-palette-intensity="bold"/);
});

test('palette intensity default "auto" emits no data-palette-intensity attribute', () => {
  const out = phRenderPublicHome(phPublicHomeModel(basePreview()));
  assert.doesNotMatch(out, /data-palette-intensity=/);
});

// ── Density taxonomy (minimal/editorial/immersive) + migration ──────
test('new density modes map to legacy scale and emit data-density-mode', () => {
  const comp = phResolveComposition({ density: 'minimal' });
  assert.equal(comp.densityMode, 'minimal');
  assert.equal(comp.density, 'sparse');   // migrated to legacy for existing CSS
  const out = phRenderPublicHome(phPublicHomeModel(
    basePreview({ composition: { density: 'immersive' } })));
  assert.match(out, /data-density-mode="immersive"/);
});

test('legacy density values migrate forward to the new mode vocabulary', () => {
  const comp = phResolveComposition({ density: 'rich' });
  assert.equal(comp.density, 'rich');        // legacy preserved
  assert.equal(comp.densityMode, 'immersive'); // new vocab derived
});

// ── Transition selector (none/fade/threshold) ───────────────────────
test('transition defaults to threshold and honours none/fade', () => {
  assert.equal(phPublicHomeModel(basePreview()).transition, 'threshold');
  assert.equal(phPublicHomeModel(basePreview({ transition: 'none' })).transition, 'none');
  const out = phRenderPublicHome(phPublicHomeModel(basePreview({ transition: 'fade' })));
  assert.match(out, /data-transition="fade"/);
});

// ── Image roles + explicit public/private status ────────────────────
test('phPublicRoomImage accepts the new artifact and hero roles', () => {
  assert.equal(phPublicRoomImage({ src: 'https://cdn.example/a.jpg', role: 'artifact' }).role, 'artifact');
  assert.equal(phPublicRoomImage({ src: 'https://cdn.example/h.jpg', role: 'hero' }).role, 'hero');
});

test('a private image never reaches the public renderer', () => {
  const priv = phPublicRoomImage({ src: 'https://cdn.example/secret.jpg', role: 'hero', visibility: 'private' });
  assert.equal(priv, null);
  // End to end: a private section image must not appear in the visitor HTML.
  const input = basePreview();
  input.sections.work.image = { src: 'https://cdn.example/secret.jpg', role: 'full-bleed', alt: 'do not show', visibility: 'private' };
  input.sections.lens.image = { src: 'https://cdn.example/public.jpg', role: 'inset', alt: 'shown', visibility: 'public' };
  const out = phRenderPublicHome(phPublicHomeModel(input));
  assert.doesNotMatch(out, /secret\.jpg/);
  assert.doesNotMatch(out, /do not show/);
  assert.match(out, /public\.jpg/);        // public image still renders
});

test('focal point / opacity / blend flow through to the rendered figure', () => {
  const input = basePreview();
  input.sections.work.image = { src: 'https://cdn.example/w.jpg', role: 'full-bleed', alt: 'Bench',
                                focalX: 30, focalY: 70, opacity: 0.6, blend: 'multiply' };
  const out = phRenderPublicHome(phPublicHomeModel(input));
  assert.match(out, /object-position:30% 70%/);
  assert.match(out, /opacity:0\.6/);
  assert.match(out, /mix-blend-mode:multiply/);
  assert.match(out, /alt="Bench"/);
});

test('an unsafe image src is dropped (no markup injection)', () => {
  assert.equal(phPublicRoomImage({ src: 'javascript:alert(1)', role: 'inset' }), null);
});

// ── Reduced motion + continuous background preserved ────────────────
test('continuous Cipher background + reduced-motion support are preserved', () => {
  const out = phRenderPublicHome(phPublicHomeModel(basePreview()));
  assert.match(out, /class="phpub-fieldbg"/);
  assert.match(out, /data-has-cipher="true"/);
  assert.match(html, /prefers-reduced-motion/);
});

// ── Privacy firewall still holds over the new surfaces ──────────────
test('the model + rendered output pass the language firewall', () => {
  const model = phPublicHomeModel(basePreview({ cipherControls: { mode: 'wallpaper' }, transition: 'fade' }));
  assert.equal(model.language.ok, true, JSON.stringify(model.language && model.language.violations));
  assert.equal(validatePublicHomeLanguage(phRenderPublicHome(model)).ok, true);
});

// ── Source-contract: user-facing naming (Fieldprint / public hOMepage) ──
test('the builder frame is named Fieldprint (not Workbench) in user copy', () => {
  assert.match(html, /Your <em>Fieldprint<\/em> in the making/);
  assert.match(html, /class="hw-topbar-eyebrow">Fieldprint</);
  assert.match(html, /Create your Fieldprint\. Publish it as your public hOMepage\./);
  assert.match(html, />\s*Open Fieldprint\s*</);
});

test('user-facing "Workbench" and "visitor" preview/view wording is retired', () => {
  // Internal element ids (home-workbench-*), function names (phWorkbench*) and
  // developer comments may keep the old vocabulary; only user-VISIBLE label
  // text (between tags / as a JS-assigned label) must be gone. We strip HTML
  // comments and JS line comments before scanning so a comment never trips us.
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, '')        // HTML comments
    .replace(/^[ \t]*\/\/.*$/gm, '')        // whole-line JS comments
    .replace(/\/\*[\s\S]*?\*\//g, '');      // block comments
  assert.doesNotMatch(visible, />\s*Open hOMe Workbench\s*</);
  assert.doesNotMatch(visible, />\s*Preview as visitor\s*</);
  assert.doesNotMatch(visible, />\s*Back to builder view\s*</);
  // The label a JS toggle assigns must also be the new wording.
  assert.doesNotMatch(visible, /textContent\s*=\s*[^;]*Preview as visitor/);
});

test('required public-hOMepage labels + flows are present', () => {
  assert.match(html, /Load Field JSON/);
  assert.match(html, /Preview public hOMepage/);
  assert.match(html, /Open public hOMepage/);
  assert.match(html, /Publish hOMepage/);
  assert.match(html, /Return to Fieldprint/);
  assert.match(html, /Edit Fieldprint/);
});

// ── Source-contract: builder control markup + wiring ────────────────
test('Fieldprint exposes visible Cipher / Palette / Density / Privacy control hosts', () => {
  assert.match(html, /id="home-workbench-cipher"/);
  assert.match(html, /id="home-workbench-palette"/);
  assert.match(html, /id="home-workbench-density"/);
  assert.match(html, /id="home-workbench-privacy"/);
});

test('Cipher panel renders mode buttons + scale/x/y/opacity adjustments', () => {
  assert.match(html, /data-hw-cipher-mode/);
  assert.match(html, /id="hw-cipher-scale"/);
  assert.match(html, /\['hw-cipher-scale', 'scale'\], \['hw-cipher-x', 'x'\], \['hw-cipher-y', 'y'\], \['hw-cipher-opacity', 'opacity'\]/);
  assert.match(html, /PH_CIPHER_MODES\s*=\s*\['off', 'subtle', 'inside', 'wallpaper'\]/);
});

test('Palette panel exposes an apply control + intensity choices', () => {
  assert.match(html, /id="home-workbench-palette-apply"/);
  assert.match(html, /data-hw-palette-intensity/);
});

test('Density + Transition panel exposes both selectors', () => {
  assert.match(html, /data-hw-density/);
  assert.match(html, /data-hw-transition/);
});

test('section image editor exposes an explicit public/private status select', () => {
  assert.match(html, /id="hw-section-image-visibility"/);
  assert.match(html, /never published/i);
});

test('Publish + Open live buttons are wired to the privacy-gated handoff', () => {
  assert.match(html, /id="home-workbench-publish"/);
  assert.match(html, /id="home-workbench-open-live"/);
  assert.match(html, /function phPublishHome/);
  // Publish is gated by the privacy review before it records readiness.
  const idx = html.indexOf('function phPublishHome');
  const body = html.slice(idx, idx + 900);
  assert.match(body, /phWorkbenchPrivacyReport\(\)/);
  assert.match(body, /if \(!r\.languageOk \|\| r\.violations\.length\)/);
  assert.match(body, /return false/);
});

test('privacy report counts withheld fields + public/private images', () => {
  const idx = html.indexOf('function phWorkbenchPrivacyReport');
  assert.ok(idx !== -1);
  const body = html.slice(idx, idx + 1400);
  assert.match(body, /withheldFields/);
  assert.match(body, /privateImages/);
  assert.match(body, /publicImages/);
});

console.log('\n' + passed + ' checks passed.');
