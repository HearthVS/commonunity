/* Compass handoff anti-flash · regression
 *
 * Problem: /?threshold=done&enter=compass briefly painted the
 * legacy SESSION SETUP screen before init() flipped screens to
 * #screen-compass. The default CSS is #screen-setup { display:
 * flex }, so any gap between first paint and init was visible
 * as a setup-page flash.
 *
 * Fix: a pre-body IIFE stamps <html data-compass-handoff="1">
 * and injects one synchronous style rule that suppresses
 * #screen-setup during the handoff window. The guard is gated
 * on the route flags so explicit guide/setup routes are
 * untouched.
 *
 * This test is purely static — it pins the guard in index.html
 * so a future edit cannot silently remove it.
 *
 *   Run: node tests/compass-handoff-anti-flash.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const indexSrc = fs.readFileSync(
  path.join(__dirname, '..', 'index.html'),
  'utf8'
);

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

console.log('1. guard IIFE is present and runs before body parses');
ok(/\(function\s+compassHandoffAntiFlash\s*\(\s*\)\s*\{/.test(indexSrc),
   'compassHandoffAntiFlash IIFE is defined');

// The guard must sit in the <head> region, before <body>, so it
// executes BEFORE the parser reaches #screen-setup. We assert
// both positions exist and ordered correctly.
const guardPos  = indexSrc.indexOf('compassHandoffAntiFlash');
const bodyPos   = indexSrc.indexOf('<body');
const setupPos  = indexSrc.indexOf('<div id="screen-setup">');
ok(guardPos > 0 && bodyPos > 0 && guardPos < bodyPos,
   'guard IIFE source position is before <body> (executes before #screen-setup is parsed)');
ok(guardPos > 0 && setupPos > 0 && guardPos < setupPos,
   'guard IIFE source position is before #screen-setup markup');

console.log('\n2. guard triggers ONLY on the handoff route flags');
const guardBlock = indexSrc.slice(guardPos, guardPos + 2500);
ok(/params\.get\(['"]threshold['"]\)\s*===\s*['"]done['"]/.test(guardBlock),
   'guard triggers on threshold=done');
ok(/params\.get\(['"]enter['"]\)\s*===\s*['"]compass['"]/.test(guardBlock),
   'guard triggers on enter=compass');
ok(/params\.get\(['"]guide['"]\)\s*===\s*['"]1['"]/.test(guardBlock),
   'guard checks guide=1 (short-circuit)');
ok(/params\.get\(['"]setup['"]\)\s*===\s*['"]1['"]/.test(guardBlock),
   'guard checks setup=1 (short-circuit)');
// Ordering: guide/setup short-circuit must come BEFORE the
// entering check, so /?guide=1 is never overridden by a stray
// threshold=done query param.
const guideIdx = guardBlock.search(/params\.get\(['"]guide['"]\)/);
const enterIdx = guardBlock.search(/var\s+entering\s*=/);
ok(guideIdx > 0 && enterIdx > 0 && guideIdx < enterIdx,
   'guide/setup short-circuit precedes the entering check');

console.log('\n3. guard applies a synchronous style override');
ok(/data-compass-handoff[^"']*['"]?1['"]?/.test(guardBlock),
   'guard stamps data-compass-handoff="1" on <html>');
ok(/#screen-setup\s*\{\s*display:\s*none\s*!important/.test(guardBlock),
   'guard injects #screen-setup { display: none !important; }');
ok(/#screen-compass\s*\{\s*display:\s*flex\s*!important/.test(guardBlock),
   'guard reveals #screen-compass with display: flex !important');
ok(/document\.head\s*\|\|\s*document\.documentElement/.test(guardBlock),
   'guard appends the style to <head> (falls back to <html> before head exists)');

console.log('\n4. guard is scoped to the root path (no redirect-loop risk)');
ok(/path\s*!==\s*['"]\/['"]\s*&&\s*path\s*!==\s*['"]\/index\.html['"]/.test(guardBlock),
   'guard only runs on / or /index.html');

console.log('\n5. existing gateRootIntoThreshold is preserved');
ok(/function\s+gateRootIntoThreshold/.test(indexSrc),
   'the original gateRootIntoThreshold gate is still present');
// And the original gate still passes threshold=done through (not
// redirected to /threshold) so the anti-flash window can run.
const gatePos = indexSrc.indexOf('gateRootIntoThreshold');
const gateBlock = indexSrc.slice(gatePos, gatePos + 1500);
ok(/params\.get\(['"]threshold['"]\)\s*===\s*['"]done['"]\s*\)\s*return/.test(gateBlock),
   'gateRootIntoThreshold still lets threshold=done arrivals pass through to root');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
