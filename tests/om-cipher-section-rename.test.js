// Static-source regression test for the OM Cipher section rename.
//
// Verifies that:
//   1. Section heading reads "OM Cipher" (was "Field Imprints").
//   2. "Your Field Pattern" subtitle is present.
//   3. The new `lp-om-cipher` class is applied alongside the
//      backward-compat `lp-field-imprints` class.
//   4. Source-data aliases are read for canonical OM Cipher input
//      shapes: legal_name / preferred_name (name), birth_date,
//      birth_time, birth_place. Older JSON aliases (birthdate, dob,
//      birthplace, pob) still work.
//   5. The OM Cipher source data is read-only; the header carries a
//      link to cOMpass Setup (the sole authoritative editor) rather
//      than an in-page "Edit source" editor.
//   6. The OM Cipher section carries a distinct background treatment
//      (the .lp-om-cipher rule) so it reads as adjacent-but-distinct
//      from the Living Profile foundation card.
//   7. No user-facing "numerology" copy remains in studio.html
//      (engine-side internal constants are out of scope here).
//
// Usage:  node tests/om-cipher-section-rename.test.js
'use strict';

const fs = require('fs');
const path = require('path');

const studioPath = path.resolve(__dirname, '..', 'studio.html');
const src = fs.readFileSync(studioPath, 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) { console.log('  ok  ' + msg); }
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('heading + subtitle');
ok('OM Cipher title rendered (italic Cipher)',          /OM <em>Cipher<\/em>/.test(src));
ok('"Your Field Pattern" subtitle present',             /Your Field Pattern/.test(src));
ok('old "Field Imprints" title removed',                !/Field <em>Imprints<\/em>/.test(src));
ok('lp-om-cipher class applied',                        /lp-om-cipher/.test(src));
ok('lp-field-imprints class retained (back-compat)',    /lp-field-imprints/.test(src));
ok('aria-label updated to "OM Cipher"',                 /aria-label="OM Cipher"/.test(src));

console.log('\nsource-data aliases (engine-canonical input)');
ok('name resolver accepts legal_name',                  /p\.legal_name/.test(src));
ok('name resolver accepts preferred_name',              /p\.preferred_name/.test(src));
ok('foundation builder accepts birth_date',             /p\.birth_date/.test(src));
ok('foundation builder accepts birth_time',             /p\.birth_time/.test(src));
ok('foundation builder accepts birth_place',            /p\.birth_place/.test(src));
ok('foundation block fallback for birth_date',          /foundationBlock\.birth_date/.test(src));
ok('foundation block fallback for birth_place',         /foundationBlock\.birth_place/.test(src));

console.log('\nbackward-compatible fallbacks still in place');
['p.birthdate', 'p.dob', 'p.birthplace', 'p.pob',
 'foundationBlock.birthdate', 'foundationBlock.pob',
 'cd.dob', 'bd.dob'].forEach(function (n) {
  ok('still reads ' + n, src.indexOf(n) !== -1);
});

console.log('\ncOMpass Setup link (read-only source) + birth_time label');
ok('header carries cOMpass Setup link (not an in-page editor)',
  /class="lp-edit-btn lp-om-cipher-edit"[^>]*href="\/compass\?setup=1"/.test(src));
ok('old "Edit source" in-page editor affordance is gone',
  !/data-lp-om-cipher-edit/.test(src) && !/>Edit source</.test(src));
ok('labelMap has birth_time entry',                     /birth_time:\s*'Birth time'/.test(src));

console.log('\nvisual differentiation (subtle, not a redesign)');
ok('.lp-om-cipher CSS rule present',                    /\.lp-om-cipher\s*\{/.test(src));

console.log('\nterminology / Pythagorean numerology');
ok('gematria function name preserved',                  /function gematria\(/.test(src));
// Per Om Cipher revision notes (Revision 3): the user-facing source-
// pattern label uses "Pythagorean numerology" (the actual derivation
// system used). Gematria is reserved for Hebrew-letter sub-layers if
// ever added — not the default Om Cipher source-pattern term.
ok('source-pattern label reads "Pythagorean numerology"',
   /Source pattern[\s\S]{0,60}Pythagorean numerology/i.test(src));
ok('no user-facing "Source pattern · gematria" copy',
   !/Source pattern[\s\S]{0,60}gematria/i.test(src.replace(/data-cu-om-cipher-gematria[^"']*/g, '')));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: OM Cipher section rename regressions pass.');
}
