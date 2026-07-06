/* Static + functional test: Studio Spark readiness bias.
 *
 * Builds on the seeded-field readiness band (PR #119): the Personal
 * Home is drafted from Compass + Living Profile, and Studio Spark is
 * the tending / refinement layer for the rooms still Awaiting. This
 * slice closes the loop from the readiness band to the prompt — when
 * no room is active (Studio entrance / Personal Home threshold), the
 * Spark draw biases toward rooms the readiness model marks Awaiting
 * (section source === 'empty'), and the widget foot copy reframes the
 * widget as tending the Personal Home.
 *
 * Covers:
 *   1. phAwaitingRooms() helper exists and reads the exposed
 *      buildPersonalHomePreview model.
 *   2. drawSpark() applies the readiness bias only when no room is
 *      active, and keeps the existing gap / avoid-repeat guards.
 *   3. Widget foot copy names tending the Personal Home + Field
 *      Observations, and avoids file-manager language.
 *   4. Functional — phAwaitingRooms returns exactly the empty-source
 *      rooms across empty / compass / captured / mixed models.
 *
 * Static/DOM assertions over the studio.html markup + a functional
 * extraction of the helper; no server is required.
 *
 * Usage:  node tests/studio-spark-readiness-bias.test.js
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
// 1) Helper exists and reads the exposed preview model.
// ---------------------------------------------------------------------------
console.log('phAwaitingRooms() helper is defined and reads the preview model');

assert(/function\s+phAwaitingRooms\s*\(/.test(src), 'phAwaitingRooms() defined');
assert(/window\.buildPersonalHomePreview/.test(src),
  'helper references the exposed buildPersonalHomePreview model');

const helperRe = /function phAwaitingRooms\(\) \{[\s\S]*?\n    \}/;
const helperMatch = src.match(helperRe);
assert(helperMatch !== null, 'phAwaitingRooms body isolated');
const helperBody = helperMatch ? helperMatch[0] : '';
assert(/source === 'empty'/.test(helperBody),
  'helper selects rooms whose section source is empty (Awaiting)');
assert(/return \[\]/.test(helperBody),
  'helper fails safe to [] when the model is unavailable');

// ---------------------------------------------------------------------------
// 2) drawSpark applies the bias only when no room is active.
// ---------------------------------------------------------------------------
console.log('drawSpark() biases toward Awaiting rooms when no room is active');

const drawRe = /function drawSpark\(\) \{[\s\S]*?\n    \}/;
const drawMatch = src.match(drawRe);
assert(drawMatch !== null, 'drawSpark body isolated');
const draw = drawMatch ? drawMatch[0] : '';

assert(/\} else \{[\s\S]*?phAwaitingRooms\(\)/.test(draw),
  'readiness bias sits in the no-active-room branch');
assert(/awaiting\.indexOf\(s\.section\)/.test(draw),
  'bias narrows the pool to Sparks whose section is Awaiting');
assert(/toward\.length >= 2/.test(draw),
  'bias only narrows when at least two Awaiting Sparks remain (no deadlock)');
// Existing guards preserved.
assert(/var unseeded = pool\.filter/.test(draw),
  'existing gap preference (unseeded) is preserved');
assert(/while \(pool\.length > 1 && pool\[idx\] === currentSpark\)/.test(draw),
  'existing avoid-repeat loop is preserved');

// ---------------------------------------------------------------------------
// 3) Foot copy reframes the widget as tending the Personal Home.
// ---------------------------------------------------------------------------
console.log('widget foot copy names tending the Personal Home + Field Observations');

const footRe = /<p class="om-widget-foot">[\s\S]*?<\/p>/;
const footMatch = src.match(footRe);
assert(footMatch !== null, 'om-widget-foot paragraph isolated');
const foot = footMatch ? footMatch[0] : '';

assert(/build your hOMe draft/.test(foot),
  'foot copy frames Sparks as building the hOMe draft (explicit outcome)');
assert(/Field Observations/.test(foot), 'foot copy still points to Field Observations');
assert(/Nexus/.test(foot), 'foot copy preserves the Nexus availability note');
assert(!/(folder|file manager|upload a file|browse files|directory)/i.test(foot),
  'no file-manager language in the foot copy');

// ---------------------------------------------------------------------------
// 4) Functional — phAwaitingRooms returns exactly the empty-source rooms.
// ---------------------------------------------------------------------------
console.log('phAwaitingRooms returns exactly the Awaiting (empty) rooms');

// The helper reads `window` from its closure, so bind a fake window at
// construction time and return the call result.
function runWith(win) {
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', helperBody + '\nreturn phAwaitingRooms();');
  return factory(win);
}

function fakeWindow(sources) {
  return {
    buildPersonalHomePreview: function () {
      return { sections: {
        work:  { source: sources[0] },
        lens:  { source: sources[1] },
        field: { source: sources[2] },
        call:  { source: sources[3] }
      } };
    }
  };
}

if (helperMatch) {
  const all = runWith(fakeWindow(['empty', 'empty', 'empty', 'empty']));
  assert(all.length === 4 && all.join(',') === 'work,lens,field,call',
    'all-empty model → all four rooms Awaiting');

  const none = runWith(fakeWindow(['compass', 'mixed', 'captured', 'compass']));
  assert(none.length === 0, 'no empty sources → no Awaiting rooms');

  const some = runWith(fakeWindow(['compass', 'empty', 'captured', 'empty']));
  assert(some.length === 2 && some.join(',') === 'lens,call',
    'mixed model → exactly the empty-source rooms (lens, call)');

  const noModel = runWith({});
  assert(Array.isArray(noModel) && noModel.length === 0,
    'missing buildPersonalHomePreview → [] (fails safe)');

  const threw = runWith({ buildPersonalHomePreview: function () { throw new Error('x'); } });
  assert(Array.isArray(threw) && threw.length === 0,
    'model throw is caught → [] (fails safe)');
}

// ---------------------------------------------------------------------------
if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nOK: Studio Spark readiness bias test passed.');
