// Static-source regression tests for the *expanded* OM Cipher section.
//
// PR #6 renamed Field Imprints → OM Cipher in-place. This pass replaces
// the renamed card with a full identity section that reserves UI surfaces
// for cipher name, mantra, field pattern, narrative, contemplation,
// gematria source-pattern numbers, activation sequence, and Bhramari
// resonance — with the canonical engine SVG sigil as the visual anchor.
//
// The section's reserved data-* hooks are stable contracts the renderer
// (cuRenderOmCipherSection) writes into; this test pins them so future
// refactors cannot silently strip the surfaces.
//
// Run:  node tests/om-cipher-section-expanded.test.js

'use strict';

const fs = require('fs');
const path = require('path');

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('canonical engine wiring');
ok('engine script tag /sdk/om_cipher.js is loaded',
   /<script\s+src="\/sdk\/om_cipher\.js"\s*><\/script>/.test(src));
ok('cuRenderOmCipherSection function defined',
   /function\s+cuRenderOmCipherSection\s*\(/.test(src));
ok('cuBuildOmCipherInput helper defined',
   /function\s+cuBuildOmCipherInput\s*\(/.test(src));
ok('cuRenderOmCipherSection wired into LP render path',
   /window\.cuRenderOmCipherSection\s*===\s*'function'/.test(src) ||
   /cuRenderOmCipherSection\s*\(\s*sigilPayload\s*,\s*lpBody\s*\)/.test(src));

console.log('\nsection root + header');
ok('section carries data-cu-om-cipher-section hook',
   /data-cu-om-cipher-section="1"/.test(src));
ok('section uses lp-om-cipher-section class',          /lp-om-cipher-section/.test(src));
ok('section keeps lp-om-cipher back-compat class',     /lp-om-cipher\b/.test(src));
ok('section keeps lp-field-imprints back-compat class', /lp-field-imprints\b/.test(src));
ok('aria-label="OM Cipher" preserved',                 /aria-label="OM Cipher"/.test(src));
ok('OM Cipher title (italic Cipher) preserved',        /OM <em>Cipher<\/em>/.test(src));
ok('eyebrow uses "Foundation · Source pattern"',       /Foundation · Source pattern/.test(src));
ok('section lede explains distinction from Living Profile',
   /distinct from Living Profile/i.test(src));
ok('header links to cOMpass Setup (read-only source; no in-page editor)',
   /class="lp-edit-btn lp-om-cipher-edit"[^>]*href="\/compass\?setup=1"/.test(src) &&
   !/data-lp-om-cipher-edit/.test(src));

console.log('\nreserved hero surfaces (cipher name, mantra, field pattern)');
ok('cipher name surface present',                      /data-cu-om-cipher-name\b/.test(src));
ok('cipher name placeholder "Awaiting Compass seal"',  /Awaiting Compass seal/.test(src));
ok('mantra surface present',                           /data-cu-om-cipher-mantra\b/.test(src));
ok('mantra placeholder explains Layer-6/Living-Profile split',
   /Living Profile/.test(src) && /personal mantra/i.test(src));
ok('field pattern surface present',                    /data-cu-om-cipher-field-pattern\b/.test(src));
ok('field pattern placeholder "Pending source data"',  /Pending source data/.test(src));
ok('"Your Field Pattern" eyebrow still rendered',      /Your Field Pattern/.test(src));
ok('"Cipher Name" eyebrow rendered',                   />\s*Cipher Name\s*</.test(src));
ok('"Om Cipher Mantra" eyebrow rendered (Layer 6 — not "Personal Mantra")',
   />\s*Om Cipher Mantra\s*</.test(src) && !/>Personal Mantra</.test(src));

console.log('\nnarrative + contemplation cards');
ok('narrative card present',                           /data-cu-om-cipher-narrative-card/.test(src));
ok('narrative copy hook present',                      /data-cu-om-cipher-narrative\b/.test(src));
ok('"Cipher Story Seed · Archetypal Pattern" eyebrow rendered (not "Personal Story")',
   /Cipher Story Seed/.test(src) && /Archetypal Pattern/.test(src) && !/>Personal Story</.test(src));
ok('contemplation card present',                       /data-cu-om-cipher-contemplation-card/.test(src));
ok('contemplation copy hook present',                  /data-cu-om-cipher-contemplation\b/.test(src));
ok('"Cipher Contemplation" eyebrow rendered (Layer 6, not generic "Contemplation")',
   />\s*Cipher Contemplation\s*</.test(src));

console.log('\ngematria source-pattern grid');
['life_path','expression','soul_urge','personality','lunar_phase','solar_quarter','temporal_gate'].forEach(function (k) {
  ok('gematria slot present: ' + k,
     new RegExp('data-cu-om-cipher-gematria="' + k + '"').test(src));
});
ok('"Source pattern · Pythagorean numerology" block label (Rev 3)',
   /Source pattern[^<]*<span[^>]*>·\s*Pythagorean numerology/.test(src));
ok('no user-facing "Source pattern · gematria" label remains',
   !/Source pattern[^<]*<span[^>]*>·\s*gematria/i.test(src));

console.log('\nactivation sequence + Bhramari surfaces');
ok('activation sequence surface present (hidden hook — Rev 8 dedup)',
   /data-cu-om-cipher-activation\b/.test(src));
// Rev 8: the visible activation lives beside the sigil; the below-sigil
// space now carries the Cipher Seal block instead of a duplicate label.
ok('Cipher seal block header present',                 /Cipher seal/.test(src));
ok('Bhramari surface present',                         /data-cu-om-cipher-bhramari\b/.test(src));
ok('"Bhramari resonance" header present',              /Bhramari resonance/.test(src));

console.log('\ncanonical SVG sigil injection (engine-driven)');
ok('renderer reads rec.sigil_svg into slot',           /rec\.sigil_svg/.test(src));
ok('renderer overwrites slot innerHTML with engine SVG',
   // v1.1: renderer prefers rec.om_cipher_block.layer6.svg (hex sigil)
   // and falls back to rec.sigil_svg via `chosenSvg`. Either path writes
   // into slot.innerHTML deterministically from engine output.
   /slot\.innerHTML\s*=\s*(rec\.sigil_svg|chosenSvg)/.test(src));
ok('renderer tags slot with cu-om-cipher-sigil-rendered marker',
   /cu-om-cipher-sigil-rendered/.test(src));
ok('renderer gated by window.CU_OM_CIPHER_ENABLED',    /window\.CU_OM_CIPHER_ENABLED\s*!==\s*true/.test(src));
ok('canonical sigil only renders when not has-image',  /has-image/.test(src));
ok('old ॐ static glyph remains as fallback in markup', /ॐ/.test(src));

console.log('\ncipher seal display');
ok('cipher seal hash surface present',                 /data-cu-om-cipher-seed\b/.test(src));
ok('renderer paints seed (first 8 + last 4) into seal',
   /rec\.seed[\s\S]*\.slice\(0,\s*8\)/.test(src));

console.log('\nsealed inputs (foundation) grid preserved — read-only');
ok('"Cipher Foundation" block label present (Rev 5: renamed from "Sealed inputs · editable")',
   /Cipher Foundation/.test(src));
ok('lp-foundation-grid still rendered for source data',
   /lp-foundation-grid oc-foundation-grid/.test(src));
// Source-of-truth cleanup: cOMpass Setup is the sole authoritative editor
// for birth date / time / place, so the Cipher Foundation grid is read-only
// (no click-to-edit) and the header links to cOMpass Setup instead.
ok('foundation items are read-only (no data-lp-edit click-to-edit)',
   !/data-lp-edit="foundation"/.test(src));

console.log('\nLayer 6 — deterministic mantra mirror');
ok('renderer reads Layer-6 om_cipher_mantra from engine metadata',
   /om_cipher_mantra/.test(src));
ok('renderer keeps seed_syllable as fallback path',
   /sealed_inputs[\s\S]*seed_syllable/.test(src));

console.log('\nflag gating (default-on, ?om_cipher=0 opt-out in place)');
ok('CU_OM_CIPHER_ENABLED defaults to true',            /window\.CU_OM_CIPHER_ENABLED\s*=\s*true/.test(src));
ok('?om_cipher=0 opt-out path present',                /\[\?&\]om_cipher=0/.test(src));
ok('?bhramari=1 flag init still present',              /\[\?&\]bhramari=1/.test(src));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: OM Cipher expanded section regressions pass.');
}
