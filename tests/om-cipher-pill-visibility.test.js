/* OM Cipher pill — visibility on Setup vs. Compass
 *
 * The Setup screen is kept pure: no OM Cipher pill. The pill lives
 * inside the Compass header so it's reachable as soon as the user
 * has entered Compass, and not before. This test guards that split:
 *
 *   - #btn-open-om-cipher-setup must NOT exist (Setup stays clean).
 *   - #screen-setup contains no .om-cipher-pill-btn at all.
 *   - The Compass-header pill #btn-open-om-cipher is present in
 *     the DOM under #screen-compass.
 *   - On the default page state (Setup visible, Compass hidden)
 *     the Compass pill is NOT laid out — expected, it's behind
 *     display:none until Compass opens. When we flip the screen
 *     visibility manually (mirroring what openCompass() does),
 *     the pill becomes laid out.
 *
 * jsdom is treated as optional, mirroring tests/studio-layout-and-
 * resize.test.js: if it isn't installed locally or under /tmp, the
 * test logs a skip notice and exits 0 so CI without jsdom is happy.
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

console.log('OM Cipher pill — Setup stays pure, Compass carries the pill');

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
  let node = el;
  while (node && node !== document.documentElement) {
    const cs = window.getComputedStyle(node);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
    node = node.parentElement;
  }
  return true;
}

// ── Setup screen must stay pure: no OM Cipher pill, no toolbar. ───
const setupScreen = document.getElementById('screen-setup');
const compassPill = document.getElementById('btn-open-om-cipher');
const setupPill   = document.getElementById('btn-open-om-cipher-setup');
const setupToolbar = document.getElementById('setup-toolbar');

assert(!!setupScreen, '#screen-setup exists');
assert(!setupPill,    'setup-screen pill #btn-open-om-cipher-setup is removed');
assert(!setupToolbar, '#setup-toolbar wrapper is removed');
if (setupScreen) {
  const pillsInSetup = setupScreen.querySelectorAll('.om-cipher-pill-btn');
  assert(
    pillsInSetup.length === 0,
    'no .om-cipher-pill-btn inside #screen-setup (Setup stays clean)'
  );
}

// ── Compass header pill is present in the DOM. ────────────────────
assert(!!compassPill, 'compass-header pill #btn-open-om-cipher is present in DOM');

// ── Default page state: Compass is hidden, so its pill is too.
//    This is the intentional behavior — pill is gated behind entering
//    the Compass. ─────────────────────────────────────────────────
assert(
  isLaidOut(setupScreen),
  '#screen-setup is laid out (default page state)'
);
assert(
  !isLaidOut(compassPill),
  'compass-header pill stays hidden under #screen-compass until Compass opens'
);

// ── After Compass is shown (mirroring openCompass()), the pill is
//    visible/clickable. ─────────────────────────────────────────────
const compassScreen = document.getElementById('screen-compass');
if (setupScreen && compassScreen) {
  setupScreen.style.display   = 'none';
  compassScreen.style.display = 'flex';
  assert(
    isLaidOut(compassPill),
    'compass-header pill is laid out once Compass is shown'
  );
}

// ── Pill markup: same pattern as Studio's Living Profile pill ─────
if (compassPill) {
  assert(
    compassPill.classList.contains('om-cipher-pill-btn'),
    'compass pill carries the .om-cipher-pill-btn class'
  );
  assert(
    /OM Cipher/.test(compassPill.textContent || ''),
    'compass pill text reads "OM Cipher"'
  );
  assert(
    !/Companion Profile/.test(compassPill.textContent || ''),
    'compass pill does not render the legacy "Companion Profile" label'
  );
  assert(
    (compassPill.getAttribute('title') || '').toLowerCase().includes('om cipher'),
    'compass pill title attr mentions OM Cipher'
  );
  assert(
    compassPill.querySelector('.ocp-dot'),
    'compass pill has the .ocp-dot indicator (matches the Studio pill pattern)'
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
    /Tropical Astrology/.test(modalHTML),
    'Tropical Astrology section heading is present in the modal'
  );
  assert(
    /Vedic Astrology/.test(modalHTML),
    'Vedic Astrology section heading is present in the modal (extension point)'
  );
  assert(
    modal.querySelector('#profile-vedic-sun'),
    'modal contains Vedic sun input (extension-point field)'
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
  const idxAstro    = modalHTML.indexOf('Tropical Astrology');
  const idxVedic    = modalHTML.indexOf('Vedic Astrology');
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
    'Tropical Astrology section is rendered above "Additional Information"'
  );
  assert(
    idxVedic >= 0 && idxVedic < idxAddInfo,
    'Vedic Astrology section is rendered above "Additional Information"'
  );

  // Label honesty: HD / Vedic must say "requires full chart calculation"
  // somewhere on the section, not be vaguely framed as just "optional".
  assert(
    /Human Design[\s\S]{0,200}requires full chart calculation/.test(modalHTML),
    'Human Design section label declares "requires full chart calculation"'
  );
  assert(
    /Vedic Astrology[\s\S]{0,200}requires full chart calculation/.test(modalHTML),
    'Vedic Astrology section label declares "requires full chart calculation"'
  );
  assert(
    !/Optional, fillable in your own time/.test(modalHTML),
    'the misleading "Optional, fillable in your own time" framing is gone'
  );
}

// ── Modal default state: closed. The modal opens only on click,
// not on page load — important for "not a required gate." ─────────
if (modal) {
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
console.log('\nOK: OM Cipher pill visibility checks pass.');
