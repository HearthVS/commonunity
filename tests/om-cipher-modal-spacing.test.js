/* OM Cipher modal — breathing-room layout + glowing info button.
 *
 * Verifies the UX refactor that moved the long explanatory paragraph
 * behind a glowing info button and grouped fields into spaced cards.
 *
 *   - The long "Identity-engine source data — the inputs the OM Cipher
 *     and Compass build from…" paragraph is NOT rendered inline. The
 *     text lives inside .info-disclosure, which is display:none by
 *     default (open via the .open class).
 *   - The modal contains a glowing .info-button referenced by the
 *     OM Cipher heading.
 *   - Each identity card is wrapped in .om-cipher-card so the modal
 *     has clear section grouping (not a single dense block).
 *   - Birth-coordinate fields exist (lat / lng / tz) so the calculator
 *     can promote Moon/Rising/Lagna from "manual" to "calculated".
 *   - HD profile field is no longer a pending placeholder; the
 *     placeholder text now reads "calculated from birth data".
 *   - The OM Cipher pill is still NOT rendered on the Setup screen
 *     (PR #21/#22 regression guard).
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
  console.log('jsdom not installed — skipping om-cipher-modal-spacing test');
  process.exit(0);
}

const indexSrc = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function pass(msg) { console.log('  ok  ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed++; }
function assert(cond, msg) { cond ? pass(msg) : fail(msg); }

console.log('OM Cipher modal — breathing room + glowing info button');

const sanitized = indexSrc.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,
  '<!-- script omitted for spacing test -->');
const dom = new JSDOM(sanitized, { pretendToBeVisual: true });
const { document } = dom.window;

// ── Long paragraph behind disclosure ──────────────────────────────
const longCopy = 'Identity-engine source data — the inputs the OM Cipher and Compass build from';
const allText = document.body.textContent;
assert(allText.indexOf(longCopy) >= 0,
  'long copy is present somewhere in the document');

const disclosure = document.getElementById('om-cipher-info-disclosure');
assert(disclosure !== null,
  '#om-cipher-info-disclosure exists');
assert(disclosure && disclosure.classList.contains('info-disclosure'),
  'disclosure has .info-disclosure class (display:none until .open is toggled)');
assert(disclosure && disclosure.textContent.indexOf(longCopy) >= 0,
  'long copy lives inside the disclosure, not in a sibling <p>');

// Sanity: the disclosure must NOT have .open by default.
assert(disclosure && !disclosure.classList.contains('open'),
  'disclosure is closed by default');

// ── Glowing info button referenced by the disclosure ─────────────
const infoBtn = document.getElementById('om-cipher-info-btn');
assert(infoBtn !== null,
  'OM Cipher heading has a glowing #om-cipher-info-btn');
assert(infoBtn && infoBtn.classList.contains('info-button'),
  'info button uses .info-button class (glow animation)');
assert(infoBtn && infoBtn.getAttribute('aria-controls') === 'om-cipher-info-disclosure',
  'info button aria-controls the disclosure');

// CSS for the glow animation must be defined somewhere.
assert(/@keyframes\s+info-button-glow/.test(indexSrc),
  '@keyframes info-button-glow defined in stylesheet');

// ── Card grouping for breathing room ─────────────────────────────
const cards = document.querySelectorAll('#profile-modal .om-cipher-card');
assert(cards.length >= 6,
  '#profile-modal has ≥ 6 .om-cipher-card sections (Identity, Birth Coords, Bhramari, Gene Keys, HD, Tropical, Vedic)');

// CSS for cards must include padding + gap (visible breathing room).
assert(/\.om-cipher-card\s*\{[^}]*padding:\s*var\(--space-[0-9]+\)/.test(indexSrc),
  '.om-cipher-card includes padding for breathing room');
assert(/\.om-cipher-card\s*\{[^}]*gap:\s*var\(--space-[0-9]+\)/.test(indexSrc),
  '.om-cipher-card includes a flex gap between fields');

// ── Birth coordinate inputs unlock Moon/Rising/Lagna ─────────────
['profile-birth-lat','profile-birth-lng','profile-birth-tz'].forEach(id => {
  const el = document.getElementById(id);
  assert(el !== null, '#' + id + ' input exists');
});

// ── HD profile is calculated, not pending ─────────────────────────
const hdProfile = document.getElementById('profile-hd-profile');
assert(hdProfile !== null, '#profile-hd-profile exists');
assert(hdProfile && /calculated from birth (data|date \+ time)/i.test(hdProfile.getAttribute('placeholder') || ''),
  'HD profile placeholder advertises calculated-from-birth-* state');

// HD type/strategy/authority/cross stay as bodygraph-required.
const hdType = document.getElementById('profile-hd-type');
assert(hdType !== null, '#profile-hd-type exists');
// Type placeholder is allowed to be generic; what matters is that we no
// longer label the whole section as a single "pending full chart" block.
const tropicalLabelMatches = (indexSrc.match(/Tropical Astrology[\s\S]{0,180}?requires full chart calculation/g) || []).length;
assert(tropicalLabelMatches === 0,
  'tropical astrology no longer carries the blanket "requires full chart calculation" label');

// ── Setup screen still pure: no OM Cipher pill ───────────────────
const setupScreen = document.getElementById('screen-setup');
assert(setupScreen !== null, '#screen-setup exists');
const setupPills = setupScreen.querySelectorAll('.om-cipher-pill-btn, #btn-open-om-cipher-setup');
assert(setupPills.length === 0,
  'Setup screen has no OM Cipher pill (PR #21 invariant)');

// Compass header still has the pill.
const compassPill = document.getElementById('btn-open-om-cipher');
assert(compassPill !== null,
  '#btn-open-om-cipher pill exists in the document (Compass header)');

if (failed > 0) {
  console.error('\n' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('\nAll OM Cipher modal spacing assertions passed.');
