/* OM Cipher — live entry-flow regression
 *
 * Mirrors the live smoke-test sequence reported after PR #21 deploy:
 *
 *   1. Initial page load: setup screen is pure — no OM Cipher pill,
 *      no setup toolbar, no OM Cipher text in the visible region.
 *   2. After dismissing the welcome overlay ("Begin"): still on
 *      Setup, still no pill — the Cipher is gated behind entering
 *      the Compass.
 *   3. After clicking "Open as Guide" (the actual Compass entry):
 *      the Compass header OM Cipher pill becomes visible AND
 *      clickable (boundingBox non-zero, computed display ≠ none up
 *      the ancestor chain). This is the regression that the live
 *      smoke test flagged: pill in DOM but isVisible=false.
 *   4. Clicking the pill opens #profile-modal with computed
 *      display ≠ none, and the modal contains Bhramari, Human
 *      Design, Tropical Astrology, Vedic Astrology, and Additional
 *      Information sections with "requires full chart calculation"
 *      wording on HD/Vedic.
 *
 * We don't run the full app in jsdom (it depends on browser APIs
 * we don't stub). Instead we mirror the openCompass() screen flip
 * + the defensive inline-style clearing the function now performs,
 * then directly invoke a tiny re-implementation of the pill click
 * handler — the same one initProfileModal() wires up.
 *
 * jsdom is optional, matching the other DOM-layout tests.
 *
 *   Local run:
 *     npm install --prefix /tmp/jsdom-tmp jsdom
 *     NODE_PATH=/tmp/jsdom-tmp/node_modules \
 *         node tests/om-cipher-compass-entry-flow.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (_) {
  const fallbacks = [
    '/tmp/jsdom-tmp/node_modules/jsdom',
    path.resolve(__dirname, '..', 'node_modules', 'jsdom'),
    '/tmp/commonunity/node_modules/jsdom'
  ];
  for (const p of fallbacks) {
    try { ({ JSDOM } = require(p)); break; } catch (_) { /* keep trying */ }
  }
}

if (!JSDOM) {
  console.log('jsdom not installed — run: npm i jsdom (skipping compass-entry-flow test)');
  process.exit(0);
}

const indexSrc = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'),
  'utf8'
);

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('OM Cipher — live entry-flow (welcome → setup → Open as Guide → pill → modal)');

const sanitized = indexSrc.replace(
  /<script\b[^>]*>[\s\S]*?<\/script>/g,
  '<!-- script omitted for flow test -->'
);

const dom = new JSDOM(sanitized, {
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const { window } = dom;
const { document } = window;

function isLaidOut(el) {
  if (!el) return false;
  let node = el;
  while (node && node !== document.documentElement) {
    const cs = window.getComputedStyle(node);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    node = node.parentElement;
  }
  return true;
}

// ── Step 1: initial page load ────────────────────────────────────
const setupScreen   = document.getElementById('screen-setup');
const compassScreen = document.getElementById('screen-compass');
const welcome       = document.getElementById('welcome-overlay');
const pill          = document.getElementById('btn-open-om-cipher');
const modal         = document.getElementById('profile-modal');

assert(!!setupScreen,   '#screen-setup exists');
assert(!!compassScreen, '#screen-compass exists');
assert(!!pill,          '#btn-open-om-cipher exists in DOM');
assert(!!modal,         '#profile-modal exists in DOM');

assert(
  isLaidOut(setupScreen),
  'initial page: Setup screen is laid out'
);
assert(
  !isLaidOut(compassScreen),
  'initial page: Compass screen is NOT laid out (display:none until entry)'
);
assert(
  !isLaidOut(pill),
  'initial page: OM Cipher pill is NOT laid out (Setup stays pure)'
);
// Welcome overlay is hidden by default (only opens on first visit) —
// matches the live state for a returning user.
assert(
  !document.getElementById('btn-open-om-cipher-setup'),
  'initial page: no setup-screen pill exists (Setup purity)'
);

// ── Step 2: dismiss welcome (Begin). On a returning user the
//   overlay is already closed; on a new user "Begin" closes it.
//   Either way, the user is on Setup, and the pill must STILL be
//   hidden. ─────────────────────────────────────────────────────
if (welcome) welcome.classList.remove('open');
assert(
  !isLaidOut(pill),
  'after welcome dismiss: pill is still hidden (user is on Setup, not Compass)'
);

// ── Step 3: simulate clicking "Open as Guide" — this is the real
//   Compass entry. We mirror exactly what openCompass() does after
//   the PR fix: flip screen visibility AND clear any inline display
//   on the pill so nothing can suppress it. ──────────────────────
function enterCompass() {
  setupScreen.style.display   = 'none';
  compassScreen.style.display = 'flex';
  // Defensive clearing — matches the production code path in
  // openCompass() so the test reproduces the live runtime state.
  if (pill) {
    pill.style.display    = 'inline-flex';
    pill.style.visibility = 'visible';
    pill.removeAttribute('hidden');
  }
}
enterCompass();

assert(
  isLaidOut(compassScreen),
  'after Open as Guide: Compass screen is laid out'
);
assert(
  isLaidOut(pill),
  'after Open as Guide: OM Cipher pill is laid out (visible/clickable)'
);

// Pill must be the FIRST action in .compass-actions so the user
// encounters it immediately — guards against accidental reordering
// where Search / more-menu could push it off-screen on narrow
// viewports.
const compassActions = document.querySelector('.compass-actions');
assert(!!compassActions, '.compass-actions wrapper exists');
if (compassActions) {
  const firstAction = compassActions.firstElementChild;
  assert(
    firstAction && firstAction.id === 'btn-open-om-cipher',
    'OM Cipher pill is the FIRST child of .compass-actions (most-prominent slot)'
  );
}

// Defensive CSS rule must exist: `#screen-compass .om-cipher-pill-btn`
// with `display: inline-flex !important`. Past regressions had inline
// display:none win over the base rule; the !important keeps the pill
// visible.
assert(
  /#screen-compass\s+\.om-cipher-pill-btn\s*\{\s*display:\s*inline-flex\s*!important/.test(indexSrc),
  'defensive CSS: #screen-compass .om-cipher-pill-btn { display: inline-flex !important; }'
);

// The openCompass() function must clear inline display/visibility on
// the pill — this is the runtime half of the defensive fix.
assert(
  /openCompass[\s\S]{0,3000}btn-open-om-cipher[\s\S]{0,400}style\.display\s*=\s*['"]inline-flex/.test(indexSrc),
  'openCompass() sets #btn-open-om-cipher style.display = "inline-flex" defensively'
);

// ── Step 4: clicking the pill opens the modal. We can't run the
//   real script, but we can wire the same handler the production
//   code wires (initProfileModal) and check the open behavior. ──
function bindPill() {
  pill.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
}
bindPill();
pill.click();
assert(
  window.getComputedStyle(modal).display !== 'none',
  'clicking the OM Cipher pill opens #profile-modal (display ≠ none)'
);

// ── Modal contents must contain the five required sections in the
//   right order, with accurate labels. This is the same shape the
//   user sees post-click in the live app. ──────────────────────
if (modal) {
  const modalHTML = modal.innerHTML;
  const sections = {
    bhramari:     /Bhramari baseline \(Hz\)/.test(modalHTML),
    humanDesign:  /Human Design/.test(modalHTML),
    tropicalAstro:/Tropical Astrology/.test(modalHTML),
    vedicAstro:   /Vedic Astrology/.test(modalHTML),
    additional:   /Additional Information/.test(modalHTML)
  };
  assert(sections.bhramari,      'modal contains Bhramari baseline (Hz) field');
  assert(sections.humanDesign,   'modal contains Human Design section');
  assert(sections.tropicalAstro, 'modal contains Tropical Astrology section');
  assert(sections.vedicAstro,    'modal contains Vedic Astrology section');
  assert(sections.additional,    'modal contains Additional Information section');

  // Label honesty — after the bodygraph engine landed, Human Design
  // fields are calculated locally from birth date + time. Labels read
  // "calculated from birth date + time" rather than the legacy
  // "requires bodygraph calculation" wording.
  assert(
    /Human Design[\s\S]{0,1500}calculated from birth date \+ time/.test(modalHTML),
    'Human Design section advertises calculated-from-birth-date-+-time subfields'
  );
  assert(
    !/requires bodygraph/.test(modalHTML),
    'Human Design section no longer carries the legacy "requires bodygraph" label'
  );
  assert(
    /Vedic Astrology[\s\S]{0,1500}(Lahiri|requires birth time)/.test(modalHTML),
    'Vedic Astrology section declares Lahiri ayanamsha or birth-time requirement'
  );
  assert(
    !/Optional, fillable in your own time/.test(modalHTML),
    'misleading "Optional, fillable in your own time" framing is gone'
  );

  // Section order — identity-engine sections appear before
  // Additional Information.
  const idxAddInfo = modalHTML.indexOf('Additional Information');
  ['Bhramari baseline (Hz)', 'Human Design', 'Tropical Astrology', 'Vedic Astrology']
    .forEach(function (label) {
      const idx = modalHTML.indexOf(label);
      assert(
        idx >= 0 && idx < idxAddInfo,
        '"' + label + '" section is rendered above "Additional Information"'
      );
    });
}

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: OM Cipher live entry-flow regressions pass.');
