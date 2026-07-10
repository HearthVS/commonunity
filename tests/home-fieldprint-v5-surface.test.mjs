// Fieldprint v5 surface — proves the approved v5 full-bleed field is the
// PRIMARY "Open Fieldprint" experience (served at /fieldprint, embedded in
// studio.html as a same-origin iframe fed a privacy-scrubbed model), and that
// the old Workbench modal is no longer the visible frame.
//
// These are source-contract string assertions across the four files that make
// up the surface (fieldprint.html/.css/.js + the studio.html adapter +
// server.py routes). The runtime behaviour is exercised separately by the
// Playwright visual QA; this file locks the wiring so it cannot silently
// regress to the old dashboard.
//
// Run: node tests/home-fieldprint-v5-surface.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const studio = readFileSync(join(root, 'studio.html'), 'utf8');
const fpHtml = readFileSync(join(root, 'fieldprint.html'), 'utf8');
const fpCss = readFileSync(join(root, 'fieldprint.css'), 'utf8');
const fpJs = readFileSync(join(root, 'fieldprint.js'), 'utf8');
const server = readFileSync(join(root, 'server.py'), 'utf8');

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log('  ok - ' + name); }

console.log('Fieldprint · v5 surface (primary field experience / rooms / adapter / privacy)');

// ── The v5 surface files exist and are the field experience, not a dashboard ──
test('fieldprint.html is a full-bleed field with a narrow dark control rail', () => {
  // Shell: dark control rail (aside.panel) + full-bleed stage (main.stage).
  assert.match(fpHtml, /<aside class="panel" id="panel"/);
  assert.match(fpHtml, /<main class="stage"/);
  // The living field layers (torus weave + torus + grain) — not cards.
  assert.match(fpHtml, /id="fieldWeave"/);
  assert.match(fpHtml, /id="fieldTorus"/);
  assert.match(fpHtml, /class="viz-fieldbg"/);
  // Oversized editorial serif identity at the threshold.
  assert.match(fpHtml, /class="viz-title" id="vizName"/);
  // A room destination host exists (overview → room detail).
  assert.match(fpHtml, /class="viz-room" id="vizRoom"/);
});

test('fieldprint.html carries the required rail controls', () => {
  assert.match(fpHtml, /Load Field JSON/);
  assert.match(fpHtml, /id="loadJsonBtn"/);
  assert.match(fpHtml, /id="loadJsonInput"/);
  // Cipher texture modes off/subtle/inside-crop/wallpaper.
  assert.match(fpHtml, /data-control="texture"/);
  assert.match(fpHtml, /data-value="off"[^>]*>Off</);
  assert.match(fpHtml, /data-value="inside"[^>]*>Inside-crop</);
  assert.match(fpHtml, /data-value="wallpaper"[^>]*>Wallpaper</);
  // Zoom + opacity adjustments.
  assert.match(fpHtml, /id="cipherZoom"/);
  assert.match(fpHtml, /id="cipherOpacity"/);
  // Transition none/fade/threshold.
  assert.match(fpHtml, /data-control="transition"/);
  // Palette + public preview.
  assert.match(fpHtml, /data-control="palette"/);
  assert.match(fpHtml, /id="publicPreviewBtn"[^>]*>Preview public hOMepage</);
});

test('fieldprint.html runs NO cipher engine / vendor scripts (privacy seam)', () => {
  // The child frame must not load the OM Cipher engine or any vendor script;
  // it only receives a scrubbed model. Only /fieldprint.js is referenced.
  assert.doesNotMatch(fpHtml, /om_cipher/i);
  assert.doesNotMatch(fpHtml, /compass_cipher/i);
  assert.doesNotMatch(fpHtml, /vendor\//);
  const scripts = fpHtml.match(/<script\b[^>]*src=/g) || [];
  assert.equal(scripts.length, 1, 'exactly one script (fieldprint.js) expected');
  assert.match(fpHtml, /<script src="\/fieldprint\.js">/);
});

// ── Four rooms + overview → detail navigation with continuous field ──────────
test('fieldprint.js defines four rooms and enter/exit/goto navigation', () => {
  assert.match(fpJs, /SECTION_KEYS = \['make', 'perceive', 'alive', 'here'\]/);
  assert.match(fpJs, /function enterRoom\(/);
  assert.match(fpJs, /function exitRoom\(/);
  assert.match(fpJs, /function gotoRoom\(/);
  assert.match(fpJs, /function renderRoom\(/);
});

test('room detail exposes Back + Previous + Next travel', () => {
  assert.match(fpJs, /Back to the field/);
  assert.match(fpJs, /room__nav-btn--prev/);
  assert.match(fpJs, /room__nav-btn--next/);
  assert.match(fpJs, /Previous/);
  assert.match(fpJs, /Next/);
});

test('the field background is continuous (rooms overlay it, never replace it)', () => {
  // The stage keeps .viz-fieldbg mounted; rooms open via a body/hero swap class.
  assert.match(fpJs, /is-room-open/);
  // CSS proves the field layer persists while a room is open (hero/body hidden,
  // room shown) rather than a card-stack teardown.
  assert.match(fpCss, /\.viz\.is-room-open .viz-hero/);
  assert.match(fpCss, /\.viz-room/);
});

test('inside-crop zoom exceeds 300% (travel within one Cipher, never whole art)', () => {
  // Default manual zoom + slider range prove the inside-crop magnification.
  assert.match(fpJs, /manualZoom = 420/);
  assert.match(fpHtml, /id="cipherZoom"[^>]*min="120"[^>]*max="800"/);
});

// ── Reduced motion honoured ──────────────────────────────────────────────────
test('reduced motion is respected on the v5 surface', () => {
  assert.match(fpJs, /prefers-reduced-motion/);
  assert.match(fpCss, /prefers-reduced-motion/);
});

// ── Privacy: only a sanitized model crosses the seam ────────────────────────
test('fieldprint.js re-validates images: private + unsafe src are dropped', () => {
  assert.match(fpJs, /function sanitizeImage\(/);
  assert.match(fpJs, /if \(img\.visibility === 'private'\) return null/);
  assert.match(fpJs, /function safeMediaSrc\(/);
  // Only data:image or https srcs survive.
  assert.match(fpJs, /\^data:image\\\/\(png\|jpe\?g\|webp\|gif\|svg/);
});

test('fieldprint.js scrubs any cipher svg it receives before painting', () => {
  assert.match(fpJs, /scrubSvg\(/);
  assert.match(fpJs, /function hydrateFromModel\(/);
});

test('the postMessage bridge validates source + origin (no cross-frame leak)', () => {
  assert.match(fpJs, /if \(e\.source !== window\.parent\) return/);
  assert.match(fpJs, /if \(e\.origin !== window\.location\.origin\) return/);
  assert.match(fpJs, /window\.parent\.postMessage\(msg, window\.location\.origin\)/);
});

// ── studio.html: v5 is the PRIMARY Open Fieldprint surface ───────────────────
test('studio.html embeds the v5 surface as a same-origin iframe overlay', () => {
  assert.match(studio, /id="fieldprint-v5-overlay"/);
  assert.match(studio, /id="fieldprint-v5-frame"/);
  assert.match(studio, /function openFieldprintV5\(/);
  assert.match(studio, /function closeFieldprintV5\(/);
  // The frame loads /fieldprint (the served surface), not inline markup.
  assert.match(studio, /setAttribute\('src', '\/fieldprint'\)/);
});

test('the entrance button opens Fieldprint v5, not the old Workbench modal', () => {
  const idx = studio.indexOf("getElementById('home-workbench-open-entrance')");
  assert.ok(idx !== -1, 'entry button wiring must exist');
  const body = studio.slice(idx, idx + 220);
  assert.match(body, /openFieldprintV5\(\)/);
  assert.doesNotMatch(body, /openHomeWorkbench\(\)/);
});

test('the adapter feeds ONLY the privacy-firewalled model to the iframe', () => {
  // The model is built through the existing firewall, never raw state.
  assert.match(studio, /phPublicHomeModel\(buildWebsitePreview\(\)\)/);
  assert.match(studio, /type: 'fieldprint-model', model: model/);
  // Incoming import is normalized through the same firewall, raw never re-sent.
  assert.match(studio, /phWorkbenchImportFieldJson\(parsed\)/);
});

test('the studio adapter only trusts messages from its own frame + origin', () => {
  const idx = studio.indexOf('function phV5WireBridge');
  assert.ok(idx !== -1);
  const body = studio.slice(idx, idx + 1200);
  assert.match(body, /if \(e\.origin !== window\.location\.origin\) return/);
  assert.match(body, /if \(!frame \|\| e\.source !== frame\.contentWindow\) return/);
  assert.match(body, /d\.type === 'fieldprint-ready'/);
  assert.match(body, /d\.type === 'fieldprint-import-json'/);
});

test('the old Workbench remains only as an internal fallback', () => {
  // openHomeWorkbench still exists (fallback) but the primary route prefers v5.
  assert.match(studio, /function openHomeWorkbench\(/);
  const idx = studio.indexOf('function openFieldprintV5');
  const body = studio.slice(idx, idx + 900);
  assert.match(body, /openHomeWorkbench\(\); return;/); // fallback when overlay missing
});

// ── server.py routes ────────────────────────────────────────────────────────
test('server.py serves the v5 surface under the studio beta gate', () => {
  assert.match(server, /@app\.get\("\/fieldprint"\)/);
  assert.match(server, /@app\.get\("\/fieldprint\.css"\)/);
  assert.match(server, /@app\.get\("\/fieldprint\.js"\)/);
  assert.match(server, /_serve_private_file\(request, "studio", pathlib\.Path\(__file__\)\.parent \/ "fieldprint\.html"\)/);
  assert.match(server, /media_type="text\/css"/);
  assert.match(server, /media_type="application\/javascript"/);
});

console.log('\n' + passed + ' checks passed.');
