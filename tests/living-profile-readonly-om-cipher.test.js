/* living-profile-readonly-om-cipher · regression test
 *
 * Source-of-truth cleanup (Stage 5 hotfix). cOMpass Setup is the SOLE
 * authoritative place to enter / correct OM Cipher source data (birth
 * date / time / place). The Living Profile — reachable from Studio — must
 * display that data read-only and point the member to cOMpass Setup for
 * any edit. It must NOT carry its own editable birthdate field or a
 * click-to-edit popover for the Cipher Foundation source rows, which would
 * be a second authoritative entry point able to fork the profile.
 *
 * Contract under test (static string checks against studio.html):
 *   • the Living Profile OM Cipher "Cipher Foundation" grid is read-only
 *     (no data-lp-edit / role=button / click-to-edit affordance)
 *   • no editable date/birth input lives in the Living Profile
 *   • the old in-page "Edit source" editor (data-lp-om-cipher-edit) is gone
 *   • the OM Cipher header carries a link to cOMpass Setup (/compass?setup=1)
 *   • the cOMpass Setup link does not also toggle the <details> disclosure
 *
 *   Run: node tests/living-profile-readonly-om-cipher.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('1. the Cipher Foundation grid is read-only (no in-page editor)');
ok('foundation items carry no data-lp-edit click-to-edit affordance',
   !/data-lp-edit="foundation"/.test(src));
ok('the old "Edit source" in-page editor (data-lp-om-cipher-edit) is gone',
   !/data-lp-om-cipher-edit/.test(src) && !/>Edit source</.test(src));

console.log('\n2. no editable date/birth input in the Living Profile');
// The Living Profile is built from JS template strings inside studio.html.
// No birth date / time / place <input> should be emitted into that markup.
const lpInputs = src.match(/<input[^>]*(?:id|name|class)="[^"]*(?:birth|dob|tob|pob)[^"]*"[^>]*>/gi) || [];
ok('no birth/dob/tob/pob <input> emitted anywhere in studio.html', lpInputs.length === 0);

console.log('\n3. the OM Cipher header links to cOMpass Setup as the editor');
ok('header carries a cOMpass Setup link (an <a>, not a button)',
   /class="lp-edit-btn lp-om-cipher-edit"[^>]*href="\/compass\?setup=1"/.test(src));
ok('the link is labelled for cOMpass Setup',
   /lp-om-cipher-edit"[^>]*aria-label="Edit OM Cipher details in cOMpass Setup"/.test(src));
ok('the foundation helper copy points to cOMpass Setup too',
   /oc-foundation-setup-link" href="\/compass\?setup=1"/.test(src));

console.log('\n4. the cOMpass Setup link does not toggle the <details> disclosure');
// The link sits inside the <summary>, so its click must stopPropagation
// to avoid collapsing/expanding the OM Cipher details by accident.
ok('cOMpass Setup link click stops propagation',
   /omCipherEditLink[\s\S]*?addEventListener\('click'[\s\S]*?stopPropagation/.test(src));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: Living Profile read-only OM Cipher regressions pass.');
}
