/* Static test: Personal Home milestone framing on the seeded-field band.
 *
 * Builds on the seeded-field readiness band (PR #119) by naming the
 * product model in-place: Personal Home is the *first* major creation
 * inside Studio — not the whole of it. Once Home is living it keeps
 * updating as new expressions are added, and Studio stays open as the
 * wider ongoing creation space. This is a tiny copy/state-flow slice on
 * the existing threshold surface; no new component, no backend change.
 *
 * Covers:
 *   1. .ph-seed-milestone CSS exists, reuses shared tokens, and has a
 *      fully-seeded accent variant.
 *   2. phRenderSeedReadiness emits a stage-aware milestone line and
 *      appends it inside the .ph-seed band.
 *   3. Copy positions Home as the first major creation in Studio and
 *      frames Studio as the ongoing creation space (services / offers /
 *      writings / missions / projects), with a distinct forward framing
 *      once fully seeded / living.
 *   4. No file-manager / task-manager language introduced.
 *
 * Static/DOM assertions over the studio.html markup; no server required.
 *
 * Usage:  node tests/studio-home-milestone-framing.test.js
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
// 1) CSS exists, leans on shared tokens, has a fully-seeded accent.
// ---------------------------------------------------------------------------
console.log('milestone line has scoped CSS');

const msCssRe = /\.ph-seed-milestone\s*\{([^}]*)\}/;
const msCss = src.match(msCssRe);
assert(msCss !== null, '.ph-seed-milestone rule exists');
assert(msCss !== null && /--rose-color/.test(msCss[1]),
  '.ph-seed-milestone tints its divider from the shared --rose-color token');
assert(/\.ph-seed\.is-fully-seeded \.ph-seed-milestone\s*\{/.test(src),
  'fully-seeded accent variant exists (living Home reads forward)');

// ---------------------------------------------------------------------------
// 2) Band renders a stage-aware milestone line.
// ---------------------------------------------------------------------------
console.log('phRenderSeedReadiness emits and appends the milestone line');

const helperRe = /function phRenderSeedReadiness\(model\) \{[\s\S]*?\n    \}/;
const helperMatch = src.match(helperRe);
assert(helperMatch !== null, 'phRenderSeedReadiness body isolated for copy checks');
const band = helperMatch ? helperMatch[0] : '';

assert(/var milestone;/.test(band), 'milestone copy is computed');
assert(/if \(r\.stage === 'fully-seeded'\)/.test(band),
  'milestone framing is stage-aware (distinct once fully seeded / living)');
assert(/'<p class="ph-seed-milestone">' \+ lpEscape\(milestone\) \+ '<\/p>'/.test(band),
  'milestone line is escaped and appended inside the .ph-seed band');

// ---------------------------------------------------------------------------
// 3) Copy positions Home as the first Studio milestone + Studio ongoing.
// ---------------------------------------------------------------------------
console.log('copy frames Home as the first creation in Studio and Studio as ongoing');

assert(/first major creation in Studio/.test(band),
  'copy names Personal Home as the first major creation in Studio');
assert(/Studio stays open as the wider space/.test(band),
  'copy frames Studio as the ongoing/wider creation space after Home');
assert(/services, offers, writings, missions and projects/.test(band),
  'copy names the ongoing expressions Home keeps updating with');
assert(/self now emerging/.test(band),
  'copy frames creation as flowing from the emerging new self');
assert(/it is now living/.test(band),
  'fully-seeded framing reads Home as now living (first milestone reached)');

// ---------------------------------------------------------------------------
// 4) Forbidden vocabularies stay absent from the new surface.
// ---------------------------------------------------------------------------
console.log('no file-manager / task-manager language introduced');

const surface = band + (msCss ? msCss[0] : '');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(surface),
  'no file-manager language in the milestone surface');
assert(!/(task manager|to-?do|checklist|task list)/i.test(surface),
  'no task-manager language in the milestone surface');

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Personal Home milestone framing test passed.');
