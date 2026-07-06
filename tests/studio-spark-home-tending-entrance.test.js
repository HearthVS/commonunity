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
 * Density pass (progressive disclosure) — the full Muse orientation copy
 * (lede + four descriptive orientations) is valuable for a first visitor
 * but repeats on every draw, so it now lives inside a collapsed
 * `<details class="spark-about">` disclosure. The primary state keeps a
 * compact one-line room legend instead of the descriptive block.
 *
 * Covers:
 *   1. A .spark-threshold framing block exists with an eyebrow, and the
 *      orientation copy (lede + legend) lives behind the collapsed
 *      .spark-about disclosure — not as primary repeated real-estate.
 *   2. Copy names Home as the first creation/milestone in Studio, the
 *      Compass + Living Profile + palette seeding, and Studio as the
 *      ongoing workspace beyond Home (inside the disclosure).
 *   3. All four orientations (Work / Lens / Field / Call) survive with
 *      the approved tending meanings inside the disclosure, and a compact
 *      one-line legend keeps the four rooms visible in the primary state.
 *   4. No file-manager / task-manager language is introduced, and the
 *      foot copy is a single concise muse line (not the old explainer).
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
// 1) Threshold framing block + collapsed orientation disclosure.
// ---------------------------------------------------------------------------
console.log('spark-threshold framing block exists with a collapsed About disclosure');

// The threshold block spans from its opening div to the disc wrap that
// follows it — this captures the eyebrow, the disclosure and the compact
// room legend without depending on inner </div> nesting.
const blockRe = /<div class="spark-threshold">[\s\S]*?<div class="om-widget-disc-wrap">/;
const blockMatch = src.match(blockRe);
assert(blockMatch !== null, '.spark-threshold block present in the widget body');
const block = blockMatch ? blockMatch[0] : '';

assert(/class="spark-threshold-eyebrow"/.test(block), 'threshold eyebrow present in primary state');

// The long lede + descriptive legend are behind progressive disclosure.
assert(/<details class="spark-about">/.test(block),
  'orientation copy lives inside a .spark-about disclosure');
assert(/class="spark-about-summary"/.test(block),
  'disclosure exposes a summary for first-visitor orientation');
// The disclosure defaults collapsed (no `open` attribute) so repeated
// users are not shown the full explainer on every draw.
assert(/<details class="spark-about">\s*<summary/.test(block),
  'the About disclosure is collapsed by default (no open attribute)');

const cssRe = /\.spark-threshold\s*\{([^}]*)\}/;
const css = src.match(cssRe);
assert(css !== null, '.spark-threshold rule exists');
assert(css !== null && /--rose-color/.test(css[1]),
  '.spark-threshold tints from the shared --rose-color token');
assert(/\.spark-orient-item\.is-work\s*\{[^}]*--work/.test(src),
  'orientation items reuse the shared room color tokens (--work etc.)');

// Layout: the threshold sits full-width at the top of the widget body, so the
// disc + content row below keeps its width. Without this the flex-row body lays
// threshold | disc | content out in three columns, squeezing #spark-prompt into
// a sliver that wraps one word per line and overflows the card.
assert(css !== null && /flex-basis:\s*100%/.test(css[1]),
  '.spark-threshold spans the full first row (flex-basis: 100%)');
const bodyCss = src.match(/\.om-widget-body\s*\{([^}]*)\}/);
assert(bodyCss !== null && /flex-wrap:\s*wrap/.test(bodyCss[1]),
  '.om-widget-body wraps so disc + content drop below the threshold');

// ---------------------------------------------------------------------------
// 2) Home-as-first-milestone + seeding + ongoing Studio copy (in disclosure).
// ---------------------------------------------------------------------------
console.log('orientation copy frames Home as first Studio creation, seeded, Studio ongoing');

const aboutRe = /<details class="spark-about">[\s\S]*?<\/details>/;
const aboutMatch = block.match(aboutRe);
assert(aboutMatch !== null, '.spark-about disclosure block isolated');
const about = aboutMatch ? aboutMatch[0] : '';

assert(/class="spark-threshold-lede"/.test(about),
  'the long Muse lede lives inside the disclosure, not the primary card');
assert(/first creation in Studio/.test(about),
  'copy names Personal Home as the first creation in Studio');
assert(/Compass, Living Profile and palette/.test(about),
  'copy names the Compass + Living Profile + palette seeding');
assert(/never a blank page/.test(about),
  'copy asserts Home is seeded, not a blank page');
assert(/Studio stays open/.test(about),
  'copy frames Studio as staying open / ongoing beyond Home');

// The long lede must NOT be primary (outside-the-disclosure) copy.
const primaryOnly = block.replace(aboutRe, '');
assert(!/creative muse of stUdio/.test(primaryOnly),
  'the full Muse paragraph is not primary visible copy');

// ---------------------------------------------------------------------------
// 3) Work / Lens / Field / Call — descriptive legend in disclosure, compact
//    one-line legend in the primary state.
// ---------------------------------------------------------------------------
console.log('four orientations preserved; compact room legend in primary state');

const orientRe = /<ul class="spark-orient"[\s\S]*?<\/ul>/;
const orientMatch = about.match(orientRe);
assert(orientMatch !== null, '.spark-orient descriptive legend present inside the disclosure');
const orient = orientMatch ? orientMatch[0] : '';

[['Work', /Work<\/span>[\s\S]*?structure, sections and rooms/],
 ['Lens', /Lens<\/span>[\s\S]*?voice, meaning and resonance/],
 ['Field', /Field<\/span>[\s\S]*?observations, lived material and notes/],
 ['Call', /Call<\/span>[\s\S]*?invitation, audience and purpose/]
].forEach(function (pair) {
  assert(pair[1].test(orient),
    'orientation "' + pair[0] + '" is present with its tending meaning');
});

// The descriptive legend is NOT a large repeated block in the primary state.
assert(!/class="spark-orient-item/.test(primaryOnly),
  'the descriptive orientation legend is not repeated in the primary state');

// A compact one-line room legend keeps the four concepts visible.
const lineRe = /<p class="spark-orient-line"[\s\S]*?<\/p>/;
const lineMatch = block.match(lineRe);
assert(lineMatch !== null, 'compact .spark-orient-line legend present in the primary state');
const line = lineMatch ? lineMatch[0] : '';
['Work', 'Lens', 'Field', 'Call'].forEach(function (room) {
  assert(new RegExp('>' + room + '<').test(line),
    'compact legend names the "' + room + '" room');
});

// ---------------------------------------------------------------------------
// 4) Vocabulary guard + concise foot copy.
// ---------------------------------------------------------------------------
console.log('no file/task-manager language; foot copy is a single concise muse line');

const surface = block + (css ? css[0] : '');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(surface),
  'no file-manager language in the threshold surface');
assert(!/(task manager|to-?do|checklist|task list)/i.test(surface),
  'no task-manager language in the threshold surface');

const footRe = /<p class="om-widget-foot">[\s\S]*?<\/p>/;
const footMatch = src.match(footRe);
const foot = footMatch ? footMatch[0] : '';
assert(/stUdio Muse/.test(foot), 'foot copy still names Spark as the stUdio Muse');
assert(/shape your hOMe directly/.test(foot),
  'foot copy states hOMe Sparks shape hOMe directly (builder-native primary)');
assert(/Field Observations/.test(foot), 'foot copy still points to Field Observations');
assert(/Nexus/.test(foot), 'foot copy preserves the Nexus availability note');
// The old repeated explainer copy is gone from the foot.
assert(!/first milestone in Studio/.test(foot),
  'foot copy no longer repeats the "first milestone in Studio" explainer');

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Studio Spark hOMe-tending entrance test passed.');
