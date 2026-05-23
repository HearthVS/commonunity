/* Threshold · OM opening step (new first surface)
 *
 * Adds a ceremonial OM opening page before the coordinates form.
 * The user lands here on /threshold and clicks "Begin orientation"
 * to advance to the existing name/birth coordinates page.
 *
 * Pinned by this test:
 *   1. 'om-opening' is the first entry in ONBOARDING_STEPS and
 *      the default currentStep.
 *   2. PALETTE_STAGE_BY_STEP['om-opening'] === 0 (neutral).
 *   3. render() dispatches 'om-opening' → renderOmOpening().
 *   4. renderOmOpening() exists, uses brandHeader + compassMark
 *      (same animated logo the rest of the threshold uses), and
 *      adds .is-arrival so it inherits the arrival choreography.
 *   5. The exact OM page copy is present (title, three body
 *      paragraphs, CTA "Begin orientation"). The CTA advances
 *      to 'name-threshold' via go().
 *   6. The arrival-class cleanup in render() preserves the
 *      class on both 'om-opening' and 'name-threshold'.
 *   7. The coordinates page (renderNameThreshold) carries the
 *      new "Begin your journey hOMe" framing and the
 *      "Tune my cOMpass" CTA.
 *   8. CSS hooks for .is-om-opening + .om-opening-body exist
 *      with reduced-motion fallbacks.
 *
 *   Run: node tests/threshold-om-opening.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const js   = fs.readFileSync(path.join(ROOT, 'threshold/threshold.js'),  'utf8');
const css  = fs.readFileSync(path.join(ROOT, 'threshold/threshold.css'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

console.log('1. om-opening is registered as the first step');
ok(/ONBOARDING_STEPS\s*=\s*\[\s*'om-opening'/.test(js),
   "'om-opening' is the FIRST entry of ONBOARDING_STEPS");
ok(/currentStep:\s*'om-opening'/.test(js),
   "default state.currentStep is 'om-opening'");
ok(/PALETTE_STAGE_BY_STEP\s*=\s*\{[\s\S]*?'om-opening':\s*0/.test(js),
   "palette stage for 'om-opening' is 0 (neutral)");

console.log('\n2. render() dispatches to renderOmOpening()');
const renderFn = (js.split('function render()')[1] || '').split('\n  function ')[0];
ok(/case 'om-opening':\s*renderOmOpening\(\)/.test(renderFn),
   "render() dispatches 'om-opening' → renderOmOpening()");
ok(/function renderOmOpening\s*\(/.test(js),
   "renderOmOpening is defined");

console.log('\n3. arrival-class cleanup preserves both om-opening and name-threshold');
ok(/state\.currentStep\s*!==\s*'om-opening'[\s\S]{0,200}state\.currentStep\s*!==\s*'name-threshold'/.test(renderFn),
   "render() keeps .is-arrival on the threshold root for BOTH om-opening and name-threshold");

console.log('\n4. OM opening composition + content');
const omFn = (js.split('function renderOmOpening')[1] || '').split('\n  function ')[0];
ok(/root\.classList\.add\(\s*['"]is-arrival['"]\s*\)/.test(omFn),
   "renderOmOpening adds .is-arrival to the threshold root");
ok(/is-arrival is-om-opening/.test(omFn),
   "OM opening card carries .is-arrival.is-om-opening composition classes");
ok(/brandHeader\(/.test(omFn),
   "OM opening uses brandHeader (cOMpass · Threshold chip)");
ok(/compassMark\(\)/.test(omFn),
   "OM opening uses the animated compassMark (same logo as rest of threshold)");
ok(/Before the journey, there is OM\./.test(omFn),
   "title copy: 'Before the journey, there is OM.'");
ok(/OM is often called the primordial sound/.test(omFn),
   "first body paragraph: primordial sound / silence before sound / pure potential");
ok(/cOMpass begins here: with a shift in the geography of awareness/.test(omFn),
   "second body paragraph: shift in geography of awareness");
ok(/This threshold is the first step/.test(omFn),
   "third body paragraph: first step toward hOMe");

console.log('\n5. CTA wiring');
ok(/Begin orientation/.test(omFn),
   "CTA label is 'Begin orientation'");
ok(/go\('name-threshold'\)/.test(omFn),
   "CTA advances to 'name-threshold' via go()");
ok(/beginBtn\.focus/.test(omFn),
   "CTA receives focus for keyboard accessibility");
ok(/aria-label['"]?:\s*['"]Begin orientation['"]/.test(omFn),
   "CTA has aria-label='Begin orientation'");

console.log('\n6. coordinates page (renderNameThreshold) uses new copy + CTA');
const ntFn = (js.split('function renderNameThreshold')[1] || '').split('\n  function ')[0];
ok(/Begin your journey hOMe/.test(ntFn),
   "coordinates title: 'Begin your journey hOMe'");
ok(/Every journey into unknown territory begins with orientation/.test(ntFn),
   "coordinates body paragraph 1: orientation framing");
ok(/we receive your first coordinates: your name and birth date/.test(ntFn),
   "coordinates body paragraph 2: name and birth date framing");
ok(/Tune my cOMpass/.test(ntFn),
   "coordinates CTA label: 'Tune my cOMpass'");
// Existing form invariants must still hold.
ok(/id:\s*['"]th-full-name['"]/.test(ntFn),
   "coordinates page still renders #th-full-name input");
ok(/id:\s*['"]th-birth-date['"]/.test(ntFn),
   "coordinates page still renders #th-birth-date input");
ok(/onSubmitName\(errBox\)/.test(ntFn),
   "coordinates CTA still wired to onSubmitName (form validation preserved)");

console.log('\n7. CSS hooks for om-opening + arrival choreography');
ok(/\.threshold-card\.is-arrival\.is-om-opening\s/.test(css),
   ".threshold-card.is-arrival.is-om-opening rule is defined");
ok(/\.om-opening-body\s*\{/.test(css),
   ".om-opening-body container rule is defined");
ok(/\.threshold-card\.is-arrival\.is-om-opening[\s\S]{0,400}arrival-fade-in/.test(css),
   "om-opening body animation references existing arrival-fade-in keyframes");
ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,1500}is-om-opening/.test(css),
   "reduced-motion override includes .is-om-opening");

console.log('\n8. existing flow is unchanged downstream');
ok(/case 'name-threshold':\s*renderNameThreshold\(\)/.test(renderFn),
   "render() still dispatches name-threshold");
ok(/case 'welcome-landing':\s*renderWelcomeLanding\(\)/.test(renderFn),
   "render() still dispatches welcome-landing (final welcome unchanged)");
ok(/case 'prepared-setup':\s*renderPreparedSetup\(\)/.test(renderFn),
   "render() still dispatches prepared-setup");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
