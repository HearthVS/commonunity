/* Living Profile v0.5 regressions:
 *   1. Hero composition: name + essence + roles + statement on the LEFT,
 *      profile image slot on the RIGHT (sigil no longer in the hero).
 *   2. Field Imprints section: replaces the prior "Cosmic identity"
 *      framing, contains the sigil PLUS the foundation grid. The
 *      foundation grid is read-only (cOMpass Setup is the sole
 *      authoritative editor for birth date / time / place).
 *   3. Fourfold cards are clickable and open a detail popup; the duplicate
 *      large lp-editorial summary block is no longer rendered inline.
 *   4. Studio toolbar exposes a direct "Living Profile" entry point.
 *   5. Hero essence prefers profile.essence_manual when set, so manual
 *      edits persist via localStorage/saveState() round-trip.
 *
 * Usage:  node tests/living-profile-v05.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('hero composition');
// Hero text block must come BEFORE the profile image slot in render
// order — left-side text, right-side image.
const heroOpen = src.indexOf('<section class="lp-hero" aria-label="Threshold identity">');
assert(heroOpen !== -1, 'lp-hero section is rendered');
const heroSlice = src.slice(heroOpen, heroOpen + 1600);
const heroTextIdx = heroSlice.indexOf('lp-hero-text');
const slotIdx = heroSlice.indexOf('slotHtml');
assert(heroTextIdx !== -1 && slotIdx !== -1 && heroTextIdx < slotIdx,
  'hero text is concatenated BEFORE slotHtml (text left, image right)');
assert(!/lp-hero[\s\S]{0,800}lp-hero-slot is-sigil/.test(src.slice(heroOpen, heroOpen + 2000)),
  'sigil hero-slot is NOT rendered inside the .lp-hero section anymore');

console.log('\nOM Cipher (was: Field Imprints)');
assert(/lp-field-imprints/.test(src), 'lp-field-imprints class kept for backward compat');
assert(/lp-om-cipher/.test(src), 'new lp-om-cipher class is applied to the section');
assert(/OM <em>Cipher<\/em>/.test(src), 'OM Cipher title present');
assert(/Your Field Pattern/.test(src), 'Your Field Pattern subtitle present');
assert(!/Field <em>Imprints<\/em>/.test(src), 'old "Field Imprints" title removed');
assert(/lp-field-imprints-sigil/.test(src), 'sigil placeholder still lives inside the section');
assert(/Cosmic <em>identity<\/em>/.test(src) === false,
  'old "Cosmic identity" heading replaced');
assert(!/data-lp-edit="foundation"/.test(src),
  'foundation items are read-only (no data-lp-edit click-to-edit; cOMpass Setup is the editor)');
assert(/class="lp-edit-btn lp-om-cipher-edit"[^>]*href="\/compass\?setup=1"/.test(src),
  'OM Cipher header links to cOMpass Setup for source-data edits');

console.log('\nfourfold popup');
assert(/data-lp-fourfold="' \+ f\.sec/.test(src) || /data-lp-fourfold=/.test(src),
  'compass cards include data-lp-fourfold');
assert(/lp-fourfold-popup/.test(src), 'lp-fourfold-popup overlay markup present');
assert(/openFourfoldPopup/.test(src), 'openFourfoldPopup helper defined');
assert(!/html \+= '<div class="lp-editorial">' \+\s*\n?\s*renderSection\('Work summary'/.test(src),
  'duplicate lp-editorial Work/Lens block removed');
assert(!/renderSection\('Field summary'/.test(src),
  'duplicate lp-editorial Field/Call block removed');
assert(/window\.__lpFourfoldDetail/.test(src),
  'fourfold detail cache exposed for popup to read');

console.log('\nedit popover');
assert(/lp-edit-popover/.test(src), 'lp-edit-popover markup present');
assert(/openLpEditPopover/.test(src), 'openLpEditPopover helper defined');
assert(/p\.essence_manual = val/.test(src),
  'saving essence writes profile.essence_manual');
assert(/p\.foundation\[field\] = val/.test(src),
  'saving foundation field writes profile.foundation[field]');
assert(/typeof saveState === 'function'/.test(src) || /saveState\(\)/.test(src),
  'edit popover persists via saveState()');
assert(/manualEssence \|\| capEssence/.test(src),
  'essenceSection prefers manualEssence over compass-derived value');

console.log('\nstudio toolbar access');
assert(/id="studio-path-living-profile-header"/.test(src),
  'toolbar Living Profile button present');
assert(/headerLpBtn[\s\S]{0,200}openLivingProfile/.test(src),
  'toolbar Living Profile button wired to openLivingProfile');

console.log('\nhero edit affordances');
assert(/id="lp-hero-edit-name"/.test(src),  'Edit name button present');
assert(/id="lp-hero-edit-essence"/.test(src),'Edit essence button present');

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: living-profile v0.5 regressions pass.');
}
