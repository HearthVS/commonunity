/* Static + functional test: Personal Home seeded-field readiness band.
 *
 * The agreed product foundation is that the personal hOMe builder must
 * NOT begin from a blank prompt — a person steps into a living field
 * already seeded from Compass points + Living Profile, and Studio Spark
 * is repositioned as the guided refinement/tending layer for the rooms
 * still awaiting. This slice adds a readiness band to the Personal Home
 * threshold that names the seeding and reframes Studio Spark accordingly.
 *
 * Covers:
 *   1. .ph-seed CSS block exists and reuses shared tokens.
 *   2. phSeedReadiness / phRenderSeedReadiness helpers are defined and
 *      the threshold prepends the band.
 *   3. Copy names the four sources (Compass, Living Profile, Studio
 *      Spark, Field Observations) and avoids file-manager language.
 *   4. phSeedReadiness counts drafted / awaiting / from-Compass rooms
 *      correctly across empty, compass, captured, and mixed sources.
 *
 * Static/DOM assertions over the studio.html markup + a functional
 * extraction of the readiness helper; no server is required.
 *
 * Usage:  node tests/studio-home-seeded-field-readiness.test.js
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
// 1) CSS band exists and leans on shared tokens.
// ---------------------------------------------------------------------------
console.log('seeded-field readiness band has scoped CSS');

const seedCssRe = /\.ph-seed\s*\{([^}]*)\}/;
const seedCss = src.match(seedCssRe);
assert(seedCss !== null, '.ph-seed rule exists');
assert(seedCss !== null && /--rose-color/.test(seedCss[1]),
  '.ph-seed tints from the shared --rose-color token');
assert(/\.ph-seed-eyebrow\s*\{/.test(src), '.ph-seed-eyebrow rule exists');
assert(/\.ph-seed-lede\s*\{/.test(src), '.ph-seed-lede rule exists');
assert(/\.ph-seed-tend\s*\{/.test(src), '.ph-seed-tend rule exists');

// ---------------------------------------------------------------------------
// 2) Helpers defined + threshold prepends the band.
// ---------------------------------------------------------------------------
console.log('readiness helpers exist and the threshold renders the band');

assert(/function\s+phSeedReadiness\s*\(/.test(src), 'phSeedReadiness() defined');
assert(/function\s+phRenderSeedReadiness\s*\(/.test(src), 'phRenderSeedReadiness() defined');
assert(/var html = phRenderSeedReadiness\(model\) \+/.test(src),
  'phRenderThreshold prepends the readiness band before the hero');
assert(/class="ph-seed is-'\s*\+\s*r\.stage/.test(src),
  'band carries a stage-keyed class (awaiting-seed / seeded / fully-seeded)');

// ---------------------------------------------------------------------------
// 3) Source language present; file-manager language absent.
// ---------------------------------------------------------------------------
console.log('band names the four sources and avoids file-manager language');

// Scope the copy assertions to the readiness helper body.
const helperRe = /function phRenderSeedReadiness\(model\) \{[\s\S]*?\n    \}/;
const helperMatch = src.match(helperRe);
assert(helperMatch !== null, 'phRenderSeedReadiness body isolated for copy checks');
const band = helperMatch ? helperMatch[0] : '';

assert(/Compass/.test(band), 'copy references Compass');
assert(/Living Profile/.test(band), 'copy references Living Profile');
assert(/Studio Spark/.test(band), 'copy references Studio Spark');
assert(/Field Observations/.test(band), 'copy references Field Observations');
assert(/blank page/.test(band), 'copy asserts this is not a blank page');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(band),
  'no file-manager language in the readiness copy');

// ---------------------------------------------------------------------------
// 4) Functional — phSeedReadiness counts correctly.
// ---------------------------------------------------------------------------
console.log('phSeedReadiness counts drafted / awaiting / from-Compass rooms');

// Extract PH_SEED_ROOMS + phSeedReadiness (the block ends right before
// phRenderSeedReadiness) and evaluate it in isolation.
const blockRe = /var PH_SEED_ROOMS[\s\S]*?\n    function phSeedReadiness[\s\S]*?\n    \}/;
const block = src.match(blockRe);
assert(block !== null, 'PH_SEED_ROOMS + phSeedReadiness block extracted');

let phSeedReadiness = null;
if (block) {
  // eslint-disable-next-line no-new-func
  phSeedReadiness = new Function(block[0] + '\nreturn phSeedReadiness;')();
}
assert(typeof phSeedReadiness === 'function', 'phSeedReadiness evaluates to a function');

function model(sources) {
  return { sections: {
    work:  { source: sources[0] },
    lens:  { source: sources[1] },
    field: { source: sources[2] },
    call:  { source: sources[3] }
  } };
}

if (typeof phSeedReadiness === 'function') {
  const fully = phSeedReadiness(model(['compass', 'compass', 'compass', 'compass']));
  assert(fully.drafted === 4 && fully.awaiting === 0 && fully.fromCompass === 4 && fully.stage === 'fully-seeded',
    'all-compass rooms → 4 drafted, 0 awaiting, 4 from Compass, stage fully-seeded');

  const none = phSeedReadiness(model(['empty', 'empty', 'empty', 'empty']));
  assert(none.drafted === 0 && none.awaiting === 4 && none.fromCompass === 0 && none.stage === 'awaiting-seed',
    'all-empty rooms → 0 drafted, 4 awaiting, stage awaiting-seed');

  const mixed = phSeedReadiness(model(['compass', 'mixed', 'captured', 'empty']));
  assert(mixed.drafted === 3 && mixed.awaiting === 1 && mixed.fromCompass === 2 && mixed.stage === 'seeded',
    'mixed rooms → 3 drafted, 1 awaiting, 2 from Compass (compass+mixed), stage seeded');

  const total = phSeedReadiness(model(['compass', 'compass', 'compass', 'compass']));
  assert(total.total === 4, 'total rooms is always 4 (Work / Lens / Field / Call)');
}

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Personal Home seeded-field readiness band test passed.');
