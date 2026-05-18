// Living Profile top-right controls spacing regression.
//
// The screenshot of 2026-05-18 showed the glowing info (i) and the
// close (×) sitting almost on top of each other in the top-right of the
// Living Profile modal. Easy to mis-click — close-instead-of-info.
//
// This test pins the CSS so the close button has a dedicated absolute
// position, sits clear of the title row, and the title row carries
// padding-right so the title cannot slide under the close button.
//
// Run:  node tests/living-profile-controls-spacing.test.js

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

console.log('top-right close / info spacing');

// .lp-modal-head .builder-modal-close — absolutely positioned and high
// enough to clear the title row.
const closeRule = /\.lp-modal-head\s+\.builder-modal-close\s*\{[^}]+\}/.exec(src);
ok('.lp-modal-head .builder-modal-close rule present', !!closeRule);
if (closeRule) {
  ok('close is absolutely positioned',  /position:\s*absolute/.test(closeRule[0]));
  ok('close has explicit top offset',    /top:\s*\d/.test(closeRule[0]));
  ok('close has explicit right offset',  /right:\s*\d/.test(closeRule[0]));
  ok('close sits above title row (z-index >= 1)', /z-index:\s*[1-9]/.test(closeRule[0]));
}

// .lp-modal-head .lp-title-row carries padding-right so the (i) sits
// clear of the (×). Otherwise the two glyphs visually overlap.
const titleRowRules = src.match(/\.lp-modal-head\s+\.lp-title-row\s*\{[^}]+\}/g) || [];
const titleRowJoined = titleRowRules.join('\n');
ok('.lp-modal-head .lp-title-row carries padding-right (info clear of close)',
   /padding-right:\s*[3-9]\d/.test(titleRowJoined));

// Mobile: padding-right must still be present so the layout does not
// collapse onto itself on narrow viewports. The mobile rule for the LP
// title row carries an explicit padding-right reset.
ok('mobile preserves padding-right on .lp-modal-head .lp-title-row',
   /@media[^{]*max-width:\s*640px[\s\S]*?\.lp-modal-head\s+\.lp-title-row\s*\{[^}]*padding-right:\s*\d/.test(src));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: Living Profile control-spacing regressions pass.');
}
