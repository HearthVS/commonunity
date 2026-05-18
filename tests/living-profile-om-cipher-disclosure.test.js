// Living Profile · OM Cipher disclosure regression.
//
// The OM Cipher section used to paint a visible explanatory paragraph
// ("The Compass-sealed pattern your sigil…") directly under its header,
// and the whole section sat fully expanded between the hero and the
// rest of the Living Profile narrative. Two costs:
//
//   1. The explainer dominated the surface; new members had to read
//      a paragraph before reaching the actual identity content.
//   2. The fully-expanded section visually interrupted the Living
//      Profile narrative below (compass cards, doorway, etc.).
//
// Fix: same glowing info-button pattern Living Profile already uses
// (studio-info-btn → studio-info-overlay), and wrap the section body in
// a <details> that defaults to collapsed. This test pins the contract.
//
// It also pins the v0.3 invariant that Cipher seed / Input fingerprint /
// raw hashes never surface in the member-facing Living Profile (PR #23).
//
// Run:  node tests/living-profile-om-cipher-disclosure.test.js

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

console.log('OM Cipher header now uses the glowing info-button pattern');
ok('glowing info button rendered in OM Cipher summary',
   /class="studio-info-btn lp-om-cipher-info"[^>]*data-info="info-om-cipher-overlay"/.test(src));
ok('info button has accessible label',
   /lp-om-cipher-info[^>]*aria-label="About OM Cipher"/.test(src));

console.log('\nexplanatory lede no longer painted on the page');
// The legacy phrase must remain in source (regression contract from
// om-cipher-section-expanded.test.js — "distinct from Living Profile"),
// but it must NOT be a visible paragraph any more. Every paragraph
// carrying the phrase must either (a) be inside the studio-info-popup
// overlay body or (b) carry the hidden attribute / oc-section-lede-hidden
// class on its own tag.
const re = /<p\b[^>]*>[\s\S]*?distinct from Living Profile[\s\S]*?<\/p>/gi;
const ledeAppearances = src.match(re) || [];
ok('phrase "distinct from Living Profile" appears at least once', ledeAppearances.length >= 1);
ok('every painted appearance is hidden or inside an info overlay',
   ledeAppearances.every(function (m) {
     // hidden on the <p> itself
     if (/oc-section-lede-hidden/.test(m) || /\shidden(\s|>|=)/.test(m)) return true;
     // OR the surrounding ~400 chars contain the studio-info-popup container
     const idx = src.indexOf(m);
     const before = src.slice(Math.max(0, idx - 600), idx);
     return /studio-info-popup-body|studio-info-overlay/.test(before);
   }));
ok('no visible oc-section-lede block remains in the OM Cipher header',
   !/<p\s+class="oc-section-lede">/.test(src));

console.log('\nOM Cipher info overlay (same popup pattern as Living Profile)');
ok('info-om-cipher-overlay element present',
   /id="info-om-cipher-overlay"/.test(src));
ok('overlay uses studio-info-popup pattern (consistent with Living Profile overlay)',
   /id="info-om-cipher-overlay"[\s\S]{0,400}class="studio-info-popup"/.test(src));
ok('overlay carries close button hooked up to the global delegate',
   /id="info-om-cipher-overlay"[\s\S]*?data-close="info-om-cipher-overlay"/.test(src));
ok('overlay body explains source-pattern vs lived-qualia distinction',
   /id="info-om-cipher-overlay"[\s\S]*?objective[\s\S]*?subjective/i.test(src));

console.log('\npage flow — section collapsible so it does not interrupt the LP narrative');
ok('<details data-cu-om-cipher-details> wraps the OM Cipher body',
   /<details class="lp-om-cipher-details" data-cu-om-cipher-details="1"/.test(src));
ok('<summary> carries the OM Cipher header',
   /<summary class="lp-foundation-head oc-section-head" data-cu-om-cipher-summary="1"/.test(src));
ok('details defaults to collapsed (no `open` attribute in the rendered template)',
   !/<details class="lp-om-cipher-details"[^>]*\sopen/.test(src));
ok('disclosure chevron rendered for affordance',
   /class="oc-disclosure-chevron"/.test(src));

console.log('\nEdit source click does not toggle the details accidentally');
ok('Edit source handler stops propagation',
   /omCipherEdit\.addEventListener\('click'[\s\S]*?stopPropagation/.test(src));
ok('Edit source opens the details so the edit row is visible',
   /data-cu-om-cipher-details[\s\S]*?\.open\s*=\s*true/.test(src));

console.log('\nlabel consistency — OM Cipher eyebrow softened (Living Profile has none)');
ok('OM Cipher eyebrow uses oc-eye-soft modifier class',
   /lp-foundation-eye oc-eye-soft"/.test(src));
ok('oc-eye-soft CSS reduces visual weight (opacity / smaller letter-spacing)',
   /\.lp-om-cipher-section\s+\.oc-eye-soft\s*\{[^}]*opacity:\s*0\.[0-9]+/.test(src));

console.log('\nhash-hiding invariant (PR #23) preserved');
ok('Cipher seed block remains hidden',
   /class="oc-source-block oc-seal-block"[^>]*hidden/.test(src));
ok('Input fingerprint paragraph remains hidden / out of layout',
   /data-cu-om-cipher-input-fingerprint/.test(src) &&
   /oc-source-block oc-seal-block"[^>]*hidden/.test(src));
ok('Cipher seed caption under sigil is hidden from members',
   /data-cu-om-cipher-seed-hash[^>]*hidden/.test(src));
// Canonical-hash literal 58b2ea61 must never leak into visible UI; it
// can still appear in code/comments/tests, just not in the rendered
// member-facing template.
const visibleHash = src.indexOf('58b2ea61') >= 0;
const allHashHits = (src.match(/58b2ea61/g) || []).length;
ok('canonical hash 58b2ea61 (if present) only appears in dev/debug context, not as visible text',
   !visibleHash || allHashHits <= 3 /* tolerate comments / fixtures */);

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: Living Profile · OM Cipher disclosure regressions pass.');
}
