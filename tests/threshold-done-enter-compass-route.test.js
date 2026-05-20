/* Threshold handoff route flag · regression test
 *
 * Live smoke after commit 8992649 found the welcome landing was
 * rendered, then the handoff URL /?threshold=done&enter=compass
 * dropped the user on the legacy SESSION SETUP screen instead of
 * cOMpass. Root cause: initThresholdContract's openCompass() call
 * was wrapped in a silent try/catch and any dependency throwing
 * mid-flight left the user on #screen-setup.
 *
 * This test pins:
 *   1. /?threshold=done&enter=compass is recognised as an
 *      authoritative request for the cOMpass companion view.
 *   2. A completed threshold contract on root flips screens to
 *      #screen-compass and hides #screen-setup, even if
 *      openCompass() throws mid-way.
 *   3. /?guide=1 and /?setup=1 still pin the user on
 *      #screen-setup (explicit guide/setup fallback routes).
 *   4. The threshold writer's handoff URL still navigates to
 *      /?threshold=done&enter=compass, so the contract that the
 *      writer + the route flag promise to the reader is honoured
 *      end-to-end.
 *
 * jsdom-free static checks where possible; functional checks fall
 * back to text matching so the test runs without the optional
 * jsdom dependency.
 *
 *   Run: node tests/threshold-done-enter-compass-route.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const indexSrc     = fs.readFileSync(path.join(ROOT, 'index.html'),               'utf8');
const thresholdJs  = fs.readFileSync(path.join(ROOT, 'threshold/threshold.js'),   'utf8');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

console.log('1. route flag /?threshold=done&enter=compass is recognised');
ok(/function isCompassEntryRequested\s*\(/.test(indexSrc),
   "isCompassEntryRequested helper is defined");
ok(/params\.get\(['"]enter['"]\)\s*===\s*['"]compass['"]/.test(indexSrc),
   "isCompassEntryRequested checks enter=compass");
ok(/params\.get\(['"]threshold['"]\)\s*===\s*['"]done['"]/.test(indexSrc),
   "isCompassEntryRequested also accepts threshold=done");

console.log('\n2. completed contract on root forces the cOMpass screen');
ok(/function forceCompassScreen\s*\(/.test(indexSrc),
   "forceCompassScreen helper is defined");
ok(/screen-setup[\s\S]{0,400}style\.display\s*=\s*['"]none['"]/.test(
     indexSrc.split('function forceCompassScreen')[1] || ''),
   "forceCompassScreen hides #screen-setup");
ok(/screen-compass[\s\S]{0,400}style\.display\s*=\s*['"]flex['"]/.test(
     indexSrc.split('function forceCompassScreen')[1] || ''),
   "forceCompassScreen shows #screen-compass");

// initThresholdContract must call forceCompassScreen unconditionally
// at the tail of the auto-enter branch, so a throwing openCompass()
// cannot leave the user on #screen-setup.
const itc = indexSrc.split('function initThresholdContract')[1] || '';
const itcBody = itc.split('\n}\n')[0] || itc;
ok(/forceCompassScreen\(\)/.test(itcBody),
   "initThresholdContract calls forceCompassScreen as a screen-flip invariant");
ok(/openCompass\(\)/.test(itcBody),
   "initThresholdContract still invokes the rich openCompass() path");
// The bug was that a throwing openCompass() left the user on setup.
// The fix wraps openCompass() in its own try/catch so the outer flow
// always reaches forceCompassScreen().
ok(/try\s*\{\s*openCompass\(\)\s*;?\s*\}\s*catch/.test(itcBody),
   "openCompass() is wrapped in its own try/catch so its failure cannot abort the handoff");

console.log('\n3. /?guide=1 and /?setup=1 are still respected as setup-fallback routes');
ok(/params\.get\(['"]guide['"]\)\s*===\s*['"]1['"]/.test(indexSrc),
   "isGuideSetupRequested still accepts guide=1");
ok(/params\.get\(['"]setup['"]\)\s*===\s*['"]1['"]/.test(indexSrc),
   "isGuideSetupRequested still accepts setup=1");
// Guide/setup must short-circuit BEFORE forceCompassScreen runs,
// otherwise the invariant would override the user's explicit choice.
ok(/isGuideSetupRequested\(\)\)\s*return;[\s\S]{0,2000}forceCompassScreen\(\)/.test(itcBody),
   "isGuideSetupRequested() short-circuits initThresholdContract before forceCompassScreen");

// The init()-level backstop honours enter=compass without overriding
// the user's explicit guide/setup request.
ok(/isCompassEntryRequested\(\)[\s\S]{0,200}!isGuideSetupRequested\(\)[\s\S]{0,200}forceCompassScreen\(\)/.test(indexSrc),
   "init() backstop calls forceCompassScreen only when guide/setup is not requested");

console.log('\n4. threshold writer still hands off to /?threshold=done&enter=compass');
ok(/\/\?threshold=done&enter=compass/.test(thresholdJs),
   "threshold.js navigates to /?threshold=done&enter=compass after the welcome landing");

console.log('\n5. regression: companion completion never shows #screen-setup');
// Static guard: the forceCompassScreen body must explicitly set
// #screen-setup display:none. If a future edit ever weakens this
// (e.g. removes the hide line), the test breaks.
ok(/setupScreen[\s\S]{0,200}style\.display\s*=\s*['"]none['"]/.test(itcBody + indexSrc),
   "#screen-setup is explicitly set display:none in the handoff path");
// And the OM Cipher pill defensive clearing — the live smoke also
// reported the pill invisible after entry; forceCompassScreen
// mirrors openCompass()'s pill-clearing block so the affordance is
// reachable even when openCompass() threw.
ok(/btn-open-om-cipher[\s\S]{0,400}style\.display\s*=\s*['"]inline-flex['"]/.test(
     indexSrc.split('function forceCompassScreen')[1] || ''),
   "forceCompassScreen surfaces the OM Cipher pill (inline-flex)");

console.log('\n6. welcome landing still precedes the handoff (no regression)');
ok(/'welcome-landing'/.test(thresholdJs),
   "threshold.js still includes the welcome-landing screen between identity and handoff");
ok(/function beginWelcomeHandoff/.test(thresholdJs),
   "threshold.js still orchestrates the welcome fade -> handoff");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
