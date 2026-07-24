/* guide-companion-identity-boundary · P0 privacy/identity regression test
 *
 * Launch-blocking boundary between the Guide (facilitator) and the Companion
 * (the OM Cipher subject). Reproduced incident: a companion's session showed
 * the guide (account owner) as its identity, and guide-only facilitation notes
 * were leaving the companion's session. This test guards three fixes in
 * index.html (the cOMpass):
 *
 *   1. Identity — the profile / OM Cipher identity is seeded from the
 *      Companion Name, NEVER from the guide/owner. If no companion name is
 *      present the profile identity is left blank (fail closed), so a guide's
 *      name can never become the companion's cipher identity.
 *
 *   2. Guide notes stay local — the per-room facilitator "observations" are
 *      excluded from the exported companion JSON, the copy-to-Notion markdown,
 *      and every AI payload (/generate website copy, /search Nexus context).
 *
 *   3. Layer 3 available to companions — companion mode hides only the
 *      guide-only facilitator panel; "generate website content" stays visible
 *      (it is generated from companion-owned data only).
 *
 * Static source assertions + a functional check of the guide-notes stripper.
 *
 *   Run: node tests/guide-companion-identity-boundary.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function ok(msg, cond) {
  if (cond) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
}

// Brace-balanced top-level function extractor (same technique as the existing
// payload tests).
function extractFn(html, name) {
  const start = html.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (start < 0) return '';
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

console.log('1. Companion identity is authoritative — guide never seeds the profile');
const sync = extractFn(src, 'syncSetupIntoProfile');
ok('syncSetupIntoProfile reads the Companion Name field',
   /getElementById\(['"]companion-name['"]\)/.test(sync));
ok('syncSetupIntoProfile still writes profile.legal_name',
   /state\.profile\.legal_name\s*=/.test(sync));
ok('the guide name is NOT assigned into profile.legal_name (fail closed)',
   !/state\.profile\.legal_name\s*=\s*guide\b/.test(sync));
ok('the guide name is NOT assigned into profile.first_name',
   !/state\.profile\.first_name\s*=\s*(givenFromGuide|guide)\b/.test(sync));
ok('the guide name is NOT assigned into profile.last_name',
   !/state\.profile\.last_name\s*=\s*(familyFromGuide|guide)\b/.test(sync));

console.log('\n2. Guide-only facilitation notes never leave the guide session');
// The stripper is self-contained — extract and exercise it for real.
const fieldsDecl = (src.match(/var\s+GUIDE_ONLY_POINT_FIELDS\s*=\s*\[[^\]]*\];/) || [])[0];
const stripPoint = extractFn(src, 'cuStripGuideOnlyPoint');
const stripPoints = extractFn(src, 'cuStripGuideOnlyPoints');
ok('GUIDE_ONLY_POINT_FIELDS declares "observations" as guide-only',
   !!fieldsDecl && /observations/.test(fieldsDecl));
ok('cuStripGuideOnlyPoint helper exists', !!stripPoint);
ok('cuStripGuideOnlyPoints helper exists', !!stripPoints);

let stripApi = null;
try {
  // eslint-disable-next-line no-eval
  stripApi = eval('(function () {' + fieldsDecl + stripPoint + stripPoints +
    ';return { p: cuStripGuideOnlyPoint, ps: cuStripGuideOnlyPoints };})()');
} catch (e) { ok('stripper eval (' + e.message + ')', false); }

if (stripApi) {
  const before = { work: { summary: 'companion summary', web_intro: 'x',
                           observations: 'SECRET guide-only note' } };
  const strippedAll = stripApi.ps(before);
  ok('stripped point drops observations',
     strippedAll.work.observations === undefined);
  ok('stripped point keeps companion-owned fields (summary/web_intro)',
     strippedAll.work.summary === 'companion summary' && strippedAll.work.web_intro === 'x');
  ok('original state is not mutated (stripper returns a copy)',
     before.work.observations === 'SECRET guide-only note');
  const one = stripApi.p({ raw: 'r', observations: 'note' });
  ok('single-point stripper drops observations', one.observations === undefined && one.raw === 'r');
}

// Wiring: the export + AI payload sites use the stripper.
ok('buildCompassExport strips guide notes from exported points',
   /out\.points\s*=\s*cuStripGuideOnlyPoints\(/.test(src));
ok('/generate website-copy payload strips guide notes',
   /\[point\]:\s*cuStripGuideOnlyPoint\(state\.points\[point\]\)/.test(src));
ok('/search Nexus payload strips guide notes',
   /session:\s*cuStripGuideOnlyPoints\(state\.points\)/.test(src));
ok('copy-to-Notion markdown no longer emits a "Guide Notes" block',
   !/###\s*Guide Notes/.test(src));

console.log('\n3. Layer 3 (generate website content) is available in companion mode');
ok('companion mode still hides the guide-only facilitator panel',
   /body\.companion-mode\s+\.facilitator-panel\s*\{\s*display:\s*none/.test(src));
ok('companion mode no longer hides the website layer tab',
   !/body\.companion-mode\s+\.layer-tab-btn\[data-layer="website"\]\s*\{\s*display:\s*none/.test(src));
ok('companion mode no longer hides the generate button',
   !/body\.companion-mode\s+#btn-generate-all\s*\{\s*display:\s*none/.test(src));

if (failed) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
} else {
  console.log('\nOK: guide/companion identity-boundary regressions pass.');
}
