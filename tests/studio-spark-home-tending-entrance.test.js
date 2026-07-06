/* Static test: Studio Spark as the guided hOMe-tending threshold.
 *
 * Urgent fix #3 — the Studio Spark entrance did not read as the front
 * door into Studio's creative pipeline. This slice reframes the
 * Oṁ Field · Studio Spark widget as a guided threshold: it names
 * Personal Home as the *first* creation / milestone inside Studio,
 * states that Home is seeded from Compass + Living Profile (+ palette)
 * rather than blank, and presents Work / Lens / Field / Call as the
 * four orientations of *tending* (not file/task categories).
 *
 * Covers:
 *   1. A .spark-threshold framing block exists in the widget body with
 *      an eyebrow + lede, and scoped CSS that leans on shared tokens.
 *   2. Copy names Home as the first creation/milestone in Studio, the
 *      Compass + Living Profile + palette seeding, and Studio as the
 *      ongoing workspace beyond Home.
 *   3. All four orientations (Work / Lens / Field / Call) are presented
 *      with the approved tending meanings.
 *   4. No file-manager / task-manager language is introduced, and the
 *      copy-locked foot substrings from #119-#120 survive.
 *
 * Static/DOM assertions over the studio.html markup; no server required.
 *
 * Usage:  node tests/studio-spark-home-tending-entrance.test.js
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

// ---------------------------------------------------------------------------
// 1) Threshold framing block + scoped CSS.
// ---------------------------------------------------------------------------
console.log('spark-threshold framing block exists with scoped CSS');

const blockRe = /<div class="spark-threshold">[\s\S]*?<\/div>/;
const blockMatch = src.match(blockRe);
assert(blockMatch !== null, '.spark-threshold block present in the widget body');
const block = blockMatch ? blockMatch[0] : '';

assert(/class="spark-threshold-eyebrow"/.test(block), 'threshold eyebrow present');
assert(/class="spark-threshold-lede"/.test(block), 'threshold lede present');

const cssRe = /\.spark-threshold\s*\{([^}]*)\}/;
const css = src.match(cssRe);
assert(css !== null, '.spark-threshold rule exists');
assert(css !== null && /--rose-color/.test(css[1]),
  '.spark-threshold tints from the shared --rose-color token');
assert(/\.spark-orient-item\.is-work\s*\{[^}]*--work/.test(src),
  'orientation items reuse the shared room color tokens (--work etc.)');

// ---------------------------------------------------------------------------
// 2) Home-as-first-milestone + seeding + ongoing Studio copy.
// ---------------------------------------------------------------------------
console.log('copy frames Home as first Studio creation, seeded, with Studio ongoing');

assert(/first creation in Studio/.test(block),
  'copy names Personal Home as the first creation in Studio');
assert(/Compass, Living Profile and palette/.test(block),
  'copy names the Compass + Living Profile + palette seeding');
assert(/never a blank page/.test(block),
  'copy asserts Home is seeded, not a blank page');
assert(/Studio stays open/.test(block),
  'copy frames Studio as staying open / ongoing beyond Home');

// ---------------------------------------------------------------------------
// 3) Work / Lens / Field / Call presented as tending orientations.
// ---------------------------------------------------------------------------
console.log('four orientations present with tending meanings');

const orientRe = /<ul class="spark-orient"[\s\S]*?<\/ul>/;
const orientMatch = block.match(orientRe);
assert(orientMatch !== null, '.spark-orient legend present');
const orient = orientMatch ? orientMatch[0] : '';

[['Work', /Work<\/span>[\s\S]*?structure, sections and rooms/],
 ['Lens', /Lens<\/span>[\s\S]*?voice, meaning and resonance/],
 ['Field', /Field<\/span>[\s\S]*?observations, lived material and notes/],
 ['Call', /Call<\/span>[\s\S]*?invitation, audience and purpose/]
].forEach(function (pair) {
  assert(pair[1].test(orient),
    'orientation "' + pair[0] + '" is present with its tending meaning');
});

// ---------------------------------------------------------------------------
// 4) Vocabulary guard + preserved foot substrings.
// ---------------------------------------------------------------------------
console.log('no file/task-manager language; foot copy contract preserved');

const surface = block + (css ? css[0] : '');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(surface),
  'no file-manager language in the threshold surface');
assert(!/(task manager|to-?do|checklist|task list)/i.test(surface),
  'no task-manager language in the threshold surface');

const footRe = /<p class="om-widget-foot">[\s\S]*?<\/p>/;
const footMatch = src.match(footRe);
const foot = footMatch ? footMatch[0] : '';
assert(/tending your Personal Home/.test(foot),
  'foot copy still frames tending the Personal Home (#120 contract)');
assert(/Field Observations/.test(foot), 'foot copy still points to Field Observations');
assert(/Nexus/.test(foot), 'foot copy preserves the Nexus availability note');
assert(/first milestone in Studio/.test(foot),
  'foot copy now names Home as the first milestone in Studio');

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Studio Spark hOMe-tending entrance test passed.');
