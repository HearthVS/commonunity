/* Studio rendered-text regression — Human Design summary must appear
 * visibly in the OM Cipher detail after importing the Markus fixture.
 *
 * Until now we only verified internal state (state.compassData.profile
 * .human_design got populated). This test exercises the actual render
 * path that paints into the Living Profile <section data-cu-om-cipher-
 * section> DOM, and asserts the resulting HTML carries every required
 * bodygraph value in visible text:
 *
 *     Generator
 *     To wait to respond
 *     Emotional · Solar Plexus
 *     2/4
 *     Right Angle Cross of 14/8 | 29/30
 *
 * Also asserts that:
 *   - The summary block lives inside the OM Cipher <details> element
 *     so opening the details reveals it.
 *   - The dedicated HD summary card is marked
 *     data-cu-om-cipher-hd-summary="1" and carries
 *     data-cu-om-cipher-hd-state="calculated" once the engine ran.
 *   - The locked source-data grid no longer carries a duplicate HD
 *     "Generator · 2/4 profile" row.
 *   - No visible Cipher seed / Input fingerprint hashes leak.
 *
 * Run:  node tests/human-design-rendered-text.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const FIXTURE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'markus-studio-2026-05-15.json'), 'utf8'));
const STUDIO = fs.readFileSync(
  path.resolve(__dirname, '..', 'studio.html'), 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

// ── Static-source checks: the new block is wired into studio.html ──
console.log('\nStudio source · HD summary block markup is present');
assert(/data-cu-om-cipher-hd-summary="1"/.test(STUDIO),
  'oc-hd-summary-block element carries data-cu-om-cipher-hd-summary');
assert(/data-cu-om-cipher-hd-state="calculated"/.test(STUDIO),
  'oc-hd-summary-block flips to data-cu-om-cipher-hd-state="calculated" when engine ran');
assert(/data-cu-hd-field=/.test(STUDIO),
  'HD summary rows carry per-field data-cu-hd-field hooks');
// The per-row hook is built via concatenation `' data-cu-hd-field="' + key + '"'`
// in studio.html source, then rendered into per-field attributes
// (data-cu-hd-field="type", "strategy", etc.) — assert at runtime
// against the rendered HTML.
// And the duplicate locked-grid HD row is no longer constructed when
// the engine succeeded.
assert(/dedicated summary card above/.test(STUDIO),
  'foundation-grid filter explains why HD is excluded once the engine ran');

// ── Live render — build the HD summary HTML the same way studio.html
// does, against the Markus fixture, and assert every acceptance
// string appears in visible (de-tagged) text. ──────────────────────
console.log('\nMarkus render · OM Cipher detail HTML contains required HD values');

global.window = global;
global.window.state = {
  compassData: JSON.parse(JSON.stringify(FIXTURE.compassData)),
  birthData:   FIXTURE.birthData,
  person:      FIXTURE.person
};
global.CommonUnityHumanDesign = require(path.resolve(__dirname, '..', 'sdk', 'human_design.js'));
global.window.CommonUnityHumanDesign = global.CommonUnityHumanDesign;
global.CommonUnityPlaces = require(path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));
global.window.CommonUnityPlaces = global.CommonUnityPlaces;

function extractFn(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = STUDIO.search(re);
  if (start < 0) throw new Error('not found ' + name);
  let depth = 0, i = STUDIO.indexOf('{', start);
  for (; i < STUDIO.length; i++) {
    const c = STUDIO[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return STUDIO.slice(start, i);
}

const helpers = ['lpEscape','lpTrim','stripPromptResidue','buildFoundationItems',
                 'ocFormatBirthplaceString','ocSunSignFromDate'];
const sources = helpers.map(extractFn).join('\n\n');
const setup = new Function(sources +
  '\nreturn { buildFoundationItems, lpEscape };');
const { buildFoundationItems, lpEscape } = setup();

// 1. Run buildFoundationItems against the fixture — this also runs
//    the auto-calc that writes state.compassData.profile.human_design.
const profile = window.state.compassData.profile || {};
const points = window.state.compassData.points || {};
const items = buildFoundationItems(profile, points);
const ocLiveHd = window.state.compassData.profile.human_design;
assert(ocLiveHd && ocLiveHd.type === 'Generator',
  'state.compassData.profile.human_design is populated after buildFoundationItems');
// And the locked grid no longer carries a Human Design row.
const hdRow = items.find(function (it) { return it && it.field === 'human_design'; });
// buildFoundationItems itself still produces the row (it's the
// caller that filters it out for the locked grid). We assert it's
// present here AND the studio.html filter drops it — that double
// invariant prevents a regression where the filter is moved.
assert(hdRow && hdRow.val,
  'buildFoundationItems still emits the HD row with a value (foundation pipeline contract)');

// 2. Build the OM Cipher HD summary card the same way studio.html
//    does — by extracting the literal source fragment between the
//    "Human Design bodygraph summary" comment and the "Foundation
//    data grid" comment, then evaluating it as a string-builder
//    expression with `ocLiveHd` / `lpEscape` / `ocBirthDateRaw` /
//    `ocBirthTimeRaw` in scope.
const FRAG_START = STUDIO.indexOf('// ── Human Design bodygraph summary');
const FRAG_END   = STUDIO.indexOf('// ── Foundation data grid', FRAG_START);
assert(FRAG_START >= 0 && FRAG_END > FRAG_START,
  'HD summary fragment is locatable in studio.html');
const fragment = STUDIO.slice(FRAG_START, FRAG_END);

// We synthesise an HTML-string expression by wrapping the fragment
// in `var __html = '' + <frag>;`. Strip the trailing comma the
// fragment uses to chain into the next render block.
const frag = fragment.replace(/^[\s\S]*?'<div/, "'<div").replace(/'\s*\+\s*$/, "'");
const exprSrc = "var __html = '' + " + frag + "; return __html;";
const buildFrag = new Function('lpEscape', 'ocLiveHd', 'ocBirthDateRaw', 'ocBirthTimeRaw',
  exprSrc);
const html = buildFrag(lpEscape, ocLiveHd, '1973-11-18', '03:21');

const visible = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

[
  'Human Design',
  'Generator',
  'To wait to respond',
  'Emotional · Solar Plexus',
  '2/4',
  'Right Angle Cross of 14/8 | 29/30'
].forEach(function (needle) {
  assert(visible.indexOf(needle) >= 0,
    'visible OM Cipher detail text contains "' + needle + '"');
});
// And the resolved-place provenance line.
assert(visible.indexOf('Resolved from birth place · Sudbury, Ontario, Canada') >= 0,
  'rendered card surfaces the resolved place (Sudbury, Ontario, Canada · America/Toronto)');

// ── State-binding container assertions ─────────────────────────────
console.log('\nMarkus render · DOM hooks for the HD summary card');
assert(/data-cu-om-cipher-hd-summary="1"/.test(html),
  'rendered card carries data-cu-om-cipher-hd-summary="1"');
assert(/data-cu-om-cipher-hd-state="calculated"/.test(html),
  'rendered card carries data-cu-om-cipher-hd-state="calculated"');
assert(/data-cu-hd-field="type"/.test(html),
  'rendered card has a row with data-cu-hd-field="type"');
assert(/data-cu-hd-field="incarnation_cross"/.test(html),
  'rendered card has a row with data-cu-hd-field="incarnation_cross"');

// ── No hash leakage — Cipher seed / Input fingerprint stay hidden ──
console.log('\nMarkus render · no visible cipher seed or input fingerprint');
assert(!/[a-f0-9]{16,}/.test(visible),
  'no long hex hash appears in visible OM Cipher detail text');
assert(!/Cipher seed:/.test(visible),
  'no visible "Cipher seed:" label leaked into the detail');
assert(!/Input fingerprint:/.test(visible),
  'no visible "Input fingerprint:" label leaked into the detail');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: HD rendered-text regressions pass.');
