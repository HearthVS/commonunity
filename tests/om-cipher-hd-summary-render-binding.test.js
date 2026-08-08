/* OM Cipher · HD summary render-binding regression
 *
 * This test guards the exact failure mode reported by users:
 *
 *   After importing markus-studio-2026-05-15.json and clicking
 *   "Preview Living Profile", the OM Cipher details section did
 *   not display any Human Design fields, and
 *   document.querySelector('[data-cu-om-cipher-hd-summary]')
 *   returned null in the live preview DOM.
 *
 * The sibling tests human-design-rendered-text.test.js and
 * human-design-om-cipher-integration.test.js exercise the HD summary
 * FRAGMENT in isolation. That doesn't catch a regression where the
 * fragment is correct but the surrounding OM Cipher section that
 * carries it gets accidentally dropped, renamed, or gated off.
 *
 * This test extracts the FULL OM Cipher <section> construction the
 * renderLivingProfile path uses (the entire `html += '<section
 * class="lp-foundation ... lp-om-cipher-section" ...>' + ... + '</
 * section>';` block), evaluates it with state seeded from the Markus
 * fixture, and asserts:
 *
 *   - The rendered section contains a node with the
 *     [data-cu-om-cipher-hd-summary] attribute (the exact selector
 *     the user-reported live-DOM check looked for).
 *   - That node is INSIDE the OM Cipher <details> wrapper, so the
 *     "details collapsed by default" UX invariant holds.
 *   - The five required HD values (Type / Strategy / Authority /
 *     Profile / Incarnation Cross) and the provenance line all
 *     appear in the visible text.
 *   - No "Cipher seed" / "Input fingerprint" labels leak into the
 *     visible text (the hidden technical hash invariant).
 *
 * Run:  node tests/om-cipher-hd-summary-render-binding.test.js
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

// ── Stage globals so the auto-calc helpers in buildFoundationItems
// can reach the place gazetteer + HD engine just like the browser
// would. ──────────────────────────────────────────────────────────
global.window = global;
global.window.state = {
  compassData: JSON.parse(JSON.stringify(FIXTURE.compassData)),
  birthData:   FIXTURE.birthData,
  person:      FIXTURE.person
};
global.CommonUnityHumanDesign = require(
  path.resolve(__dirname, '..', 'sdk', 'human_design.js'));
global.window.CommonUnityHumanDesign = global.CommonUnityHumanDesign;
global.CommonUnityPlaces = require(
  path.resolve(__dirname, '..', 'sdk', 'place_gazetteer.js'));
global.window.CommonUnityPlaces = global.CommonUnityPlaces;

// ── Pull the helpers renderLivingProfile uses to build the OM
// Cipher section. ─────────────────────────────────────────────────
function extractFn(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const start = STUDIO.search(re);
  if (start < 0) throw new Error('not found: ' + name);
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
  '\nreturn { buildFoundationItems, lpEscape, ocFormatBirthplaceString, ocSunSignFromDate };');
const { buildFoundationItems, lpEscape, ocFormatBirthplaceString, ocSunSignFromDate } = setup();

// 1. Run buildFoundationItems against the fixture — this is what
//    renderLivingProfile calls via buildLivingProfile() before
//    constructing the OM Cipher section. It also triggers the
//    auto-calc that writes state.compassData.profile.human_design.
const profile = window.state.compassData.profile || {};
const points  = window.state.compassData.points  || {};
const model = { foundation: buildFoundationItems(profile, points) };
const ocLiveHd = window.state.compassData.profile.human_design;

console.log('\nPrecondition · state is populated after buildLivingProfile()');
assert(ocLiveHd && ocLiveHd.type === 'Generator',
  'state.compassData.profile.human_design.type === Generator');
assert(ocLiveHd && ocLiveHd.profile === '2/4',
  'state.compassData.profile.human_design.profile === 2/4');
assert(ocLiveHd && ocLiveHd.resolved_place && ocLiveHd.resolved_place.city === 'Sudbury',
  'state.compassData.profile.human_design.resolved_place resolved to Sudbury');

// 2. Extract the FULL OM Cipher <section> construction the
//    renderLivingProfile path uses. This is the span from the
//    `html += '<section class="lp-foundation lp-field-imprints
//    lp-om-cipher lp-om-cipher-section"...>'` line through the
//    matching closing `'</section>';`. We rewrite the leading
//    `html += '` into `var __html = '` and trim the trailing `;`.
const SECTION_OPEN =
  "html += '<section class=\"lp-foundation lp-field-imprints lp-om-cipher lp-om-cipher-section\"";
const openIdx = STUDIO.indexOf(SECTION_OPEN);
assert(openIdx >= 0, 'OM Cipher section construction is locatable in studio.html');
// Find the matching `'</section>';` AFTER openIdx. The closing line
// the renderer emits is exactly `'</section>';` on its own line.
const closeMarker = "'</section>';";
const closeIdx = STUDIO.indexOf(closeMarker, openIdx);
assert(closeIdx > openIdx, 'OM Cipher section closing tag is locatable');

const sectionSrc = STUDIO.slice(openIdx, closeIdx + closeMarker.length);
// Rewrite: html += '<section ...> ... '</section>';
//   →   var __html = '' + '<section ...> ... '</section>'; return __html;
const sectionExpr = sectionSrc
  .replace(/^html\s*\+=\s*/, "var __html = '' + ")
  .replace(/'<\/section>';\s*$/, "'</section>'; return __html;");

// ocPendingNotes is mutated by the source (push() calls). Provide a
// fresh array. ocBirthDateRaw / ocBirthTimeRaw mirror the live
// fallback chain. Pass through helpers explicitly.
// Inject placeholder locals the renderLivingProfile body defines
// just above the section template. We don't care about their values
// here — only that the section template can construct without
// ReferenceError.
const placeholderPrelude = `
  var placeholderCipherName  = 'Awaiting Compass seal';
  var placeholderMantra      = 'Derived once source data is sealed — the evolving personal mantra lives in your Living Profile.';
  var placeholderField       = 'Pending source data';
  var placeholderNarrative   = 'Your archetypal pattern emerges from the cipher once Compass is sealed. Your lived story lives in Living Profile.';
  var placeholderContemp     = 'A contemplation phrase will surface here.';
  var placeholderBhramari    = 'Recorded in your Living Profile.';
  var foundationItems = (model.foundation || []).filter(function (it) {
    if (!it) return false;
    if (it.field === 'current_location') return false;
    if (it.field === 'human_design') return false;
    if (it.field === 'astrology') return false;
    return true;
  });
`;

const buildSection = new Function(
  'lpEscape', 'model', 'ocLiveHd', 'ocPendingNotes',
  'ocBirthDateRaw', 'ocBirthTimeRaw', 'profile',
  'ocFormatBirthplaceString', 'ocSunSignFromDate',
  placeholderPrelude + sectionExpr
);
const ocPendingNotes = [];
const sectionHtml = buildSection(
  lpEscape, model, ocLiveHd, ocPendingNotes,
  profile.birthdate || profile.birth_date || profile.dob || '1973-11-18',
  profile.birth_time || profile.birthtime || '03:21',
  profile,
  ocFormatBirthplaceString, ocSunSignFromDate
);

// ── Tiny DOM-like extractor: locate the substring of an element
// carrying a given attribute and pull its tag + inner text. We
// avoid pulling in jsdom because this repo has no node_modules. ──
function findAttrNode(html, attr) {
  const reOpen = new RegExp('<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\s' + attr + '(=|\\s|>)', 'i');
  const m = reOpen.exec(html);
  if (!m) return null;
  const tag = m[1];
  // Walk forward to find the matching closing tag.
  const startIdx = m.index;
  const openTag = '<' + tag;
  const closeTag = '</' + tag + '>';
  let depth = 0;
  const lc = html.toLowerCase();
  let i = startIdx;
  while (i < html.length) {
    const ni = lc.indexOf(openTag.toLowerCase(), i);
    const nc = lc.indexOf(closeTag.toLowerCase(), i);
    if (nc < 0) return null;
    if (ni >= 0 && ni < nc) { depth++; i = ni + openTag.length; continue; }
    depth--;
    if (depth === 0) {
      const end = nc + closeTag.length;
      return { outer: html.slice(startIdx, end), inner: html.slice(html.indexOf('>', startIdx) + 1, nc) };
    }
    i = nc + closeTag.length;
  }
  return null;
}

console.log('\nLive section HTML · [data-cu-om-cipher-hd-summary] selector resolves');
const hdNode = findAttrNode(sectionHtml, 'data-cu-om-cipher-hd-summary');
assert(hdNode !== null,
  'rendered OM Cipher section carries a [data-cu-om-cipher-hd-summary] element');
assert(/data-cu-om-cipher-hd-state="calculated"/.test(hdNode ? hdNode.outer : ''),
  '[data-cu-om-cipher-hd-summary] is flagged data-cu-om-cipher-hd-state="calculated"');

// The HD summary must live INSIDE the OM Cipher <details> wrapper
// so the surface stays collapsed by default. Verify the <details>
// node's inner HTML contains the HD summary element.
const detailsNode = findAttrNode(sectionHtml, 'data-cu-om-cipher-details');
assert(detailsNode !== null,
  'OM Cipher <details> wrapper still present');
assert(detailsNode && /data-cu-om-cipher-hd-summary/.test(detailsNode.inner),
  '[data-cu-om-cipher-hd-summary] lives inside the OM Cipher <details> wrapper');

// ── Visible-text assertions over the rendered section. Strip
//    hidden/aria-hidden subtrees first so we only assert against the
//    text users actually see — the technical Cipher seed / Input
//    fingerprint markup stays in the DOM (data hooks) but is hidden. ──
function stripHiddenSubtrees(html) {
  let out = html;
  // Drop any element marked hidden / display:none / aria-hidden="true"
  // along with its inner contents. Repeat until stable so nested
  // hidden trees are removed too.
  const reHidden = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*(\shidden\b|aria-hidden\s*=\s*"true"|display\s*:\s*none)[^>]*>[\s\S]*?<\/\1>/i;
  let prev;
  do { prev = out; out = out.replace(reHidden, ''); } while (out !== prev);
  return out;
}
const visible = stripHiddenSubtrees(sectionHtml)
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

console.log('\nVisible OM Cipher section text · contains required HD values');
[
  'Human Design',
  'Generator',
  'To wait to respond',
  'Emotional · Solar Plexus',
  '2/4',
  'Right Angle Cross of 14/8 | 29/30'
].forEach(function (needle) {
  assert(visible.indexOf(needle) >= 0,
    'visible OM Cipher section text contains "' + needle + '"');
});
assert(visible.indexOf('Resolved from birth place · Sudbury, Ontario, Canada') >= 0,
  'visible OM Cipher section text surfaces resolved-place provenance');
assert(visible.indexOf('America/Toronto') >= 0,
  'visible OM Cipher section text surfaces IANA tz (America/Toronto)');

console.log('\nVisible OM Cipher section text · technical hashes stay hidden');
assert(!/Cipher seed:/.test(visible),
  'no visible "Cipher seed:" label leaked into the section');
assert(!/Input fingerprint:/.test(visible),
  'no visible "Input fingerprint:" label leaked into the section');
assert(!/\b[a-f0-9]{16,}\b/.test(visible),
  'no long hex hash appears in visible OM Cipher section text');

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: OM Cipher HD summary render-binding regression passes.');
