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
  assert.match(fpJs, /room__navlink--prev/);
  assert.match(fpJs, /room__navlink--next/);
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

// ── Editable per-room Display heading (eyebrow), routing-safe ──
console.log('\nEditable presentation copy (room display headings)');

test('each room exposes an editable Display heading, defaulting to its eyebrow', () => {
  // Content accordion renders a per-room Display heading input seeded from eyebrow.
  const bc = fpJs.slice(fpJs.indexOf('function buildCopyControls'), fpJs.indexOf('function applyEyebrowLive') + 400);
  assert.match(fpJs, /data-seceyebrow/);
  assert.match(fpJs, /Display heading/);
  assert.match(fpJs, /value="\$\{escapeHtml\(sec\.eyebrow\)\}"[^>]*data-seceyebrow|data-seceyebrow="\$\{i\}"[\s\S]*?value="\$\{escapeHtml\(sec\.eyebrow\)\}"/);
});

test('typing a Display heading updates state.eyebrow + re-renders live', () => {
  const bc = fpJs.slice(fpJs.indexOf('function buildCopyControls'));
  assert.match(bc, /function applyEyebrowLive\(/);
  assert.match(bc, /state\.sections\[idx\]\.eyebrow = inp\.value/);
  // Live: card title text + overview sections + open room re-render.
  assert.match(bc, /data-sectitletext/);
  assert.match(bc, /renderSections\(\)/);
  assert.match(bc, /if \(state\.route\.view === 'room'\) renderRoom\(state\.route\.roomIdx\)/);
});

test('per-room Reset restores the heading to its imported/default value only', () => {
  const bc = fpJs.slice(fpJs.indexOf('function buildCopyControls'));
  assert.match(bc, /data-secheadingreset/);
  assert.match(bc, /state\.sections\[idx\]\.eyebrow = baseEyebrow\(idx\)/);
  // baseEyebrow prefers the in-memory baseline (imported), falling back to SECTIONS default.
  assert.match(fpJs, /function baseEyebrow\(i\)/);
  assert.match(fpJs, /baseline\.sections\[i\]\.eyebrow/);
  assert.match(fpJs, /return SECTIONS\[i\] \? SECTIONS\[i\]\.eyebrow : ''/);
});

test('display-heading editing cannot break routing (routing stays index/key-based)', () => {
  // Navigation is keyed on data-goto / data-enter indices, never the heading text.
  assert.match(fpJs, /data-goto/);
  assert.match(fpJs, /data-enter/);
  // The snapshot keeps the stable room key alongside the editable eyebrow.
  assert.match(fpJs, /key: s\.key, eyebrow: s\.eyebrow/);
});

// ── Save / autosave: local device draft, honest about scope ──
console.log('\nSave / autosave (on-device draft, privacy-safe)');

test('a visible Save action + live status live in the rail', () => {
  assert.match(fpHtml, /id="saveBtn"[^>]*>Save Fieldprint|>Save Fieldprint</);
  assert.match(fpHtml, /id="saveStatus"/);
  // Honest scope copy: device-only, not cloud/account/published.
  assert.match(fpHtml, /Saved on this device only/);
  assert.doesNotMatch(fpHtml, /published to the web[^<]*<\/[^>]*>\s*<\/section>\s*$/);
  assert.match(fpHtml, /id="revertSavedBtn"/);
  assert.match(fpHtml, /id="resetImportedBtn"/);
});

test('status wording covers idle / dirty / saving / saved / error', () => {
  const ss = fpJs.slice(fpJs.indexOf('function setSaveStatus'));
  assert.match(ss, /idle: 'Saves to this device'/);
  assert.match(ss, /dirty: 'Unsaved changes'/);
  assert.match(ss, /saving: 'Saving…'/);
  assert.match(ss, /saved: 'Saved on this device'/);
  assert.match(ss, /error: "Couldn't save on this device"/);
});

test('autosave is debounced; explicit Save flushes immediately', () => {
  assert.match(fpJs, /function scheduleSave\(\) \{ clearTimeout\(saveTimer\); saveTimer = setTimeout\(saveDraft, 800\)/);
  assert.match(fpJs, /function markDirty\(\) \{ setSaveStatus\('dirty'\); scheduleSave\(\)/);
  assert.match(fpJs, /function flushSave\(\) \{ clearTimeout\(saveTimer\); saveDraft\(\)/);
  // Save button flushes; native rail input/change is the debounced trigger.
  assert.match(fpJs, /addEventListener\('click', \(\) => flushSave\(\)\)/);
  assert.match(fpJs, /\['input', 'change'\]\.forEach\(\(ev\) => panel\.addEventListener\(ev, markDirty\)\)/);
});

test('custom (non-native) controls also mark the draft dirty', () => {
  // Radios/segments/uploads/removes/role/colour-reset are <button>s → explicit markDirty.
  const count = (fpJs.match(/markDirty\(\)/g) || []).length;
  assert.ok(count >= 8, 'expected markDirty() wired into custom handlers, saw ' + count);
});

test('only a public-safe composition is persisted — never raw model / private fields', () => {
  const sn = fpJs.slice(fpJs.indexOf('function snapshot()'), fpJs.indexOf('function applySnapshot'));
  // The snapshot is an explicit allow-list of presentation fields.
  assert.match(sn, /name: state\.name/);
  assert.match(sn, /tagline: state\.tagline/);
  assert.match(sn, /eyebrow: s\.eyebrow, title: s\.title, body: s\.body/);
  // No birth/profile/Gene-Keys/mechanics/raw-model leakage into the snapshot.
  assert.doesNotMatch(sn, /birth|geneKeys|gene_keys|mechanics|rawModel|rawJson|profile/i);
});

test('private room images are dropped from persistence entirely', () => {
  const ts = fpJs.slice(fpJs.indexOf('function toStorable'), fpJs.indexOf('function fromStorable'));
  assert.match(ts, /visibility === 'private'/);
  assert.match(ts, /ss\.image = null; return;/);
  // Rehydration re-runs privacy/safety filtering as defense in depth.
  assert.match(fpJs, /sanitizeImage\(ss\.image\)/);
  assert.match(fpJs, /state\.heroPhoto = safeMediaSrc\(h\.src\)/);
});

test('image data URLs go to IndexedDB; metadata to localStorage (quota-safe)', () => {
  assert.match(fpJs, /const IDB_NAME = 'commonunity-fieldprint'/);
  assert.match(fpJs, /const IDB_STORE = 'images'/);
  assert.match(fpJs, /localStorage\.setItem\(DRAFT_KEY/);
  assert.match(fpJs, /idbPutImages\(currentOwner, images\)/);
  // Honest fallbacks: full storage + images-too-large are reported, not hidden.
  assert.match(fpJs, /this browser's storage is full/);
  assert.match(fpJs, /images too large to store here/);
});

test('a draft is guarded by schema version + owner fingerprint (no cross-user bleed)', () => {
  assert.match(fpJs, /const DRAFT_SCHEMA = 1/);
  assert.match(fpJs, /const DRAFT_KEY = 'commonunity\.fieldprint\.draft\.v1'/);
  const ld = fpJs.slice(fpJs.indexOf('async function loadDraft'), fpJs.indexOf('async function establishBaselineAndRestore'));
  assert.match(ld, /record\.schema !== DRAFT_SCHEMA\) return false/);
  assert.match(ld, /record\.owner !== currentOwner\) return false/);
  // Owner is a fingerprint of the active identity/source, not a global key.
  assert.match(fpJs, /function computeOwner\(/);
  assert.match(fpJs, /return djb2\(sig\)/);
});

test('reload rehydrates the matching draft; revert + reset are available', () => {
  assert.match(fpJs, /async function establishBaselineAndRestore\(/);
  assert.match(fpJs, /baseline = snapshot\(\)/);
  assert.match(fpJs, /const restored = await loadDraft\(\)/);
  // Revert = reload saved; Reset = restore imported baseline + clear draft.
  assert.match(fpJs, /async function revertToSaved\(/);
  assert.match(fpJs, /async function resetToImported\(/);
  assert.match(fpJs, /applySnapshot\(baseline\)/);
  assert.match(fpJs, /localStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(fpJs, /idbDelImages\(currentOwner\)/);
});

test('destructive resets are confirmed before wiping edits', () => {
  const ws = fpJs.slice(fpJs.indexOf('function wireSave'));
  assert.match(ws, /window\.confirm\('Revert to the last version saved on this device\?/);
  assert.match(ws, /window\.confirm\('Reset to the imported Fieldprint\?/);
});

test('revert + reset cancel any queued autosave (no draft resurrection)', () => {
  // A debounced save queued by a just-typed edit must not fire after a reset and
  // re-create the draft the user just cleared. Both paths clear the timer first.
  const rv = fpJs.slice(fpJs.indexOf('async function revertToSaved'), fpJs.indexOf('async function resetToImported'));
  assert.match(rv, /clearTimeout\(saveTimer\)/);
  const ri = fpJs.slice(fpJs.indexOf('async function resetToImported'), fpJs.indexOf('function baseEyebrow'));
  assert.match(ri, /clearTimeout\(saveTimer\)/);
});

test('init + model bridge establish the baseline and restore on (re)load', () => {
  assert.match(fpJs, /wireSave\(\);/);
  assert.match(fpJs, /establishBaselineAndRestore\(\);/);
});

// ── Editorial room composition: editable copy for all four rooms ──
test('Content editor exposes room intro, highlights, closing line, entry phrase', () => {
  const bc = fpJs.slice(fpJs.indexOf('function buildCopyControls'), fpJs.indexOf('function buildImageControls'));
  // Per-room room-detail copy editors (beyond the pre-existing eyebrow/title/body).
  assert.match(bc, /data-secnarr="\$\{i\}"/);   // Room intro (narrative)
  assert.match(bc, /data-secprompt="\$\{i\}"/); // Closing line (prompt)
  assert.match(bc, /data-secenter="\$\{i\}"/);  // Entry phrase (enter)
  assert.match(bc, />Room intro</);
  assert.match(bc, />Closing line</);
  assert.match(bc, />Entry phrase</);
  // Overview body relabelled so it is distinct from the room intro.
  assert.match(bc, />Overview body</);
});

test('highlights editor: per-artifact tag/title/note with add + remove', () => {
  const bc = fpJs.slice(fpJs.indexOf('function buildCopyControls'), fpJs.indexOf('function buildImageControls'));
  assert.match(bc, /data-arttag="\$\{i\}-\$\{j\}"/);
  assert.match(bc, /data-arttitle="\$\{i\}-\$\{j\}"/);
  assert.match(bc, /data-artnote="\$\{i\}-\$\{j\}"/);
  assert.match(bc, /data-artadd="\$\{i\}"/);
  assert.match(bc, /data-artrm="\$\{i\}-\$\{j\}"/);
  assert.match(bc, /data-artgroup="\$\{i\}"/);
});

test('room-detail copy edits live-render the open room (and enter re-renders overview)', () => {
  const bc = fpJs.slice(fpJs.indexOf('function buildCopyControls'), fpJs.indexOf('function buildImageControls'));
  // A liveRoom helper re-renders the open room in place on narrative/prompt/artifact edits.
  assert.match(bc, /function liveRoom\(idx\)/);
  assert.match(bc, /state\.route\.view === 'room' && state\.route\.roomIdx === idx\) renderRoom\(idx\)/);
  // narrative/prompt mutate state then liveRoom.
  assert.match(bc, /state\.sections\[idx\]\.narrative = ta\.value;\s*\n?\s*liveRoom\(idx\)/);
  assert.match(bc, /state\.sections\[idx\]\.prompt = inp\.value;\s*\n?\s*liveRoom\(idx\)/);
  // entry phrase also updates the overview enter button.
  const enterBlk = bc.slice(bc.indexOf("data-secenter]"));
  assert.match(enterBlk, /renderSections\(\)/);
  // add pushes a new artifact and rebuilds; remove splices.
  assert.match(bc, /state\.sections\[i\]\.artifacts\.push\(\{ tag: 'Signal', title: '', note: '' \}\)/);
  assert.match(bc, /state\.sections\[i\]\.artifacts\.splice\(j, 1\)/);
  // structural changes autosave.
  const addBlk = bc.slice(bc.indexOf('data-artadd]'));
  assert.match(addBlk, /markDirty\(\)/);
});

// ── Persistence: artifacts + room copy flow through the public-safe allow-list ──
test('snapshot() persists artifacts (tag/title/note) alongside room copy', () => {
  const snap = fpJs.slice(fpJs.indexOf('function snapshot'), fpJs.indexOf('function applySnapshot'));
  assert.match(snap, /narrative: s\.narrative/);
  assert.match(snap, /prompt: s\.prompt/);
  assert.match(snap, /enter: s\.enter/);
  // artifacts serialized as an explicit tag/title/note allow-list, never raw objects.
  assert.match(snap, /artifacts: Array\.isArray\(s\.artifacts\)/);
  assert.match(snap, /tag: a\.tag \|\| '', title: a\.title \|\| '', note: a\.note \|\| ''/);
});

test('applySnapshot() restores artifacts string-sanitized and rejects raw fields', () => {
  const app = fpJs.slice(fpJs.indexOf('function applySnapshot'), fpJs.indexOf('function applySnapshot') + 2000);
  assert.match(app, /if \(Array\.isArray\(ss\.artifacts\)\)/);
  // Only tag/title/note are copied, each coerced to String — no raw/private field.
  assert.match(app, /tag: String\(\(a && a\.tag\) \|\| ''\)/);
  assert.match(app, /title: String\(\(a && a\.title\) \|\| ''\)/);
  assert.match(app, /note: String\(\(a && a\.note\) \|\| ''\)/);
  assert.match(app, /tgt\.narrative = String\(ss\.narrative\)|ss\.narrative != null/);
});

// ── Role-aware media in the room; no fake-content band when there is no image ──
test('renderRoom is role-aware (inset / full-bleed / background / artifact)', () => {
  const rr = fpJs.slice(fpJs.indexOf('function renderRoom'), fpJs.indexOf('function enterRoom'));
  assert.match(rr, /const img = visibleImage\(sec\.image\)/);
  assert.match(rr, /const role = img \? \(img\.role \|\| 'inset'\) : 'none'/);
  assert.match(rr, /role === 'full-bleed'/);
  assert.match(rr, /role === 'background'/);
  assert.match(rr, /role === 'inset'/);
  assert.match(rr, /role === 'artifact'/);
  // Full-bleed banner + background scrim + inset/artifact figure.
  assert.match(rr, /class="room__bleed reveal"/);
  assert.match(rr, /class="room__bg"/);
  assert.match(rr, /class="room__bg-scrim"/);
  assert.match(rr, /room__figure room__figure--/);
  // Honour focal/opacity/blend + alt.
  assert.match(rr, /imageStyle\(img\)/);
  assert.match(rr, /figcaption class="room__figcap"/);
});

test('renderRoom omits the media region entirely when there is no public image', () => {
  const rr = fpJs.slice(fpJs.indexOf('function renderRoom'), fpJs.indexOf('function enterRoom'));
  // Media pieces start empty; only assigned under a matching role. role 'none' → all empty.
  assert.match(rr, /let bleedHTML = '';/);
  assert.match(rr, /let bgHTML = '';/);
  assert.match(rr, /let mastheadFig = '';/);
  assert.match(rr, /let asideFig = '';/);
  // The old gradient/hatch fake-content band is gone.
  assert.doesNotMatch(rr, /room__abstract/);
  assert.doesNotMatch(rr, /room__mediamask/);
  assert.doesNotMatch(fpCss, /\.room__abstract\b/);
});

test('highlights render as a numbered hairline ledger — never bordered cards', () => {
  const rr = fpJs.slice(fpJs.indexOf('function renderRoom'), fpJs.indexOf('function enterRoom'));
  assert.match(rr, /class="room__ledger reveal"/);
  assert.match(rr, /class="room__entry"/);
  assert.match(rr, /class="room__entry-num"/);
  assert.match(rr, /padStart\(2, '0'\)/);
  // Ledger omitted when there are no artifacts (no empty <ol>).
  assert.match(rr, /arts\.length\s*\n?\s*\?/);
  // The old dashboard-card artifact markup + CSS are gone.
  assert.doesNotMatch(rr, /room-artifact\b/);
  assert.doesNotMatch(fpCss, /\.room-artifact\b/);
  // Ledger entries use a hairline top rule, not a rounded/bordered box.
  assert.match(fpCss, /\.room__entry\{[^}]*border-top:1px solid var\(--line\)/);
});

test('closing line is a restrained final beat at a readable measure', () => {
  const rr = fpJs.slice(fpJs.indexOf('function renderRoom'), fpJs.indexOf('function enterRoom'));
  assert.match(rr, /class="room__closing reveal"/);
  assert.match(rr, /class="room__closing-text"/);
  assert.match(fpCss, /\.room__closing-text\{[^}]*max-width:45ch/);
  // Narrative holds a comfortable reading measure.
  assert.match(fpCss, /\.room__narrative\{[^}]*max-width:68ch/);
});

test('editorial spread is asymmetric and collapses to one column on narrow', () => {
  assert.match(fpCss, /\.room__spread\{[^}]*grid-template-columns:minmax\(0,1\.55fr\) minmax\(0,1fr\)/);
  assert.match(fpCss, /\.room__spread--solo\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(fpCss, /@media \(max-width:920px\)\{[\s\S]*?\.room__spread\{grid-template-columns:1fr/);
  assert.match(fpCss, /\.stage\.is-mobile \.room__spread\{grid-template-columns:1fr/);
});

test('room nav is light (no heavy bordered pills) and keeps index-based routing', () => {
  const rr = fpJs.slice(fpJs.indexOf('function renderRoom'), fpJs.indexOf('function enterRoom'));
  // Simplified nav links + a compact numbered pager; routing still data-goto/data-back.
  assert.match(rr, /class="room__navlink room__navlink--prev"/);
  assert.match(rr, /class="room__navlink room__navlink--next"/);
  assert.match(rr, /class="room__pager"/);
  assert.match(rr, /data-goto="\$\{prevIdx\}"/);
  assert.match(rr, /data-goto="\$\{nextIdx\}"/);
  assert.match(rr, /vizRoom\.querySelector\('\[data-back\]'\)\.addEventListener\('click', exitRoom\)/);
  assert.match(rr, /observeReveals\(\)/);
  // Nav links are borderless (no pill background/border like the old .room__nav-btn).
  assert.match(fpCss, /\.room__navlink\{[^}]*background:none;border:none/);
  assert.doesNotMatch(fpCss, /\.room__nav-btn\b/);
});

test('reduced-motion covers the new room nav + reveal elements', () => {
  const rm = fpCss.slice(fpCss.indexOf('@media (prefers-reduced-motion:reduce)'));
  assert.match(rm, /\.room__navlink/);
});

console.log('\n' + passed + ' checks passed.');
