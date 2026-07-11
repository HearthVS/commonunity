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

// ── Production correction: portrait vs Cipher, toolbar, full-bleed field ──────
console.log('\nProduction correction (portrait / toolbar / full-bleed)');

test('a real public portrait renders in its own <img>, not under the Cipher', () => {
  // Dedicated media element (object-fit cover) separate from the Cipher layers.
  assert.match(fpHtml, /<img class="viz-hero__photo" id="heroPhoto"/);
  assert.match(fpCss, /\.viz-hero__photo\{[^}]*object-fit:cover/);
  // The JS routes the sanitized hero photo into that <img> and flags the state.
  assert.match(fpJs, /const heroImg = \$\('heroPhoto'\)/);
  assert.match(fpJs, /viz\.dataset\.hasPhoto = hasPhoto \? 'true' : 'false'/);
});

test('a real portrait suppresses the placeholder egg, torus mask + watermark', () => {
  // No opaque Cipher form is ever painted over a face.
  assert.match(fpCss, /\.viz\[data-has-photo="true"\] \.portrait\{display:none\}/);
  assert.match(fpCss, /\.viz\[data-has-photo="true"\] \.viz-hero__mask\{display:none\}/);
  assert.match(fpCss, /\.viz\[data-has-photo="true"\] \.viz-watermark\{display:none\}/);
});

test('replacing/removing the photo never retains a stale portrait', () => {
  // hero photo is re-derived through safeMediaSrc on every hydrate…
  assert.match(fpJs, /state\.heroPhoto = safeMediaSrc\(id\.photo\)/);
  // …and when absent the <img> src is cleared, not left pointing at old media.
  assert.match(fpJs, /heroImg\.removeAttribute\('src'\)/);
  assert.match(fpJs, /heroImg\.hidden = true/);
});

test('a private / unsafe portrait src never renders', () => {
  // safeMediaSrc only admits data:image or https srcs.
  assert.match(fpJs, /function safeMediaSrc\(/);
  assert.match(fpJs, /\^data:image\\\/\(png\|jpe\?g\|webp\|gif\|svg/);
  // Room-image defense in depth still drops private images.
  assert.match(fpJs, /if \(img\.visibility === 'private'\) return null/);
});

test('toolbar actions are separate, non-overlapping containers with full labels', () => {
  // Two distinct groups in the bar: the view toggle + the public preview button.
  assert.match(fpHtml, /<div class="stage__views"/);
  assert.match(fpHtml, /id="publicPreviewBtn"[^>]*>Preview public hOMepage</);
  // Non-overlapping sizing: nowrap label, explicit gaps, no shrink.
  assert.match(fpCss, /\.publicbtn\{[^}]*white-space:nowrap/);
  assert.match(fpCss, /\.stage__actions\{[^}]*flex-wrap:nowrap/);
  // Embedded: reserve top-right room so the overlay Close cannot collide.
  assert.match(fpCss, /\.app\.is-embedded \.stage__bar\{padding-right/);
  assert.match(fpJs, /app\.classList\.add\('is-embedded'\)/);
  // The Studio overlay Close is its own element, distinct from the iframe button.
  assert.match(studio, /id="fieldprint-v5-close"[^>]*aria-label="Close Fieldprint">Close</);
});

test('the field stage is full-bleed — no preview-card wrapper / radius / black canvas', () => {
  // Default desktop preview drops the card cap, radius and shadow.
  assert.match(fpCss, /\.viz\{max-width:none;border-radius:0;box-shadow:none\}/);
  assert.match(fpCss, /\.stage__scroll\{padding:0\}/);
  // The shell is a warm deep-ink/umber field, not near-black.
  assert.match(fpCss, /\.stage\{[^}]*#14110a/);
  assert.doesNotMatch(fpCss, /radial-gradient\(120% 80% at 50% -10%,#1b1c14,#0b0c07/);
});

// ── v6 left-rail information architecture (5 accordions, Identity-first) ──────
console.log('\nLeft-rail IA (accordions / identity photo / room images / colours)');

test('the rail is five native <details> accordions in the approved order', () => {
  const iId = fpHtml.indexOf('id="accIdentity"');
  const iContent = fpHtml.indexOf('id="accContent"');
  const iImages = fpHtml.indexOf('id="accImages"');
  const iColours = fpHtml.indexOf('id="accColours"');
  const iField = fpHtml.indexOf('id="accField"');
  assert.ok(iId !== -1 && iContent !== -1 && iImages !== -1 && iColours !== -1 && iField !== -1,
    'all five accordions present');
  assert.ok(iId < iContent && iContent < iImages && iImages < iColours && iColours < iField,
    'order must be Identity → Content → Images → Colours → Fieldprint/Cipher');
  // Keyboard-accessible native disclosure with a chevron affordance.
  assert.match(fpHtml, /<details class="acc" id="accIdentity" open>/);
  assert.match(fpHtml, /<summary class="acc__sum">/);
  assert.match(fpCss, /\.acc__chev/);
});

test('only Identity + Content + Images are open by default; Colours/Cipher collapsed', () => {
  assert.match(fpHtml, /id="accIdentity" open>/);
  assert.match(fpHtml, /id="accContent" open>/);
  assert.match(fpHtml, /id="accImages" open>/);
  // Colours and the advanced Cipher group carry no `open` attribute.
  assert.match(fpHtml, /<details class="acc" id="accColours">/);
  assert.match(fpHtml, /<details class="acc" id="accField">/);
});

test('Load Field JSON stays pinned above the accordions with compact copy', () => {
  const iLoad = fpHtml.indexOf('class="ctl ctl--load"');
  const iId = fpHtml.indexOf('id="accIdentity"');
  assert.ok(iLoad !== -1 && iLoad < iId, 'Load JSON pinned above the first accordion');
  assert.match(fpHtml, /Begin with a Field JSON export\./);
  // The technical privacy-firewall paragraph is gone from the visible rail copy.
  const load = fpHtml.slice(iLoad, iId);
  assert.doesNotMatch(load, /firewall/i);
  assert.doesNotMatch(load, /privacy/i);
});

test('no birth-data / Gene Keys / mechanics wording leaks into the normal UI', () => {
  // Visible copy only — strip source comments and <meta> SEO/description.
  const visible = fpHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<meta\b[^>]*>/gi, '');
  assert.doesNotMatch(visible, /gene key/i);
  assert.doesNotMatch(visible, /birth data|birthdata|birth date/i);
  // "sigil" is engine jargon — user-facing accordion titles say "Cipher".
  assert.doesNotMatch(fpHtml, /class="acc__title">[^<]*[Ss]igil/);
});

test('Identity accordion activates the arrival-portrait editor', () => {
  assert.match(fpHtml, /id="heroImgEditor"/);
  assert.match(fpHtml, /id="heroUploadBtn"/);
  assert.match(fpHtml, /id="heroRemoveBtn"/);
  assert.match(fpHtml, /type="file" id="heroPhotoInput"/);
  assert.match(fpHtml, /id="heroAltInput"/);
  assert.match(fpHtml, /id="heroFocalX"/);
  assert.match(fpHtml, /id="heroFocalY"/);
  // JS wiring: upload → FileReader → safeMediaSrc → state.heroPhoto; remove clears.
  assert.match(fpJs, /function wireHeroPhoto\(/);
  assert.match(fpJs, /function applyHeroFocal\(/);
  assert.match(fpJs, /function syncHeroEditor\(/);
  const wh = fpJs.slice(fpJs.indexOf('function wireHeroPhoto'), fpJs.indexOf('function applyHeroFocal'));
  assert.match(wh, /safeMediaSrc\(ev\.target\.result\)/);
  assert.match(wh, /state\.heroPhoto = src/);
});

test('removing / rehydrating the portrait never keeps stale alt or focal framing', () => {
  // Remove resets photo + alt + focal.
  assert.match(fpJs, /state\.heroPhoto = ''; state\.heroAlt = '';/);
  // Hydrate resets alt/focal and drops prior colour overrides.
  assert.match(fpJs, /state\.heroFocalX = 50;\s*\n\s*state\.heroFocalY = 50;/);
  assert.match(fpJs, /state\.roleOverrides = \{ root: null, expression: null, radiance: null \};/);
});

test('Content accordion drives four live room copy editors', () => {
  assert.match(fpHtml, /id="sectionCopyControls"/);
  assert.match(fpJs, /function buildCopyControls\(/);
  assert.match(fpJs, /data-sectitle/);
  assert.match(fpJs, /data-secbody/);
  // Typing updates the live overview + open room without a full re-render.
  assert.match(fpJs, /\.viz-sec-title/);
  assert.match(fpJs, /\.room__title/);
});

test('Images accordion gives one full editor per room, decoupled from sigmode', () => {
  assert.match(fpHtml, /id="roomImageControls"/);
  assert.match(fpJs, /function buildImageControls\(/);
  // Full per-room control surface.
  assert.match(fpJs, /data-imgupload/);
  assert.match(fpJs, /data-imgremove/);
  assert.match(fpJs, /data-imgalt/);
  assert.match(fpJs, /data-imgprivate/);
  assert.match(fpJs, /data-imgfx/);
  assert.match(fpJs, /data-imgfy/);
  assert.match(fpJs, /data-imgop/);
  assert.match(fpJs, /data-imgblend/);
  // Room-image ROLE buttons are their own control (data-imgsec) — NOT gated by
  // sigmode. buildImageControls carries no `sigmode === 'auto'` lock.
  assert.match(fpJs, /roleopt[^\n]*data-imgsec/);
  const bi = fpJs.indexOf('function buildImageControls');
  const biBody = fpJs.slice(bi, fpJs.indexOf('function wireImageControls'));
  assert.doesNotMatch(biBody, /sigmode/);
});

test('private room images are gated out of every rendered surface', () => {
  assert.match(fpJs, /function visibleImage\(/);
  assert.match(fpJs, /visibility !== 'private'/);
  // The render paths consult the gate, not the raw image.
  assert.match(fpJs, /const img = visibleImage\(sec\.image\)/);
});

test('a disabled "Suggested from your field" affordance promises no auto-insert', () => {
  assert.match(fpHtml, /id="suggestBox"/);
  assert.match(fpHtml, /Suggested from your field/);
  assert.match(fpHtml, /without your explicit confirmation/i);
});

test('Colours accordion offers editable role colours + Cipher reset', () => {
  assert.match(fpHtml, /type="color" id="roleColorRoot"/);
  assert.match(fpHtml, /id="roleColorExpression"/);
  assert.match(fpHtml, /id="roleColorRadiance"/);
  assert.match(fpHtml, /id="resetColorsBtn"[^>]*>Reset to Cipher colours</);
  assert.match(fpHtml, /drawn from the tonal relationships in your Cipher/);
  // JS: overrides win over derived colours; reset clears them.
  assert.match(fpJs, /function wireColors\(/);
  assert.match(fpJs, /function syncColorInputs\(/);
  assert.match(fpJs, /function activeRoleColor\(/);
  assert.match(fpJs, /state\.roleOverrides\[which\] = inp\.value/);
});

// ── Transparent arrival portrait composites over the field (no white box) ────
console.log('\nTransparent arrival portrait (alpha preserved / no white backing)');

test('a transparent PNG portrait keeps its bytes — never flattened to JPEG', () => {
  // The uploaded src is used verbatim from safeMediaSrc(FileReader result);
  // nothing re-encodes it. No image/jpeg conversion exists anywhere.
  const wh = fpJs.slice(fpJs.indexOf('function wireHeroPhoto'), fpJs.indexOf('function applyHeroFocal'));
  assert.match(wh, /const src = safeMediaSrc\(ev\.target\.result\)/);
  assert.match(wh, /state\.heroPhoto = src;/);
  assert.doesNotMatch(fpJs, /image\/jpeg/i);
  assert.doesNotMatch(fpJs, /toDataURL/);
  // safeMediaSrc still admits PNG (and other raster/svg) data URLs unchanged.
  assert.match(fpJs, /\^data:image\\\/\(png\|jpe\?g\|webp\|gif\|svg/);
});

test('alpha detection sets a data flag without mutating the portrait src', () => {
  assert.match(fpJs, /function detectHeroAlpha\(/);
  assert.match(fpJs, /function setHeroAlpha\(/);
  // Reads pixels via a canvas probe, checks for any alpha < 250.
  assert.match(fpJs, /getImageData\(/);
  assert.match(fpJs, /data\[i\] < 250/);
  // The detector only writes the alpha flag + dataset — never state.heroPhoto.
  const det = fpJs.slice(fpJs.indexOf('function detectHeroAlpha'), fpJs.indexOf('function wireHeroPhoto'));
  assert.doesNotMatch(det, /state\.heroPhoto =/);
  assert.match(fpJs, /viz\.dataset\.photoAlpha = \(state\.heroPhoto && v\) \? 'true' : 'false'/);
  // Composition exposes the flag only while a photo is present.
  assert.match(fpJs, /viz\.dataset\.photoAlpha = \(hasPhoto && state\.heroPhotoHasAlpha\) \? 'true' : 'false'/);
});

test('detection runs on upload + rehydration, and clears on remove', () => {
  const wh = fpJs.slice(fpJs.indexOf('function wireHeroPhoto'), fpJs.indexOf('function syncHeroEditor'));
  assert.match(wh, /detectHeroAlpha\(src\)/);         // upload
  assert.match(wh, /state\.heroPhotoHasAlpha = false;/); // remove resets
  assert.match(fpJs, /if \(state\.heroPhoto\) detectHeroAlpha\(state\.heroPhoto\)/); // hydrate
});

test('a transparent portrait drops the opaque media card (no white rectangle)', () => {
  // No forced white/cream backing on the image element itself.
  assert.match(fpCss, /\.viz-hero__photo\{[^}]*background:transparent/);
  assert.doesNotMatch(fpCss, /\.viz-hero__photo\{[^}]*background:(#fff|#ffffff|white|var\(--surface\)|var\(--bg\))/i);
  // When alpha present: media wrapper is transparent, shadowless, radius-free,
  // and the figure is shown whole (contain) over the field.
  assert.match(fpCss, /\.viz\[data-has-photo="true"\]\[data-photo-alpha="true"\] \.viz-hero__media\{[^}]*background:transparent[^}]*box-shadow:none[^}]*border-radius:0/);
  assert.match(fpCss, /\.viz\[data-has-photo="true"\]\[data-photo-alpha="true"\] \.viz-hero__photo\{[^}]*object-fit:contain/);
});

test('opaque photos still render with cover-crop + focal (unchanged path)', () => {
  // Default hero photo keeps object-fit:cover; focal via object-position.
  assert.match(fpCss, /\.viz-hero__photo\{[^}]*object-fit:cover/);
  assert.match(fpJs, /heroImg\.style\.objectPosition = `\$\{state\.heroFocalX\}% \$\{state\.heroFocalY\}%`/);
});

test('removing the portrait restores the no-photo placeholder + clears alpha', () => {
  // has-photo false re-enables the placeholder egg; alpha flag is reset.
  assert.match(fpJs, /viz\.dataset\.hasPhoto = hasPhoto \? 'true' : 'false'/);
  assert.match(fpCss, /\.viz\[data-has-photo="true"\] \.portrait\{display:none\}/);
  assert.match(fpJs, /heroImg\.removeAttribute\('src'\)/);
});

// ── Portrait fade / opacity gradient (merge into text, soften edges) ──
test('portrait fade controls exist: None / Toward text / All edges + strength', () => {
  // A radiogroup of three concise choices lives inside the hero photo fields.
  assert.match(fpHtml, /id="heroFadeSeg"[^>]*role="radiogroup"|role="radiogroup"[^>]*id="heroFadeSeg"/);
  assert.match(fpHtml, /data-herofade="none"[^>]*>\s*None/);
  assert.match(fpHtml, /data-herofade="text"[^>]*>\s*Toward text/);
  assert.match(fpHtml, /data-herofade="edges"[^>]*>\s*All edges/);
  // A strength slider (0..100) with a live value label, hidden until a fade is on.
  assert.match(fpHtml, /id="heroFadeStrengthRow"[^>]*hidden/);
  assert.match(fpHtml, /id="heroFadeStrength"[^>]*min="0"[^>]*max="100"/);
  assert.match(fpHtml, /id="heroFadeStrengthVal"/);
});

test('fade state defaults to none (backwards-compatible, no surprise fade)', () => {
  assert.match(fpJs, /heroFadeMode: 'none'/);
  assert.match(fpJs, /heroFadeStrength: 0\.6/);
});

test('applyComposition publishes data-fade + --fade-strength (photo-gated)', () => {
  assert.match(fpJs, /viz\.dataset\.fade = hasPhoto \? state\.heroFadeMode : 'none'/);
  assert.match(fpJs, /viz\.style\.setProperty\('--fade-strength', String\(state\.heroFadeStrength\)\)/);
});

test('fade segmented buttons + strength slider are wired', () => {
  const wh = fpJs.slice(fpJs.indexOf('function wireHeroPhoto'), fpJs.indexOf('function applyHeroFocal'));
  assert.match(wh, /heroFadeSeg/);
  assert.match(wh, /state\.heroFadeMode = btn\.getAttribute\('data-herofade'\)/);
  assert.match(wh, /state\.heroFadeStrength = n \/ 100/);
});

test('fade uses a true alpha mask (mask-image + -webkit-mask-image), no colour overlay', () => {
  // Both prefixes present so transparent-PNG alpha is preserved on WebKit too.
  assert.match(fpCss, /\.viz\[data-fade="text"\] \.viz-hero__photo\{[^}]*-webkit-mask-image:linear-gradient/);
  assert.match(fpCss, /\.viz\[data-fade="text"\] \.viz-hero__photo\{[^}]*[^-]mask-image:linear-gradient/);
  // None explicitly clears the mask so nothing lingers.
  assert.match(fpCss, /\.viz\[data-fade="none"\] \.viz-hero__photo\{[^}]*mask-image:none/);
  // Strength drives reach via a CSS custom property (no hard-coded opacity dim).
  assert.match(fpCss, /--fade-reach:calc\([^)]*var\(--fade-strength/);
});

test('toward-text fade is responsive per hero mode + stacks to bottom on mobile', () => {
  // contained/bleed-left default → right edge; bleed-right → left; full-bleed → bottom.
  assert.match(fpCss, /\.viz\[data-fade="text"\] \.viz-hero__photo\{[^}]*linear-gradient\(to right/);
  assert.match(fpCss, /\.viz\[data-fade="text"\]\[data-hero="bleed-right"\] \.viz-hero__photo\{[^}]*linear-gradient\(to left/);
  assert.match(fpCss, /\.viz\[data-fade="text"\]\[data-hero="full-bleed"\] \.viz-hero__photo\{[^}]*linear-gradient\(to bottom/);
  // Stacked mobile always fades the lower edge (media sits above copy).
  assert.match(fpCss, /\.stage\.is-mobile \.viz\[data-fade="text"\] \.viz-hero__photo\{[^}]*linear-gradient\(to bottom/);
});

test('all-edges fade is a soft radial vignette centred on the face, not a harsh ellipse', () => {
  assert.match(fpCss, /\.viz\[data-fade="edges"\] \.viz-hero__photo\{[^}]*radial-gradient\([^}]*at 50% 42%/);
  assert.match(fpCss, /\.viz\[data-fade="edges"\] \.viz-hero__photo\{[^}]*-webkit-mask-image:radial-gradient/);
});

test('fade resets on remove and on model rehydration (no stale framing)', () => {
  const wh = fpJs.slice(fpJs.indexOf('function wireHeroPhoto'), fpJs.indexOf('function applyHeroFocal'));
  assert.match(wh, /state\.heroFadeMode = 'none'; state\.heroFadeStrength = 0\.6/);
  const hy = fpJs.slice(fpJs.indexOf('function hydrateFromModel'));
  assert.match(hy, /state\.heroFadeMode = 'none'/);
  assert.match(hy, /state\.heroFadeStrength = 0\.6/);
});

console.log('\n' + passed + ' checks passed.');
