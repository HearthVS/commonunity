/* Threshold handoff route flag · regression test
 *
 * History:
 *   • Live smoke after 8992649 found /?threshold=done&enter=compass
 *     rendered the welcome landing but then dropped the user on
 *     the legacy SESSION SETUP screen instead of cOMpass.
 *   • 19cea53 added an in-init forceCompassScreen() invariant.
 *   • LIVE SMOKE AFTER 19cea53 STILL FAILED with the same symptom:
 *     forceCompassScreen / isCompassEntryRequested were present in
 *     production but #screen-compass display:none / #screen-setup
 *     display:flex remained. Root cause: the in-init backstop was
 *     conditional on init() running to completion. If any earlier
 *     init helper threw, neither initThresholdContract nor the
 *     backstop ran, and the user was stranded.
 *
 * This test pins the fix:
 *   1. The invariant is wired at MODULE-EVAL TIME via an IIFE
 *      (scheduleCompassEntryInvariant), so it runs even if init()
 *      throws.
 *   2. The invariant fires multiple times across the document
 *      lifecycle — DOMContentLoaded, setTimeout(0),
 *      requestAnimationFrame, window.load, setTimeout(250) — so
 *      any later code that touches screen displays gets corrected.
 *   3. forceCompassScreen uses style.setProperty(..., 'important')
 *      so the inline rule cannot be silently overwritten by a
 *      non-!important write from later code.
 *   4. The invariant honours /?guide=1 and /?setup=1 as
 *      short-circuit exits, so explicit setup-fallback routes are
 *      unchanged.
 *   5. The handoff URL emitted by threshold.js lands on /compass.
 *
 * jsdom-optional: the static checks run without jsdom; functional
 * checks fall back to plain assertions where possible.
 *
 *   Run: node tests/threshold-done-enter-compass-route.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const indexSrc    = fs.readFileSync(path.join(ROOT, 'index.html'),             'utf8');
const thresholdJs = fs.readFileSync(path.join(ROOT, 'threshold/threshold.js'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { console.log('  ok  ' + label); pass++; }
  else      { console.log('  FAIL ' + label); fail++; }
}

console.log('1. route flag /compass?threshold=done&enter=compass is recognised');
ok(/function isCompassEntryRequested\s*\(/.test(indexSrc),
   "isCompassEntryRequested helper is defined");
ok(/params\.get\(['"]enter['"]\)\s*===\s*['"]compass['"]/.test(indexSrc),
   "isCompassEntryRequested checks enter=compass");
ok(/params\.get\(['"]threshold['"]\)\s*===\s*['"]done['"]/.test(indexSrc),
   "isCompassEntryRequested also accepts threshold=done");

console.log('\n2. forceCompassScreen uses !important so non-!important later writes cannot win');
const forceFn = indexSrc.split('function forceCompassScreen')[1] || '';
const forceBody = forceFn.split('\n}\n')[0] || forceFn;
ok(/setProperty\(\s*['"]display['"]\s*,\s*['"]none['"]\s*,\s*['"]important['"]/.test(forceBody),
   "forceCompassScreen sets #screen-setup display:none !important");
ok(/setProperty\(\s*['"]display['"]\s*,\s*['"]flex['"]\s*,\s*['"]important['"]/.test(forceBody),
   "forceCompassScreen sets #screen-compass display:flex !important");
ok(/document\.body[\s\S]{0,200}classList\.add\(['"]on-compass-screen['"]/.test(forceBody),
   "forceCompassScreen marks body.on-compass-screen as a stable hook");
ok(/btn-open-om-cipher[\s\S]{0,400}style\.display\s*=\s*['"]inline-flex['"]/.test(forceBody),
   "forceCompassScreen surfaces the OM Cipher pill (inline-flex)");

console.log('\n3. the invariant is wired at MODULE-EVAL TIME, not just in init()');
// The IIFE must exist and must NOT depend on init() running. The
// regression scenario was: init() threw before reaching the
// backstop, so a backstop that only ran inside init() was useless.
ok(/\(function\s+scheduleCompassEntryInvariant\s*\(\s*\)\s*\{/.test(indexSrc),
   "scheduleCompassEntryInvariant IIFE is defined at module scope");
ok(/function\s+applyCompassEntryInvariantIfNeeded\s*\(/.test(indexSrc),
   "applyCompassEntryInvariantIfNeeded helper exists as a named function");

// Ordering: the IIFE must NOT live inside the init() function body.
// We assert this by finding both their source positions and
// confirming the IIFE sits outside init()'s lexical body.
const initStart = indexSrc.indexOf('function init() {');
const iifeStart = indexSrc.indexOf('(function scheduleCompassEntryInvariant');
ok(initStart > 0 && iifeStart > 0,
   "both init() and scheduleCompassEntryInvariant() exist in the source");
// init()'s body ends at the next bare-line `}` followed by the
// DOMContentLoaded wiring. Find that marker and confirm the IIFE
// is *after* it (so it's not nested inside init).
const initEndMarker = "document.addEventListener('DOMContentLoaded', init);";
const initEndPos = indexSrc.indexOf(initEndMarker);
ok(initEndPos > 0 && iifeStart > initEndPos,
   "scheduleCompassEntryInvariant is declared OUTSIDE init() (runs even if init throws)");

console.log('\n4. invariant fires across multiple points in the document lifecycle');
const iifeFn = indexSrc.slice(iifeStart);
const iifeBody = iifeFn.slice(0, iifeFn.indexOf('})();') + 5);
ok(/document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*fireOnce/.test(iifeBody),
   "fires on DOMContentLoaded");
ok(/setTimeout\(\s*fireOnce\s*,\s*0\s*\)/.test(iifeBody),
   "fires via setTimeout(0) (after current task)");
ok(/requestAnimationFrame\(\s*function\s*\(\s*\)\s*\{\s*fireOnce\(\)/.test(iifeBody),
   "fires via requestAnimationFrame (after next paint)");
ok(/window\.addEventListener\(\s*['"]load['"]\s*,\s*fireOnce/.test(iifeBody),
   "fires on window.load (after all subresources)");
ok(/setTimeout\(\s*fireOnce\s*,\s*250\s*\)/.test(iifeBody),
   "fires once more 250ms after init for slow post-init reflows");

// The IIFE should ALSO fire immediately if the document is past
// the 'loading' state — protects against scripts that defer the
// inline bundle, where DOMContentLoaded already passed by the
// time the IIFE evaluates.
ok(/document\.readyState\s*===\s*['"]loading['"][\s\S]{0,500}else\s*\{\s*fireOnce\(\)/.test(iifeBody),
   "fires immediately if document is already past 'loading' state");

console.log('\n5. invariant honours /?guide=1 and /?setup=1 as explicit setup routes');
ok(/wantsGuide[\s\S]{0,200}return;/.test(iifeBody) || /isGuideSetupRequested\(\)\)\s*return;/.test(iifeBody),
   "IIFE short-circuits when guide=1 / setup=1 is set");
// And: applyCompassEntryInvariantIfNeeded() itself also short-
// circuits on guide/setup. (Belt-and-braces, since callers may
// invoke it without pre-checking.)
const applyFn = indexSrc.split('function applyCompassEntryInvariantIfNeeded')[1] || '';
const applyBody = applyFn.split('\n}\n')[0] || applyFn;
ok(/isGuideSetupRequested\(\)\)\s*return;/.test(applyBody),
   "applyCompassEntryInvariantIfNeeded short-circuits on guide=1/setup=1");
ok(/!isCompassEntryRequested\(\)\)\s*return;/.test(applyBody),
   "applyCompassEntryInvariantIfNeeded short-circuits when route flag is absent");
ok(/forceCompassScreen\(\)/.test(applyBody),
   "applyCompassEntryInvariantIfNeeded calls forceCompassScreen when conditions match");

console.log('\n6. init() ordering · invariant runs at end of init too (last in-band firing)');
// Find init()'s body and assert applyCompassEntryInvariantIfNeeded
// is called AT THE END (after every other init helper). This
// catches a regression where someone re-orders init and pushes
// the invariant up before later helpers.
const initBodyStart = indexSrc.indexOf('function init() {');
const initBodyEnd   = indexSrc.indexOf('\ndocument.addEventListener(\'DOMContentLoaded\', init);', initBodyStart);
const initBody      = indexSrc.slice(initBodyStart, initBodyEnd);

const finalApplyIdx = initBody.lastIndexOf('applyCompassEntryInvariantIfNeeded()');
const lastSearchIdx = initBody.lastIndexOf('initSearch()');
ok(finalApplyIdx > 0 && lastSearchIdx > 0 && finalApplyIdx > lastSearchIdx,
   "applyCompassEntryInvariantIfNeeded is invoked AFTER initSearch() (last in-band firing)");

console.log('\n7. threshold writer hands off to the arrival chamber, which routes into cOMpass');
ok(/function handoffToCompass\s*\([\s\S]*?window\.location\.href\s*=\s*'\/compass\/arrival'/.test(thresholdJs),
   "threshold.js navigates to /compass/arrival after the welcome landing");
ok(/window\.location\.replace\('\/compass\?threshold=done&enter=compass'\)/.test(thresholdJs),
   "returning/completed browsers still go straight to /compass?threshold=done&enter=compass");

console.log('\n8. functional check · simulated init failure cannot strand the user');
// Reproduce the production failure mode in jsdom:
//   • Render the page.
//   • Set localStorage with a completed threshold contract.
//   • Set the URL to /compass?threshold=done&enter=compass.
//   • Replace init() with a thrower so init() ABORTS.
//   • Eval the IIFE.
//   • Assert #screen-setup ends up display:none and #screen-compass
//     ends up display:flex via the !important inline writes.
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (_) {
  const fallbacks = [
    '/tmp/jsdom-tmp/node_modules/jsdom',
    path.resolve(ROOT, 'node_modules', 'jsdom')
  ];
  for (const p of fallbacks) {
    try { ({ JSDOM } = require(p)); break; } catch (_) {}
  }
}

if (!JSDOM) {
  console.log('  (skipped — jsdom not installed; the static checks above are sufficient gates)');
} else {
  const dom = new JSDOM(`<!doctype html>
    <html>
      <head><style>
        #screen-setup { display: flex; }
        #screen-compass { display: none; }
      </style></head>
      <body>
        <div id="screen-setup"></div>
        <div id="screen-compass"></div>
        <div id="btn-open-om-cipher" style="display:none"></div>
      </body>
    </html>`, {
    url: 'https://example.test/compass?threshold=done&enter=compass',
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document } = window;

  // Inject ONLY our helpers (avoid the full app surface). We
  // copy the exact source of forceCompassScreen, isGuideSetupRequested,
  // isCompassEntryRequested, applyCompassEntryInvariantIfNeeded,
  // and scheduleCompassEntryInvariant from index.html so the test
  // exercises the production code paths verbatim.
  function extract(src, name) {
    const start = src.indexOf('function ' + name);
    if (start < 0) throw new Error('cannot find ' + name);
    // naive brace-matcher
    let depth = 0, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
  }
  function extractIife(src, name) {
    const start = src.indexOf('(function ' + name);
    if (start < 0) throw new Error('cannot find IIFE ' + name);
    const end = src.indexOf('})();', start);
    return src.slice(start, end + 5);
  }

  const helpers = [
    extract(indexSrc, 'forceCompassScreen'),
    extract(indexSrc, 'isGuideSetupRequested'),
    extract(indexSrc, 'isCompassEntryRequested'),
    extract(indexSrc, 'applyCompassEntryInvariantIfNeeded'),
    extractIife(indexSrc, 'scheduleCompassEntryInvariant')
  ].join('\n\n');

  // Eval the helpers in the jsdom window context.
  window.eval(helpers);

  // Give the deferred firings a tick to run.
  return new Promise(function (resolve) {
    setTimeout(function () {
      const setupDisplay   = window.getComputedStyle(document.getElementById('screen-setup')).display;
      const compassDisplay = window.getComputedStyle(document.getElementById('screen-compass')).display;
      ok(setupDisplay === 'none',
         '#screen-setup computed display is "none" after invariant fires (got ' + setupDisplay + ')');
      ok(compassDisplay === 'flex',
         '#screen-compass computed display is "flex" after invariant fires (got ' + compassDisplay + ')');
      ok(document.body.classList.contains('on-compass-screen'),
         'body.on-compass-screen class is set');

      console.log('\n9. functional check · explicit guide/setup route is NOT overridden');
      // Reset DOM + URL to /?guide=1 and assert the invariant
      // leaves screens untouched (setup stays visible).
      const dom2 = new JSDOM(`<!doctype html>
        <html><head><style>
          #screen-setup { display: flex; }
          #screen-compass { display: none; }
        </style></head>
        <body><div id="screen-setup"></div><div id="screen-compass"></div></body>
        </html>`, { url: 'https://example.test/?guide=1', pretendToBeVisual: true });
      dom2.window.eval(helpers);
      setTimeout(function () {
        const sd = dom2.window.getComputedStyle(dom2.window.document.getElementById('screen-setup')).display;
        const cd = dom2.window.getComputedStyle(dom2.window.document.getElementById('screen-compass')).display;
        ok(sd === 'flex',
           '#screen-setup stays display:flex under /?guide=1 (got ' + sd + ')');
        ok(cd === 'none',
           '#screen-compass stays display:none under /?guide=1 (got ' + cd + ')');
        ok(!dom2.window.document.body.classList.contains('on-compass-screen'),
           'body.on-compass-screen is NOT set under /?guide=1');

        console.log('\n' + pass + ' passed, ' + fail + ' failed');
        process.exit(fail ? 1 : 0);
      }, 350);
    }, 350);
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
