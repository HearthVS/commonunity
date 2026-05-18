// User-facing label regressions for the Om Cipher panel (Revision 2,
// 3, 5, 7, 8, 9, 10).
//
// Pins the canonical label copy in studio.html so the panel keeps using
// the corrected terminology after the post-build audit.
//
// Run:  node tests/om-cipher-ui-labels.test.js

'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'studio.html'), 'utf8');

let failed = 0;
function ok(label, cond) {
  if (cond) { console.log('  ok  ' + label); }
  else      { console.error('  FAIL ' + label); failed++; }
}

console.log('Revision 2 — Layer 6 contemplative-output labels');
ok('"Om Cipher Mantra" eyebrow present',
   />\s*Om Cipher Mantra\s*</.test(src));
ok('no user-facing "Personal Mantra" label',
   !/>\s*Personal Mantra\s*</.test(src));
ok('"Cipher Story Seed · Archetypal Pattern" eyebrow present',
   /Cipher Story Seed/.test(src) && /Archetypal Pattern/.test(src));
ok('no user-facing "Personal Story" label',
   !/>\s*Personal Story\s*</.test(src));
ok('"Cipher Contemplation" eyebrow present (not generic Contemplation)',
   />\s*Cipher Contemplation\s*</.test(src));

console.log('\nRevision 3 — Pythagorean numerology (not Gematria)');
ok('Source pattern label uses "Pythagorean numerology"',
   /Source pattern[\s\S]{0,80}Pythagorean numerology/i.test(src));
ok('Source pattern label does NOT use "gematria" sub-label',
   !/Source pattern[\s\S]{0,60}<span[^>]*>·\s*gematria/i.test(src));

console.log('\nRevision 5 — Cipher Foundation (not "SEALED INPUTS · EDITABLE")');
ok('"Cipher Foundation" block label present',
   /Cipher Foundation/.test(src));
ok('contradictory "Sealed inputs · editable" label removed',
   !/Sealed inputs\s*<span[^>]*>·\s*editable/i.test(src));
ok('helper text points users to Compass for source-data corrections',
   /re-enter it in Compass/i.test(src));

console.log('\nRevision 7 — Bhramari · from Living Profile');
ok('Bhramari header reads "Bhramari resonance · from Living Profile"',
   /Bhramari resonance\s*<span[^>]*>·\s*from Living Profile/i.test(src));

console.log('\nRevision 8 — duplicate activation removed below sigil');
ok('below-sigil block is now the Cipher seed block (not a 2nd activation header)',
   /oc-seal-block/.test(src));

console.log('\nRevision 13 — technical hashes hidden from default UI');
// The Cipher seed (short caption + full 64-char hash) and Input
// fingerprint are confusing and irrelevant for member-facing use, so
// they are hidden from the default Living Profile / OM Cipher panel.
// The elements remain in the DOM so the renderer can still populate
// data-* attributes for debugging/provenance.
ok('sigil caption "Cipher seed:" line is hidden by default (hidden attribute)',
   /data-cu-om-cipher-seed-hash[^>]*\bhidden\b/.test(src));
ok('sigil caption "Cipher seed:" line is hidden by default (display:none)',
   /data-cu-om-cipher-seed-hash[^>]*display:\s*none/i.test(src));
ok('oc-seal-block (Cipher seed + Input fingerprint surfaces) is hidden by default',
   /oc-seal-block[^>]*\bhidden\b/.test(src) ||
   /oc-source-block[^"]*oc-seal-block[^>]*\bhidden\b/.test(src));
ok('oc-seal-block uses display:none so it never paints in the UI',
   /oc-seal-block[^>]*display:\s*none/i.test(src));

console.log('\nRevision 13 — internal data preserved for debugging');
// Even though the surfaces are hidden, the renderer still writes the
// canonical seed and input fingerprint to data attributes on the same
// elements so debugging tools (and downstream consumers) can read them.
ok('renderer still wires clipboard copy / seed-full data attribute on the seed element',
   /navigator\.clipboard/.test(src) && /data-cu-om-cipher-seed-full/.test(src));
ok('full 64-char seed hash surface still present in DOM (for debugging)',
   /data-cu-om-cipher-seal-full/.test(src));
ok('input fingerprint surface still present in DOM (for debugging)',
   /data-cu-om-cipher-input-fingerprint(?:\b|")/.test(src));
ok('renderer still paints rec.input_hash into the input fingerprint surface',
   /data-cu-om-cipher-input-fingerprint[\s\S]{0,400}rec\.input_hash/.test(src));

console.log('\nRevision 10 — temporal gate label uses local birth time');
ok('engine temporal_gate label uses "local birth time" wording',
   /local birth time/.test(fs.readFileSync(path.join(__dirname, '..', 'sdk', 'om_cipher.js'), 'utf8')) &&
   /local birth time/.test(fs.readFileSync(path.join(__dirname, '..', 'om_cipher_engine.py'), 'utf8')));
ok('engine temporal_gate label no longer mentions UTC',
   !/temporal_gate[\s\S]{0,200}UTC\)/.test(fs.readFileSync(path.join(__dirname, '..', 'sdk', 'om_cipher.js'), 'utf8')));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: OM Cipher UI label regressions pass.');
}
