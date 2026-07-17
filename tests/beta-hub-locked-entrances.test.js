/* Static checks for the private beta hub's locked cOMpass/stUdio entrances and
 * section ordering (beta/beta.js + beta/beta.css).
 *
 * The entrances must be LOCKED at this stage: visible cards, but not clickable
 * navigational links that could let a beta participant bypass each product's own
 * magic-link / threshold gate. They must sit last, after Announcements and the
 * Library, and carry the small transparent product marks beside their names with
 * no background plate/frame per the CommonUnity brand rule.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const js = read('beta/beta.js');
const css = read('beta/beta.css');

// ── Entrances are locked, not navigational links ────────────────────────────
assert(js.includes('function lockedEntrance('), 'a lockedEntrance() builder should exist');
assert(!/pathRow\s*\(/.test(js), 'the old clickable pathRow() entrance builder should be gone');

// The locked entrances must not be anchors and must not carry a compass/studio
// href or any bypass URL/token.
assert(!/href:\s*['"]\/compass['"]/.test(js), 'no /compass navigational href on the hub entrance');
assert(!/href:\s*['"]\/studio['"]/.test(js), 'no /studio navigational href on the hub entrance');

// Lock state is textual + semantic, not colour-only.
assert(js.includes("'Locked'"), 'the entrance should carry the textual label "Locked"');
assert(js.includes("'aria-disabled': 'true'") || js.includes('"aria-disabled": "true"'),
  'the locked entrance should be semantically disabled (aria-disabled)');

// ── Small product marks reused, transparent variants only ───────────────────
assert(js.includes('/assets/brand/compass-mark-transparent.svg'), 'reuse the transparent cOMpass mark');
assert(js.includes('/assets/brand/studio-mark-transparent.svg'), 'reuse the transparent stUdio mark');
// Never reach for the plate-bearing favicons on this product surface.
assert(!/favicon-studio\.svg/.test(js), 'must not use the plate-bearing studio favicon on the hub');

// ── Section ordering: Announcements + Library lead, entrances last ──────────
const iAnnounce = js.indexOf("'Announcements'");
const iLibrary = js.indexOf("'Library & Sharings'");
const iPath = js.indexOf("'The path ahead'");
assert(iAnnounce > -1 && iLibrary > -1 && iPath > -1, 'all three sections should render');
assert(iAnnounce < iPath, 'Announcements must come before the locked entrances');
assert(iLibrary < iPath, 'Library must come before the locked entrances');

// ── Brand rule: the logo rests on the field, no plate/frame around it ────────
const logoRule = css.match(/\.beta-row-logo\s*\{([^}]*)\}/);
assert(logoRule, '.beta-row-logo rule should exist');
const body = logoRule[1];
['background', 'border', 'box-shadow', 'border-radius'].forEach((prop) => {
  assert(!new RegExp('\\b' + prop + '\\b\\s*:').test(body),
    `.beta-row-logo must not frame the mark (found ${prop})`);
});

// The locked row itself must not present as clickable.
assert(css.includes('.beta-row-locked'), '.beta-row-locked styling should exist');

console.log('beta hub locked-entrance + ordering checks passed');
