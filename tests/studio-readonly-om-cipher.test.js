/* studio-readonly-om-cipher · regression test
 *
 * Source-of-truth cleanup: cOMpass Setup is the authoritative place to enter
 * and correct OM Cipher / birth data. Studio must be a read-only CONSUMER of
 * that profile — it must not carry its own birthdate editor or an authoritative
 * "recalculate" control that could fork the profile.
 *
 * The contract under test (static string checks against studio.html):
 *   • the Studio entrance birthdate editor (DOB/TOB/POB inputs + the
 *     "Activate my profile" calculate button) is gone
 *   • the competing authoritative writer studioCalcGeneKeys() is gone
 *   • a read-only OM Cipher renderer exists and reads from the shared compass
 *     profile (state.compassData.points), never from a Studio birthdate input
 *   • the entrance shows a clear link to cOMpass Setup
 *
 *   Run: node tests/studio-readonly-om-cipher.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const studio = fs.readFileSync(path.join(root, 'studio.html'), 'utf8');

let pass = 0;
function ok(cond, label) {
  assert(cond, label);
  console.log('  ok  ' + label);
  pass++;
}

console.log('1. the Studio birthdate editor is removed');
ok(!/id="studio-dob"/.test(studio), 'no date-of-birth input in Studio');
ok(!/id="studio-tob"/.test(studio), 'no time-of-birth input in Studio');
ok(!/id="studio-pob"/.test(studio), 'no place-of-birth input in Studio');
ok(!/id="studio-calc-btn"/.test(studio),
   'no "Activate my profile" calculate button in Studio');
ok(!/Activate my profile/.test(studio),
   'the "Activate my profile" label is gone');

console.log('\n2. the competing authoritative recalculation is removed');
ok(!/function studioCalcGeneKeys\(/.test(studio),
   'studioCalcGeneKeys() (the Studio-side birthdate writer) is gone');
// No Studio code path may write the room Gene Keys from a birthdate calc.
ok(!/state\.compassData\.points\.work\.gk_num\s*=\s*String\(csResult/.test(studio),
   'Studio no longer writes compassData room gk_num from a local calc');

console.log('\n3. Studio renders the OM Cipher read-only from the shared profile');
ok(/function studioRenderCipherReadonly\(/.test(studio),
   'a read-only OM Cipher renderer exists');
ok(/function studioCipherReadonlyPoints\(/.test(studio),
   'a helper resolves display points from existing state');
const reader = (studio.match(/function studioCipherReadonlyPoints[\s\S]*?\n}\n/) || [''])[0];
ok(/state\.compassData\s*&&\s*state\.compassData\.points/.test(reader),
   'the read-only points come from state.compassData.points (cOMpass profile)');
// initStudioCalculator must call the read-only render, not bind a calc button.
const initFn = (studio.match(/function initStudioCalculator[\s\S]*?\n}\n/) || [''])[0];
ok(/studioRenderCipherReadonly\(\)/.test(initFn),
   'the entrance init renders the read-only OM Cipher');
ok(!/studioCalcGeneKeys/.test(initFn),
   'the entrance init no longer binds the calculate handler');

console.log('\n4. Studio points the user to cOMpass Setup as the authoritative editor');
ok(/Edit OM Cipher details in cOMpass Setup/.test(studio),
   'a clear "Edit OM Cipher details in cOMpass Setup" link exists');
ok(/id="studio-cipher-edit-link"[\s\S]{0,80}href="\/compass\?setup=1"/.test(studio) ||
   /href="\/compass\?setup=1"[\s\S]{0,80}id="studio-cipher-edit-link"/.test(studio),
   'the link deep-links to cOMpass setup (/compass?setup=1)');
ok(/id="studio-cipher-empty"/.test(studio),
   'an empty-state message is shown when no OM Cipher exists yet');

console.log(`\n${pass} passed`);
