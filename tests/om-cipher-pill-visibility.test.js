/* OM Cipher pill — runtime visibility & accessibility
 *
 * Verifies that the OM Cipher pill button is actually visible and
 * clickable on the page the user lands on, not just present in the
 * DOM with display:none on a hidden screen. The bug this guards:
 *
 *   - #btn-open-om-cipher lived only inside #screen-compass, which
 *     defaults to display:none. A fresh user on the Setup screen
 *     saw no OM Cipher affordance at all (boundingBox was null,
 *     isVisible was false).
 *
 * Strategy: use jsdom to load index.html with the full stylesheet,
 * then assert that *at least one* OM Cipher pill is laid-out
 * (boundingClientRect non-zero / not display:none) on the
 * default page state and after the welcome overlay is dismissed.
 *
 * jsdom is treated as optional, mirroring tests/studio-layout-and-
 * resize.test.js: if it isn't installed locally or under /tmp, the
 * test logs a skip notice and exits 0 so CI without jsdom is happy.
 * The CI environment that does install jsdom catches the regression.
 *
 *   Local run:
 *     npm install --prefix /tmp/jsdom-tmp jsdom
 *     NODE_PATH=/tmp/jsdom-tmp/node_modules \
 *         node tests/om-cipher-pill-visibility.test.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (_) {
  // Try a couple of common local fallback locations.
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
  console.log('jsdom not installed — run: npm i jsdom (skipping visibility test)');
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

console.log('OM Cipher pill — runtime visibility on Setup screen');

// Strip <script> tags so jsdom doesn't try to execute the full
// application (it depends on browser APIs / external scripts that
// aren't relevant here). We only care about CSS-driven layout/
// visibility of the pill buttons.
const sanitized = indexSrc.replace(
  /<script\b[^>]*>[\s\S]*?<\/script>/g,
  '<!-- script omitted for visibility test -->'
);

const dom = new JSDOM(sanitized, {
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const { window } = dom;
const { document } = window;

function isLaidOut(el) {
  if (!el) return false;
  // jsdom does not compute full layout, but it does honour
  // display:none / visibility:hidden via getComputedStyle.
  let node = el;
  while (node && node !== document.documentElement) {
    const cs = window.getComputedStyle(node);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    node = node.parentElement;
  }
  return true;
}

// ── DOM presence (regression of the original PR) ──────────────────
const setupPill   = document.getElementById('btn-open-om-cipher-setup');
const compassPill = document.getElementById('btn-open-om-cipher');

assert(!!setupPill,   'setup-screen pill #btn-open-om-cipher-setup is present');
assert(!!compassPill, 'compass-header pill #btn-open-om-cipher is present');

// ── Critical fix: the setup-screen pill must be visible on the
// initial page state (welcome overlay closed, screen-setup shown,
// screen-compass hidden). This is the state a fresh user lands on
// after "Begin". The welcome overlay is hidden by default (display:
// none unless .open class is added) so on a return visit the setup
// pill should be immediately visible.
const setupScreen = document.getElementById('screen-setup');
assert(
  isLaidOut(setupScreen),
  '#screen-setup is laid out (default page state)'
);
assert(
  isLaidOut(setupPill),
  'setup-screen OM Cipher pill is visible on the default page state'
);

// The Compass-header pill correctly stays hidden behind #screen-
// compass on initial load — that's the existing behavior we keep.
assert(
  !isLaidOut(compassPill),
  'compass-header pill stays hidden under #screen-compass until Compass opens (intentional)'
);

// ── Pill markup: same pattern as Studio's Living Profile pill ─────
assert(
  setupPill.classList.contains('om-cipher-pill-btn'),
  'setup pill carries the .om-cipher-pill-btn class'
);
assert(
  /OM Cipher/.test(setupPill.textContent || ''),
  'setup pill text reads "OM Cipher"'
);
assert(
  !/Companion Profile/.test(setupPill.textContent || ''),
  'setup pill does not render the legacy "Companion Profile" label'
);
assert(
  (setupPill.getAttribute('title') || '').toLowerCase().includes('om cipher'),
  'setup pill title attr mentions OM Cipher'
);
assert(
  setupPill.querySelector('.ocp-dot'),
  'setup pill has the .ocp-dot indicator (matches the Studio pill pattern)'
);

// ── The toolbar wrapping the pill is positioned at the top of the
// Setup screen (before .logo-block) so the user encounters it
// without scrolling. We check structural order, not pixel layout
// (jsdom doesn't compute pixel layout). ─────────────────────────────
const toolbar = document.getElementById('setup-toolbar');
assert(!!toolbar, '#setup-toolbar wrapper exists');
if (toolbar && setupScreen) {
  const children = Array.from(setupScreen.children);
  const toolbarIdx = children.indexOf(toolbar);
  const logoIdx    = children.findIndex(c => c.classList.contains('logo-block'));
  assert(
    toolbarIdx >= 0 && (logoIdx === -1 || toolbarIdx < logoIdx),
    'setup toolbar appears before the logo block in DOM order'
  );
}

// ── Modal contents must surface the OM Cipher fields the user
// expects when the pill is clicked. We can't run the click handler
// without the app scripts, but we can verify the modal markup. ────
const modal = document.getElementById('profile-modal');
assert(!!modal, '#profile-modal exists');
if (modal) {
  const modalHTML = modal.innerHTML;
  assert(
    /OM Cipher/.test(modalHTML),
    'modal contains the OM Cipher heading'
  );
  assert(
    !/Companion Profile/.test(modalHTML),
    'modal no longer shows the "Companion Profile" label'
  );
  assert(
    modal.querySelector('#profile-bhramari-hz'),
    'modal contains the Bhramari baseline input (#profile-bhramari-hz)'
  );
  assert(
    /Bhramari baseline \(Hz\)/.test(modalHTML),
    'Bhramari baseline (Hz) label is present in the modal'
  );
  assert(
    modal.querySelector('#profile-hd-type'),
    'modal contains Human Design type input'
  );
  assert(
    /Human Design/.test(modalHTML),
    'Human Design section heading is present in the modal'
  );
  assert(
    modal.querySelector('#profile-astro-sun'),
    'modal contains astrology sun input'
  );
  assert(
    /Astrology/.test(modalHTML),
    'Astrology section heading is present in the modal'
  );
  assert(
    /Additional Information/.test(modalHTML),
    'Additional Information section heading is present in the modal'
  );

  // Identity-engine fields must come before Additional Information,
  // not the other way around.
  const idxAddInfo  = modalHTML.indexOf('Additional Information');
  const idxBhramari = modalHTML.indexOf('Bhramari baseline (Hz)');
  const idxHD       = modalHTML.indexOf('Human Design');
  const idxAstro    = modalHTML.indexOf('Astrology');
  assert(
    idxBhramari >= 0 && idxBhramari < idxAddInfo,
    'Bhramari section is rendered above "Additional Information"'
  );
  assert(
    idxHD >= 0 && idxHD < idxAddInfo,
    'Human Design section is rendered above "Additional Information"'
  );
  assert(
    idxAstro >= 0 && idxAstro < idxAddInfo,
    'Astrology section is rendered above "Additional Information"'
  );
}

// ── Modal default state: closed. The modal opens only on click,
// not on page load — important for "not a required gate." ─────────
if (modal) {
  // Inline display:none on the modal element keeps it dismissed
  // until the click handler flips it to flex. Computed style should
  // therefore be 'none' on default page state.
  const cs = window.getComputedStyle(modal);
  assert(
    cs.display === 'none',
    'profile modal is closed by default (computed display:none) — not a gate'
  );
}

if (failed > 0) {
  console.error('\nFAILED: ' + failed + ' check(s).');
  process.exit(1);
}
console.log('\nOK: OM Cipher pill visibility regressions pass.');
