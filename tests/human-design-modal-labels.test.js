/* Modal-label honesty regression for the Human Design section.
 *
 * After the bodygraph engine landed, ALL Human Design fields are
 * calculated locally from birth date + time. The OM Cipher modal in
 * index.html must:
 *
 *   1. NOT carry the legacy "requires bodygraph" wording anywhere
 *      under the Human Design card.
 *   2. Use precise per-field states such as "calculated from birth
 *      date + time" so the user understands the dependency.
 *   3. Load sdk/human_design.js (the calculation engine) so the
 *      browser actually has the code available.
 *
 * Run:  node tests/human-design-modal-labels.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const indexSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'), 'utf8'
);
const studioSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'studio.html'), 'utf8'
);

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('\nModal labels · HD engine landed — legacy wording is gone');
assert(!/requires bodygraph/i.test(indexSrc),
  'no "requires bodygraph" wording remains in index.html');

// Type, Strategy, Authority, Profile, Incarnation Cross all advertise
// the new "calculated from birth date + time" wording.
const hdSection = (function () {
  const start = indexSrc.indexOf('Human Design');
  const end   = indexSrc.indexOf('Tropical Astrology');
  return indexSrc.slice(start, end);
})();
['profile-hd-profile', 'profile-hd-type', 'profile-hd-strategy',
 'profile-hd-authority', 'profile-hd-cross'].forEach(function (id) {
  const idx = hdSection.indexOf('id="' + id + '"');
  assert(idx >= 0, 'HD input id="' + id + '" lives in the Human Design card');
});
assert(/calculated from birth date \+ time/.test(hdSection),
  'HD card uses the "calculated from birth date + time" precision label');

// Both index.html and studio.html load sdk/human_design.js so the
// engine is available to the OM Cipher pipeline on either surface.
assert(/<script[^>]+sdk\/human_design\.js/.test(indexSrc),
  'index.html loads /sdk/human_design.js');
assert(/<script[^>]+sdk\/human_design\.js/.test(studioSrc),
  'studio.html loads /sdk/human_design.js');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: HD modal-label honesty regressions pass.');
