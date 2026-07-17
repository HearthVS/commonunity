/* Static checks for the private beta hub refinement pass (beta/beta.js +
 * beta/beta.css):
 *
 *   1. The participant-facing personal "For you" area is not rendered, while the
 *      individual-message data path is preserved (filtered out, not dropped).
 *   2. An optional Substack invitation lives within Library & Sharings, opens
 *      safely in a new tab, and carries an accessible external-link affordance.
 *   3. A restrained luminous interaction (hover/focus glow, pointer response)
 *      that respects prefers-reduced-motion, keyboard focus, and touch, and that
 *      never decorates the locked product cards.
 *   4. The canonical transparent-logo rule (no plate/frame around any logo).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const js = read('beta/beta.js');
const css = read('beta/beta.css');

// ── 1. "For you" personal area is dormant (not rendered), data preserved ─────
assert(!/appendChild\(personal\)/.test(js), 'the personal "For you" panel must not be appended to the hub');
assert(!js.includes("'For you'"), 'no "For you" panel heading should be rendered');
assert(!/id:\s*'beta-personal'/.test(js), 'the beta-personal panel element must not be created');
// The individual-message path is preserved: still fetched, then filtered out.
assert(js.includes('/api/messages'), 'the hub still fetches /api/messages');
assert(/kind\s*!==\s*'individual'/.test(js),
  'individual messages must be filtered out of the shared feed (kept in data, ignored by UI)');

// ── 2. Substack invitation, within Library, safe + accessible ───────────────
assert(js.includes('https://substack.com/@commonunityio'), 'exact Substack URL must be present');
assert(/substackInvite\s*\(/.test(js), 'a substackInvite() builder should exist');
// Placed within the Library & Sharings panel (appended to `library`).
const iLibraryTitle = js.indexOf("'Library & Sharings'");
const iSubstackAppend = js.indexOf('library.appendChild(substackInvite())');
assert(iLibraryTitle > -1 && iSubstackAppend > iLibraryTitle,
  'the Substack invite must be appended within the Library & Sharings panel');
// Opens externally, safely.
assert(/target:\s*'_blank'/.test(js), 'the Substack link must open in a new tab');
assert(/rel:\s*'noopener noreferrer'/.test(js), 'the Substack link must carry rel="noopener noreferrer"');
// Accessible external-link affordance: a screen-reader hint that it opens a tab.
assert(js.includes('(opens in a new tab)'), 'an accessible new-tab hint must be present');
assert(css.includes('.beta-visually-hidden'), 'a visually-hidden helper must style the screen-reader hint');
// Calm text link — no Substack logo asset introduced.
assert(!/substack.*\.svg/i.test(js) && !/substack.*\.png/i.test(js),
  'no Substack logo asset should be used — a restrained text link is sufficient');

// ── 3. Restrained luminous interaction ──────────────────────────────────────
assert(/attachFieldGlow\s*\(/.test(js), 'attachFieldGlow() should exist');
// Gated by pointer capability and reduced-motion (calm, sensed, not gamified).
assert(js.includes("matchMedia('(pointer: fine)')"), 'the pointer glow must require a fine pointer (skip touch)');
assert(js.includes("matchMedia('(prefers-reduced-motion: reduce)')"),
  'the pointer glow must respect prefers-reduced-motion');
assert(css.includes('.beta-glow'), '.beta-glow styling should exist');
assert(/\.beta-glow:focus-visible/.test(css), 'keyboard focus must produce a visible glow/ring');
assert(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css),
  'beta.css must include a prefers-reduced-motion block');
// Locked product cards must NOT carry the interactive glow class (they are held,
// not actionable — the glow would misleadingly imply clickability).
assert(/beta-row beta-row-locked'|beta-row-locked/.test(js), 'locked rows should exist');
const lockedBuilder = js.slice(js.indexOf('function lockedEntrance('), js.indexOf('// Render one message item'));
assert(!lockedBuilder.includes('beta-glow'),
  'locked entrances must not carry the interactive .beta-glow affordance');

// ── 4. Canonical transparent-logo rule preserved ────────────────────────────
['.beta-wordmark', '.beta-row-logo'].forEach((sel) => {
  const rule = css.match(new RegExp(sel.replace('.', '\\.') + '\\s*\\{([^}]*)\\}'));
  assert(rule, sel + ' rule should exist');
  ['background', 'border', 'box-shadow', 'border-radius'].forEach((prop) => {
    assert(!new RegExp('\\b' + prop + '\\b\\s*:').test(rule[1]),
      sel + ' must not frame the logo (found ' + prop + ')');
  });
});

console.log('beta hub refinement checks passed');
