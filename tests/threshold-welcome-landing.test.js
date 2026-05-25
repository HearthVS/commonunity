/* Threshold welcome landing · regression test
 *
 * Asserts the soft-landing chamber sits between identity completion
 * and the cOMpass handoff, so the user no longer flashes through
 * the legacy setup surface on first arrival.
 *
 * jsdom-free: this is a static check against threshold/threshold.js
 * and threshold/threshold.css source. We deliberately do not boot
 * the module — the contract here is that the *flow* contains the
 * welcome state, that the copy + accessibility hooks are present,
 * and that handoff still ends at /compass?threshold=done&enter=compass.
 *
 *   Run: node tests/threshold-welcome-landing.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const js  = fs.readFileSync(path.join(ROOT, 'threshold/threshold.js'),  'utf8');
const css = fs.readFileSync(path.join(ROOT, 'threshold/threshold.css'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

console.log('1. welcome-landing is a real state in the flow');
ok(/ONBOARDING_STEPS\s*=\s*\[[^\]]*'welcome-landing'/.test(js),
   "'welcome-landing' is registered in ONBOARDING_STEPS");
ok(/PALETTE_STAGE_BY_STEP\s*=\s*\{[\s\S]*?'welcome-landing':\s*3/.test(js),
   "welcome-landing inherits the established palette stage (3)");
ok(/case 'welcome-landing':\s*renderWelcomeLanding\(\)/.test(js),
   "render() dispatches to renderWelcomeLanding");
ok(/function renderWelcomeLanding\s*\(/.test(js),
   "renderWelcomeLanding is defined");

console.log('\n2. identity-completion routes through the welcome landing');
const idCompleteFn = js.split('function onCompleteIdentity')[1] || '';
const idBody = idCompleteFn.split('\n  function ')[0];
ok(/writeContract\(\)/.test(idBody),
   "onCompleteIdentity still writes the OM Cipher contract");
ok(/go\('welcome-landing'\)/.test(idBody),
   "onCompleteIdentity transitions to welcome-landing (not direct handoff)");
ok(!/handoffToCompass\(\)/.test(idBody),
   "onCompleteIdentity no longer calls handoffToCompass directly");

console.log('\n3. welcome-landing screen content + accessibility');
ok(/Welcome to your cOMpass/.test(js),
   "welcome screen carries the 'Welcome to your cOMpass' copy");
ok(/your cOMpass is your living connection to the OM field/.test(js),
   "welcome screen carries the dynamic name-linked OM field line");
ok(/foundational coordinates of your OM Cipher/.test(js),
   "welcome body explains name + birth details as OM Cipher coordinates");
ok(/The Work, The Lens, The Field, and The Call are the four points of your cOMpass/.test(js),
   "welcome body names the four cOMpass points");
ok(/Ready when you are/.test(js),
   "welcome microcopy reads 'Ready when you are'");
ok(/function welcomeStatement/.test(js),
   "welcomeStatement composes a name-linked reflective sentence");
ok(/aria-live/.test(js),
   "welcome screen exposes a polite aria-live status for assistive tech");
ok(/compassMark\(\)/.test(js.split('function renderWelcomeLanding')[1] || ''),
   "welcome screen uses the animated cOMpass logo (compassMark)");
ok(/function prefersReducedMotion/.test(js),
   "prefers-reduced-motion is detected so auto-fade can be suppressed");

console.log('\n4. soft fade + handoff');
ok(/function beginWelcomeHandoff/.test(js),
   "beginWelcomeHandoff orchestrates fade -> handoff");
ok(/root\.classList\.add\('is-fading-out'\)/.test(js),
   "fade-out is applied to the threshold root (whole field dims together)");
ok(/\/compass\?threshold=done&enter=compass/.test(js),
   "handoff still navigates to /compass?threshold=done&enter=compass");
ok(/Contract\.isThresholdCompleted\(\)[\s\S]*?window\.location\.replace\('\/compass\?threshold=done&enter=compass'\)/.test(js),
   "completed threshold browsers continue into cOMpass instead of the homepage");
ok(!/window\.location\.replace\('\/'\)/.test(js),
   "threshold boot should not bounce completed users to the homepage");

console.log('\n4b. welcome screen is user-driven · no auto-advance timer');
const renderWelcomeFn = (js.split('function renderWelcomeLanding')[1] || '').split('\n  function ')[0];
ok(!/setTimeout\([^)]*beginWelcomeHandoff/.test(renderWelcomeFn),
   "renderWelcomeLanding has NO setTimeout that calls beginWelcomeHandoff (no auto-advance)");
ok(!/3200|6000/.test(renderWelcomeFn),
   "renderWelcomeLanding has NO 3200ms / 6000ms timer constants");
ok(/enterBtn\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*beginWelcomeHandoff/.test(renderWelcomeFn),
   "Enter cOMpass click is the path that triggers beginWelcomeHandoff");
ok(/enterBtn\.focus\(\)/.test(renderWelcomeFn),
   "Enter cOMpass button receives focus for keyboard accessibility");

console.log('\n4c. centralized fade-in between threshold screens');
const renderFn = (js.split('function render()')[1] || '').split('\n  function ')[0];
ok(/classList\.add\(['"]is-entering['"]\)/.test(renderFn),
   "render() adds .is-entering class for the screen-transition fade");
ok(/classList\.remove\(['"]is-entering['"]\)/.test(renderFn),
   "render() also removes .is-entering (restart + cleanup) so re-renders don't double-fade");
ok(/\.threshold-root\.is-entering[\s\S]{0,200}animation:\s*threshold-step-in/.test(css),
   ".is-entering CSS animation hook is defined");
ok(/@keyframes threshold-step-in/.test(css),
   "threshold-step-in keyframes are defined");
ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}is-entering[\s\S]{0,200}animation:\s*none/.test(css),
   "is-entering animation is disabled under prefers-reduced-motion");

console.log('\n5. CSS hooks exist for the welcome screen');
ok(/\.threshold-card\.is-welcome-landing/.test(css),
   ".is-welcome-landing card style is defined");
ok(/\.welcome-title/.test(css),
   ".welcome-title style is defined");
ok(/\.welcome-statement/.test(css),
   ".welcome-statement style is defined");
ok(/\.welcome-body/.test(css),
   ".welcome-body style is defined");
ok(/\.welcome-body-line/.test(css),
   ".welcome-body-line style is defined");
ok(/\.threshold-root\.is-fading-out/.test(css),
   ".is-fading-out fade transition is defined on the root");
ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}is-welcome-landing|is-welcome-landing[\s\S]{0,400}@media \(prefers-reduced-motion: reduce\)|@media \(prefers-reduced-motion: reduce\)[\s\S]*is-fading-out/.test(css),
   "reduced-motion override is present for welcome / fade");

console.log('\n6. legacy guide/setup route is still respected upstream');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/guide=1|setup=1/.test(indexHtml),
   "/?guide=1 and /?setup=1 are still recognised in index.html");
ok(/threshold=done/.test(indexHtml),
   "index.html still recognises threshold=done arrivals");

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
