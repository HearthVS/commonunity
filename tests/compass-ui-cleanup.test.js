/* compass-ui-cleanup · regression test
 *
 * cOMpass UI cleanup from a live/screenshot review:
 *   1. The Beta Feedback launcher and the Nexus orb were both pinned to the
 *      bottom-RIGHT and competed for space. The feedback launcher now lives on
 *      the LEFT (bottom-left), clear of the Nexus orb.
 *   2. The Nexus orb was a discreet, easy-to-miss corner glyph. It now carries a
 *      visible "Nexus" text label beside the glyph.
 *   3. The top toolbar no longer needs a "Hexagram Reader" entry point (it is
 *      clear in the workflow, embedded beside the Field Notes). The toolbar
 *      button + its now-unused openHexReader() handler are removed — but the
 *      embedded reader panels are untouched.
 *
 * Static-assertion test over index.html (no DOM boot).
 *
 *   Run: node tests/compass-ui-cleanup.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

console.log('1. Beta Feedback launcher moved to the LEFT (clear of the Nexus orb)');
// The widget container is anchored bottom-left, not bottom-right.
const widgetBlock = (src.match(/#cu-feedback-widget\s*\{[\s\S]*?\}/g) || []).join('\n');
ok('#cu-feedback-widget is anchored left (left: 24px)',
   /left:\s*24px/.test(widgetBlock));
ok('#cu-feedback-widget is no longer anchored right',
   !/#cu-feedback-widget\s*\{[\s\S]*?right:\s*\d/.test(src));
ok('the feedback panel opens from the left edge (left: 0)',
   /#cu-fb-panel\s*\{[\s\S]*?left:\s*0/.test(src));
ok('the feedback tooltip sits to the right of the trigger (left: 54px)',
   /#cu-fb-tooltip\s*\{[\s\S]*?left:\s*54px/.test(src));
ok('no stale right-anchored tooltip remains',
   !/#cu-fb-tooltip\s*\{[\s\S]*?right:\s*54px/.test(src));

console.log('\n2. Nexus orb carries a visible "Nexus" text label');
ok('orb markup includes a .compass-nexus-orb-label reading "Nexus"',
   /<span class="compass-nexus-orb-label">\s*Nexus\s*<\/span>/.test(src));
ok('the SVG glyph is wrapped in a .compass-nexus-orb-glyph span',
   /<span class="compass-nexus-orb-glyph">/.test(src));
ok('.compass-nexus-orb-label has styling',
   /\.compass-nexus-orb-label\s*\{/.test(src));
ok('the orb stays bottom-right (does not collide with the left feedback launcher)',
   /\.compass-nexus-orb\s*\{[\s\S]*?right:\s*24px/.test(src));
ok('the orb keeps its hold-to-open affordance',
   /id="compass-nexus-orb"[\s\S]{0,160}aria-label="Nexus/.test(src));

console.log('\n3. top toolbar Hexagram Reader entry point removed');
ok('no #btn-read-gene-key toolbar button remains',
   !/id="btn-read-gene-key"/.test(src));
ok('the now-unused openHexReader() handler is removed',
   !/function openHexReader\b/.test(src));
ok('no stray openHexReader() references remain',
   !/openHexReader\s*\(/.test(src));
const actionsStart = src.indexOf('class="compass-actions"');
const actionsEnd = src.indexOf('class="compass-tabs"', actionsStart);
const actionsSlice = src.slice(actionsStart, actionsEnd);
ok('the compass toolbar carries no "Hexagram Reader" label',
   actionsStart > 0 && actionsEnd > actionsStart && !actionsSlice.includes('Hexagram Reader'));

console.log('\n4. embedded Hexagram Reader panels are untouched (still beside Field Notes)');
const readers = (src.match(/class="hex-reader" data-hex-reader="/g) || []).length;
ok('four embedded .hex-reader blocks remain (one per room)', readers === 4);
const wrappers = (src.match(/class="notes-with-reader"/g) || []).length;
ok('four .notes-with-reader wrappers remain (reader beside the notes)', wrappers === 4);
const unlockBtns = (src.match(/class="hex-reader-unlock-btn" data-hex-action="unlock-show"/g) || []).length;
ok('four reader unlock controls remain', unlockBtns === 4);
const pwInputs = (src.match(/type="password" class="hex-reader-code-input"/g) || []).length;
ok('four activation-code inputs remain (type="password")', pwInputs === 4);
ok('each embedded reader keeps its own "Hexagram Reader" locked label',
   (src.match(/hex-reader-locked-label[\s\S]{0,80}Hexagram Reader/g) || []).length === 4);

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: cOMpass UI cleanup regressions pass.');
}
